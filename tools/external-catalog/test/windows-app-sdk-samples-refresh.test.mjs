import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { canonicalStringify } from "../lib/canonical.mjs";
import { loadExternalState } from "../lib/config.mjs";
import { createGitHubClient } from "../lib/network.mjs";
import { createRouteSlug } from "../lib/identity.mjs";
import { reviewedInventory } from "../providers/windows-app-sdk-samples/inventory.mjs";
import {
  familyManifest,
  knownSampleRoots,
  providerId,
  reviewedSnapshot,
  reviewedSync,
} from "../providers/windows-app-sdk-samples/manifest.mjs";
import {
  buildReviewedStateDocuments,
  refresh,
  resolveReviewedSnapshot,
  reviewFamilyLifecycle,
  validateReviewedTree,
} from "../refresh/windows-app-sdk-samples.mjs";

function syntheticSha(kind, index) {
  return createHash("sha1").update(`${kind}\0${index}`).digest("hex");
}

function fullTreeFixture() {
  const entries = Object.entries(reviewedInventory.treeEntries).map(
    ([sourcePath, entry]) => ({
      path: sourcePath,
      mode: entry.mode,
      type: entry.type,
      sha: entry.sha,
      size: entry.size,
    }),
  );
  const paths = new Set(entries.map((entry) => entry.path));
  for (const root of [...knownSampleRoots, "localpackages"]) {
    const sourcePath = `Samples/${root}`;
    if (!paths.has(sourcePath)) {
      entries.push({
        path: sourcePath,
        mode: "040000",
        type: "tree",
        sha: syntheticSha("sample-root", entries.length),
      });
      paths.add(sourcePath);
    }
  }

  let blobCount = entries.filter((entry) => entry.type === "blob").length;
  for (let index = 0; blobCount < reviewedSnapshot.blobEntryCount; index += 1) {
    const sourcePath =
      `Samples/AppLifecycle/Activation/__fixture/blobs/${index}.txt`;
    entries.push({
      path: sourcePath,
      mode: "100644",
      type: "blob",
      sha: syntheticSha("blob", index),
      size: 0,
    });
    blobCount += 1;
  }

  const expectedTreeCount =
    reviewedSnapshot.treeEntryCount - reviewedSnapshot.blobEntryCount;
  let treeCount = entries.filter((entry) => entry.type === "tree").length;
  for (let index = 0; treeCount < expectedTreeCount; index += 1) {
    const sourcePath =
      `Samples/AppLifecycle/Activation/__fixture/trees/${index}`;
    entries.push({
      path: sourcePath,
      mode: "040000",
      type: "tree",
      sha: syntheticSha("tree", index),
    });
    treeCount += 1;
  }

  assert.equal(entries.length, reviewedSnapshot.treeEntryCount);
  assert.equal(
    entries.filter((entry) => entry.type === "blob").length,
    reviewedSnapshot.blobEntryCount,
  );
  return entries;
}

function jsonResponse(
  value,
  {
    status = 200,
    url =
      "https://api.github.com/repos/microsoft/WindowsAppSDK-Samples/resource",
  } = {},
) {
  const response = new Response(JSON.stringify(value), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
  Object.defineProperty(response, "url", { value: url });
  return response;
}

function commitResponse(overrides = {}) {
  return {
    sha: overrides.commitSha ?? reviewedSnapshot.commitSha,
    commit: {
      tree: {
        sha: overrides.treeSha ?? reviewedSnapshot.treeSha,
      },
      committer: {
        date: overrides.commitTime ?? reviewedSnapshot.commitTime,
      },
    },
  };
}

function simpleGitHub({
  defaultBranch = reviewedSnapshot.ref,
  commit = commitResponse(),
  tree = fullTreeFixture(),
  blobs = new Map(),
} = {}) {
  return {
    repositoryUrl(owner, repository, apiPath) {
      return `https://api.github.com/repos/${owner}/${repository}/${apiPath}`;
    },
    async requestJson(url) {
      if (/\/repos\/microsoft\/WindowsAppSDK-Samples\/?$/u.test(url)) {
        return { value: { default_branch: defaultBranch } };
      }
      if (url.endsWith(`/commits/${reviewedSnapshot.ref}`)) {
        return { value: commit };
      }
      const blobSha = url.match(/\/git\/blobs\/([0-9a-f]{40})$/u)?.[1];
      if (blobSha) {
        const bytes = blobs.get(blobSha);
        if (!bytes) {
          throw new Error(`missing fixture blob ${blobSha}`);
        }
        return {
          value: {
            sha: blobSha,
            size: bytes.byteLength,
            encoding: "base64",
            content: bytes.toString("base64"),
          },
        };
      }
      throw new Error(`unexpected mock request ${url}`);
    },
    async fetchTree() {
      return tree;
    },
  };
}

async function cachedBlobMap() {
  const blobs = new Map();
  for (const artifact of reviewedInventory.selectedArtifacts) {
    if (!blobs.has(artifact.blobSha)) {
      blobs.set(
        artifact.blobSha,
        await readFile(
          path.resolve(
            "external",
            "cache",
            ...artifact.cachePath.split("/"),
          ),
        ),
      );
    }
  }
  return blobs;
}

test("reviewed tree validation rejects unknown roots, casing drift, and inventory changes", () => {
  const tree = fullTreeFixture();
  assert.doesNotThrow(() => validateReviewedTree(tree));

  const unknownRoot = structuredClone(tree);
  const replaceIndex = unknownRoot.findIndex(
    (entry) =>
      entry.type === "tree" &&
      entry.path.startsWith(
        "Samples/AppLifecycle/Activation/__fixture/trees/",
      ),
  );
  unknownRoot[replaceIndex].path = "Samples/NewSemanticFeature";
  assert.throws(
    () => validateReviewedTree(unknownRoot),
    /needs-curation: Samples semantic roots changed/,
  );

  const caseDrift = structuredClone(tree);
  const sourcePath =
    "Samples/PhotoEditor/cs-winui/PhotoEditor.csproj";
  const caseIndex = caseDrift.findIndex((entry) => entry.path === sourcePath);
  caseDrift[caseIndex].path =
    "Samples/PhotoEditor/cs-winui/photoeditor.csproj";
  assert.throws(
    () => validateReviewedTree(caseDrift),
    /needs-curation|casing mismatch/,
  );

  const removedProject = structuredClone(tree);
  const projectIndex = removedProject.findIndex(
    (entry) => entry.path === sourcePath,
  );
  removedProject[projectIndex].path =
    "Samples/PhotoEditor/cs-winui/RemovedProject.txt";
  assert.throws(
    () => validateReviewedTree(removedProject),
    /C# source projects changed/,
  );
});

test("default branch and mutable commit changes require review before fetching blobs", async () => {
  await assert.rejects(
    resolveReviewedSnapshot(
      simpleGitHub({
        defaultBranch: "development",
      }),
    ),
    /needs-curation: default branch changed/,
  );
  await assert.rejects(
    resolveReviewedSnapshot(
      simpleGitHub({
        commit: commitResponse({
          commitSha: "0".repeat(40),
        }),
      }),
    ),
    /needs-curation: mutable main resolved to an unreviewed snapshot/,
  );
});

test("provider snapshot resolution exercises truncated-tree recursive fallback", async () => {
  const tree = fullTreeFixture();
  const treeBySha = new Map(
    tree
      .filter((entry) => entry.type === "tree")
      .map((entry) => [entry.sha, entry]),
  );
  const requests = [];
  const client = createGitHubClient({
    fetchImpl: async (url) => {
      const value = String(url);
      requests.push(value);
      if (/\/repos\/microsoft\/WindowsAppSDK-Samples\/?$/u.test(value)) {
        return jsonResponse(
          { default_branch: reviewedSnapshot.ref },
          { url: value },
        );
      }
      if (value.endsWith(`/commits/${reviewedSnapshot.ref}`)) {
        return jsonResponse(commitResponse(), { url: value });
      }
      if (
        value.endsWith(
          `/git/trees/${reviewedSnapshot.treeSha}?recursive=1`,
        )
      ) {
        return jsonResponse(
          {
            sha: reviewedSnapshot.treeSha,
            truncated: true,
            tree: [],
          },
          { url: value },
        );
      }
      if (
        value.endsWith(`/git/trees/${reviewedSnapshot.treeSha}`)
      ) {
        return jsonResponse(
          {
            sha: reviewedSnapshot.treeSha,
            truncated: false,
            tree,
          },
          { url: value },
        );
      }
      const childSha = value.match(/\/git\/trees\/([0-9a-f]{40})$/u)?.[1];
      if (childSha && treeBySha.has(childSha)) {
        return jsonResponse(
          {
            sha: childSha,
            truncated: false,
            tree: [],
          },
          { url: value },
        );
      }
      throw new Error(`unexpected request ${value}`);
    },
  });

  const result = await resolveReviewedSnapshot(client);
  assert.equal(result.entries.length, reviewedSnapshot.treeEntryCount);
  assert.ok(
    requests.some((url) => url.endsWith("?recursive=1")),
  );
  assert.ok(requests.length > 500);
});

test("explicit refresh mocks fetch exact blobs and atomically preserve other providers", async () => {
  const repositoryRoot = await mkdtemp(
    path.join(tmpdir(), "windows-app-sdk-refresh-"),
  );
  try {
    const state = await loadExternalState();
    const provider = state.providers.get(providerId);
    state.lockFile.locks.push({
      providerId: "sentinel-provider",
      sentinel: "lock",
    });
    state.cacheManifest.entries.push({
      providerId: "sentinel-provider",
      sentinel: "cache",
    });
    state.historyFile.providers.push({
      providerId: "sentinel-provider",
      sentinel: "history",
    });
    const github = simpleGitHub({
      blobs: await cachedBlobMap(),
    });

    const first = await refresh({
      provider,
      state,
      repositoryRoot,
      github,
    });
    assert.deepEqual(first, {
      providerId,
      commitSha: reviewedSnapshot.commitSha,
      treeSha: reviewedSnapshot.treeSha,
      familyCount: 42,
      artifactCount: reviewedInventory.selectedArtifacts.length,
    });

    const locksPath = path.join(repositoryRoot, "external", "locks.json");
    const cachePath = path.join(
      repositoryRoot,
      "external",
      "cache",
      "manifest.json",
    );
    const historyPath = path.join(repositoryRoot, "external", "history.json");
    const licensePath = path.join(
      repositoryRoot,
      "external",
      "licenses",
      `${providerId}.json`,
    );
    const inventoryPath = path.join(
      repositoryRoot,
      "external",
      "curation",
      providerId,
      "inventory.json",
    );
    const firstBytes = await Promise.all(
      [
        locksPath,
        cachePath,
        historyPath,
        licensePath,
        inventoryPath,
      ].map((item) => readFile(item, "utf8")),
    );
    const [locks, cache, history, licenses, inventory] =
      firstBytes.map(JSON.parse);
    assert.ok(
      locks.locks.some((item) => item.providerId === "sentinel-provider"),
    );
    assert.ok(
      cache.entries.some((item) => item.providerId === "sentinel-provider"),
    );
    assert.ok(
      history.providers.some(
        (item) => item.providerId === "sentinel-provider",
      ),
    );
    assert.equal(
      locks.locks.find((item) => item.providerId === providerId).artifacts
        .length,
      reviewedInventory.selectedArtifacts.length,
    );
    assert.equal(licenses.entries.length, 5);
    assert.equal(
      inventory.reviewedCommitSha,
      reviewedSnapshot.commitSha,
    );

    await refresh({
      provider,
      state,
      repositoryRoot,
      github,
    });
    const secondBytes = await Promise.all(
      [
        locksPath,
        cachePath,
        historyPath,
        licensePath,
        inventoryPath,
      ].map((item) => readFile(item, "utf8")),
    );
    assert.deepEqual(secondBytes, firstBytes);
  } finally {
    await rm(repositoryRoot, { recursive: true, force: true });
  }
});

test("reviewed state updates are byte-stable and replace only provider-keyed objects", async () => {
  const state = await loadExternalState();
  const forward = buildReviewedStateDocuments(state);
  const reversed = structuredClone(state);
  reversed.lockFile.locks.reverse();
  reversed.cacheManifest.entries.reverse();
  reversed.historyFile.providers.reverse();
  const reverse = buildReviewedStateDocuments(reversed);
  assert.equal(
    canonicalStringify(forward.locks),
    canonicalStringify(reverse.locks),
  );
  assert.equal(
    canonicalStringify(forward.cacheManifest),
    canonicalStringify(reverse.cacheManifest),
  );
  assert.equal(
    canonicalStringify(forward.history),
    canonicalStringify(reverse.history),
  );
});

test("reviewed state preserves historical sync and record lifecycle metadata", () => {
  const previousSync = {
    id: "windows-app-sdk-samples-2025-01-01",
    reviewedAt: "2025-01-01T00:00:00Z",
    upstreamCommitTime: "2025-01-01T00:00:00Z",
    lockCommitSha: "1".repeat(40),
    treeSha: "2".repeat(40),
    sourceRef: "main",
    recordCount: 42,
  };
  const previousRecords = familyManifest.map((family) => ({
    id: `${providerId}:${family.recordKey}`,
    recordKey: family.recordKey,
    routePath: `samples/${createRouteSlug(providerId, family.recordKey)}`,
    status: "active",
    firstSeenSync: previousSync.id,
    lastReviewedSync: reviewedSync.id,
    lastChangedSync: previousSync.id,
    removedAtSync: null,
  }));
  const state = {
    lockFile: {
      schemaVersion: 1,
      locks: [],
    },
    cacheManifest: {
      schemaVersion: 1,
      entries: [],
    },
    historyFile: {
      schemaVersion: 1,
      providers: [
        {
          providerId,
          latestSyncId: reviewedSync.id,
          syncs: [previousSync, reviewedSync],
          records: previousRecords,
        },
      ],
    },
  };

  const documents = buildReviewedStateDocuments(state);
  const next = documents.history.providers.find(
    (history) => history.providerId === providerId,
  );
  assert.deepEqual(next.syncs, [previousSync, reviewedSync]);
  assert.ok(
    next.records.every(
      (record) =>
        record.firstSeenSync === previousSync.id &&
        record.lastChangedSync === previousSync.id,
    ),
  );

  state.historyFile.providers[0].records.push({
    id: `${providerId}:removed-without-review`,
    recordKey: "removed-without-review",
    routePath: "samples/windows-app-sdk-samples-removed-without-review",
    status: "active",
    firstSeenSync: previousSync.id,
    lastReviewedSync: previousSync.id,
    lastChangedSync: previousSync.id,
    removedAtSync: null,
  });
  assert.throws(
    () => buildReviewedStateDocuments(state),
    /removed without a rename or tombstone/,
  );
});

test("refresh rejects stale documents before coordinated replacement", async () => {
  const repositoryRoot = await mkdtemp(
    path.join(tmpdir(), "windows-app-sdk-refresh-stale-"),
  );
  const locksPath = path.join(repositoryRoot, "external", "locks.json");
  try {
    const state = await loadExternalState();
    const provider = state.providers.get(providerId);
    const github = simpleGitHub({
      blobs: await cachedBlobMap(),
    });
    const fetchTree = github.fetchTree.bind(github);
    github.fetchTree = async (...args) => {
      const tree = await fetchTree(...args);
      await mkdir(path.dirname(locksPath), { recursive: true });
      await writeFile(locksPath, '{"concurrent":true}\n', "utf8");
      return tree;
    };

    await assert.rejects(
      refresh({
        provider,
        state,
        repositoryRoot,
        github,
      }),
      /refresh state changed concurrently/,
    );
    assert.equal(
      await readFile(locksPath, "utf8"),
      '{"concurrent":true}\n',
    );
    await assert.rejects(
      readFile(
        path.join(repositoryRoot, "external", "history.json"),
        "utf8",
      ),
      { code: "ENOENT" },
    );
  } finally {
    await rm(repositoryRoot, { recursive: true, force: true });
  }
});

test("ambiguous renames and deletions require explicit rename or tombstone decisions", async () => {
  const fixture = JSON.parse(
    await readFile(
      path.resolve(
        "tools",
        "external-catalog",
        "fixtures",
        "records",
        "windows-app-sdk-samples.json",
      ),
      "utf8",
    ),
  );
  const previous = structuredClone(fixture);
  previous.id = `${providerId}:old-key`;
  previous.recordKey = "old-key";
  const current = structuredClone(previous);
  current.id = `${providerId}:new-key`;
  current.recordKey = "new-key";

  assert.throws(
    () => reviewFamilyLifecycle([previous], [current]),
    /possible renames require an explicit decision/,
  );
  assert.throws(
    () => reviewFamilyLifecycle([previous], []),
    /removed without reviewed tombstones/,
  );
  const reviewed = reviewFamilyLifecycle([previous], [], {
    tombstoneDeclarations: [
      {
        id: previous.id,
        reason: "Reviewed test removal.",
      },
    ],
  });
  assert.equal(reviewed.requiresReview, false);
  assert.equal(reviewed.tombstones.length, 1);
});

test("refresh implementation never silently broadens record identities", () => {
  const documents = buildReviewedStateDocuments({
    lockFile: {
      schemaVersion: 1,
      locks: [],
    },
    cacheManifest: {
      schemaVersion: 1,
      entries: [],
    },
    historyFile: {
      schemaVersion: 1,
      providers: [],
    },
  });
  assert.deepEqual(
    documents.history.providers[0].records
      .map((record) => record.recordKey)
      .sort(),
    familyManifest.map((family) => family.recordKey).sort(),
  );
  assert.equal(documents.history.providers[0].records.length, 42);
});
