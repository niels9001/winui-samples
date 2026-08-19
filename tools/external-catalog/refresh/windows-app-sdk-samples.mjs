import { randomUUID } from "node:crypto";
import {
  mkdir,
  open,
  readFile,
  rename,
  rm,
} from "node:fs/promises";
import path from "node:path";

import {
  canonicalStringify,
  gitBlobSha,
  sha256Hex,
} from "../lib/canonical.mjs";
import {
  assertReviewedLifecycleDiff,
  diffCatalogLifecycle,
} from "../lib/lifecycle.mjs";
import {
  findExactGitEntry,
  validateCachedArtifact,
} from "../lib/guards.mjs";
import { createRouteSlug } from "../lib/identity.mjs";
import { acquirePublishLock } from "./publication-lock.mjs";
import { reviewedInventory } from "../providers/windows-app-sdk-samples/inventory.mjs";
import {
  familyManifest,
  infrastructureRoots,
  knownSampleRoots,
  licenseDefinitions,
  providerId,
  reviewedRenames,
  reviewedSnapshot,
  reviewedSync,
  reviewedTombstones,
} from "../providers/windows-app-sdk-samples/manifest.mjs";

function needsCuration(message) {
  throw new Error(`needs-curation: ${message}`);
}

function sameJson(left, right) {
  return canonicalStringify(left) === canonicalStringify(right);
}

function repositoryExpectation() {
  return {
    owner: reviewedSnapshot.repository.owner,
    repository: reviewedSnapshot.repository.name,
  };
}

function assignmentCandidates(sourcePath) {
  return familyManifest.filter(
    (family) =>
      family.exactPaths.includes(sourcePath) ||
      family.roots.some(
        (root) =>
          sourcePath === root || sourcePath.startsWith(`${root}/`),
      ),
  );
}

function relevantInventoryPath(sourcePath) {
  return (
    (sourcePath.startsWith("Samples/") &&
      !sourcePath.startsWith("Samples/localpackages/")) ||
    sourcePath.startsWith("DynamicDependenciesSample/")
  );
}

function sortedPaths(entries, pattern) {
  return entries
    .filter(
      (entry) =>
        entry.type === "blob" &&
        relevantInventoryPath(entry.path) &&
        pattern.test(entry.path),
    )
    .map((entry) => entry.path)
    .sort((left, right) => left.localeCompare(right, "en-US"));
}

function expectedPaths(field) {
  return Object.values(reviewedInventory.families)
    .flatMap((family) => family[field])
    .sort((left, right) => left.localeCompare(right, "en-US"));
}

function assertExactPaths(label, actual, expected) {
  if (!sameJson(actual, expected)) {
    const actualSet = new Set(actual);
    const expectedSet = new Set(expected);
    const added = actual.filter((item) => !expectedSet.has(item));
    const removed = expected.filter((item) => !actualSet.has(item));
    needsCuration(
      `${label} changed; added=${JSON.stringify(added)}, removed=${JSON.stringify(removed)}`,
    );
  }
}

export function validateReviewedTree(entries) {
  if (entries.length !== reviewedSnapshot.treeEntryCount) {
    needsCuration(
      `recursive tree expected ${reviewedSnapshot.treeEntryCount} entries, received ${entries.length}`,
    );
  }
  const blobCount = entries.filter((entry) => entry.type === "blob").length;
  if (blobCount !== reviewedSnapshot.blobEntryCount) {
    needsCuration(
      `recursive tree expected ${reviewedSnapshot.blobEntryCount} blobs, received ${blobCount}`,
    );
  }

  const sampleRoots = entries
    .filter(
      (entry) =>
        entry.type === "tree" &&
        /^Samples\/[^/]+$/u.test(entry.path),
    )
    .map((entry) => entry.path.slice("Samples/".length))
    .sort((left, right) => left.localeCompare(right, "en-US"));
  const expectedRoots = [...knownSampleRoots, "localpackages"].sort((left, right) =>
    left.localeCompare(right, "en-US"),
  );
  assertExactPaths("Samples semantic roots", sampleRoots, expectedRoots);

  const solutions = sortedPaths(entries, /\.(?:sln|slnx)$/iu);
  const csharpProjects = sortedPaths(entries, /\.csproj$/iu);
  const cppProjects = sortedPaths(entries, /\.vcxproj$/iu);
  const packagingProjects = sortedPaths(entries, /\.wapproj$/iu);
  assertExactPaths(
    "sample solutions",
    solutions,
    expectedPaths("solutions"),
  );
  assertExactPaths(
    "C# source projects",
    csharpProjects,
    expectedPaths("sourceProjects").filter((item) =>
      item.toLowerCase().endsWith(".csproj"),
    ),
  );
  assertExactPaths(
    "C++ source projects",
    cppProjects,
    expectedPaths("sourceProjects").filter((item) =>
      item.toLowerCase().endsWith(".vcxproj"),
    ),
  );
  assertExactPaths(
    "packaging projects",
    packagingProjects,
    expectedPaths("packagingProjects"),
  );

  for (const sourcePath of [
    ...solutions,
    ...csharpProjects,
    ...cppProjects,
    ...packagingProjects,
  ]) {
    const candidates = assignmentCandidates(sourcePath);
    if (candidates.length === 0) {
      needsCuration(`unknown semantic source root: ${sourcePath}`);
    }
    if (candidates.length > 1) {
      needsCuration(
        `ambiguous semantic source root ${sourcePath}: ${candidates.map((item) => item.recordKey).join(", ")}`,
      );
    }
  }

  for (const expected of reviewedInventory.selectedArtifacts) {
    const entry = findExactGitEntry(entries, expected.path);
    if (entry.sha !== expected.blobSha || entry.size !== expected.size) {
      needsCuration(
        `selected artifact identity changed: ${expected.path}`,
      );
    }
  }
  return entries;
}

async function requestRepository(github) {
  const expected = repositoryExpectation();
  const url =
    `https://api.github.com/repos/${encodeURIComponent(expected.owner)}/` +
    encodeURIComponent(expected.repository);
  return (
    await github.requestJson(url, {
      repository: expected,
    })
  ).value;
}

async function requestCommit(github) {
  const expected = repositoryExpectation();
  const url = github.repositoryUrl(
    expected.owner,
    expected.repository,
    `commits/${reviewedSnapshot.ref}`,
  );
  return (
    await github.requestJson(url, {
      repository: expected,
    })
  ).value;
}

export async function resolveReviewedSnapshot(github) {
  const repository = await requestRepository(github);
  if (repository.default_branch !== reviewedSnapshot.ref) {
    needsCuration(
      `default branch changed from ${reviewedSnapshot.ref} to ${repository.default_branch ?? "(missing)"}`,
    );
  }

  const commit = await requestCommit(github);
  const commitSha = commit.sha;
  const treeSha = commit.commit?.tree?.sha;
  const commitTime =
    commit.commit?.committer?.date ?? commit.commit?.author?.date;
  if (
    commitSha !== reviewedSnapshot.commitSha ||
    treeSha !== reviewedSnapshot.treeSha ||
    commitTime !== reviewedSnapshot.commitTime
  ) {
    needsCuration(
      `mutable ${reviewedSnapshot.ref} resolved to an unreviewed snapshot (${commitSha ?? "missing commit"}, ${treeSha ?? "missing tree"}, ${commitTime ?? "missing time"})`,
    );
  }

  const entries = await github.fetchTree(
    reviewedSnapshot.repository.owner,
    reviewedSnapshot.repository.name,
    treeSha,
  );
  validateReviewedTree(entries);
  return { commitSha, treeSha, commitTime, entries };
}

async function fetchBlob(github, entry, expectedArtifact) {
  const expectedRepository = repositoryExpectation();
  const url = github.repositoryUrl(
    expectedRepository.owner,
    expectedRepository.repository,
    `git/blobs/${entry.sha}`,
  );
  const response = (
    await github.requestJson(url, {
      repository: expectedRepository,
    })
  ).value;
  if (
    response.sha !== entry.sha ||
    response.encoding !== "base64" ||
    typeof response.content !== "string"
  ) {
    needsCuration(`invalid Git blob response for ${expectedArtifact.path}`);
  }
  const bytes = Buffer.from(response.content.replace(/\s+/gu, ""), "base64");
  if (
    bytes.byteLength !== entry.size ||
    response.size !== entry.size ||
    gitBlobSha(bytes) !== entry.sha
  ) {
    needsCuration(`Git blob bytes do not match ${expectedArtifact.path}`);
  }
  const sha256 = sha256Hex(bytes);
  if (
    sha256 !== expectedArtifact.sha256 ||
    bytes.byteLength !== expectedArtifact.size
  ) {
    needsCuration(
      `selected artifact bytes differ from reviewed curation: ${expectedArtifact.path}`,
    );
  }
  validateCachedArtifact({
    path: expectedArtifact.path,
    bytes,
    mediaType: expectedArtifact.mediaType,
  });
  return bytes;
}

async function atomicWriteBytes(filePath, bytes) {
  await mkdir(path.dirname(filePath), { recursive: true });
  try {
    const existing = await readFile(filePath);
    if (existing.equals(bytes)) {
      return;
    }
    throw new Error(`content-addressed cache collision at ${filePath}`);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }

  const temporaryPath = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${process.pid}.${randomUUID()}.tmp`,
  );
  let handle;
  try {
    handle = await open(temporaryPath, "wx");
    await handle.writeFile(bytes);
    await handle.sync();
    await handle.close();
    handle = undefined;
    await rename(temporaryPath, filePath);
  } catch (error) {
    await handle?.close().catch(() => {});
    await rm(temporaryPath, { force: true }).catch(() => {});
    throw error;
  }
}

function providerLock() {
  return {
    providerId,
    repository: reviewedSnapshot.repository,
    ref: reviewedSnapshot.ref,
    commitSha: reviewedSnapshot.commitSha,
    treeSha: reviewedSnapshot.treeSha,
    commitTime: reviewedSnapshot.commitTime,
    artifacts: reviewedInventory.selectedArtifacts.map((artifact) => ({
      ...artifact,
    })),
  };
}

function cacheEntries(lock) {
  return lock.artifacts.map((artifact) => ({
    providerId,
    repository: lock.repository,
    commitSha: lock.commitSha,
    treeSha: lock.treeSha,
    ...artifact,
  }));
}

export function reviewedHistory(
  previousHistory,
  {
    renameDeclarations = reviewedRenames,
    tombstoneDeclarations = reviewedTombstones,
  } = {},
) {
  const previous =
    previousHistory ?? {
      providerId,
      latestSyncId: reviewedSync.id,
      syncs: [],
      records: [],
    };
  const previousSyncs = new Map(
    previous.syncs.map((sync) => [sync.id, sync]),
  );
  const existingSync = previousSyncs.get(reviewedSync.id);
  if (existingSync && !sameJson(existingSync, reviewedSync)) {
    needsCuration(
      `reviewed sync id ${reviewedSync.id} conflicts with committed history`,
    );
  }
  const syncs = existingSync
    ? previous.syncs
    : [...previous.syncs, reviewedSync];
  const previousRecords = new Map(
    previous.records.map((record) => [record.id, record]),
  );
  const currentIds = new Set(
    familyManifest.map((family) => `${providerId}:${family.recordKey}`),
  );
  const renameSources = new Map(
    renameDeclarations.map((rename) => [rename.fromId, rename]),
  );
  const renameTargets = new Map(
    renameDeclarations.map((rename) => [rename.toId, rename]),
  );
  const tombstones = new Map(
    tombstoneDeclarations.map((tombstone) => [tombstone.id, tombstone]),
  );

  for (const record of previous.records) {
    if (record.status === "active" && !currentIds.has(record.id)) {
      if (!renameSources.has(record.id) && !tombstones.has(record.id)) {
        needsCuration(
          `reviewed active record was removed without a rename or tombstone: ${record.id}`,
        );
      }
    }
    if (
      record.status === "tombstoned" &&
      !tombstones.has(record.id) &&
      !renameSources.has(record.id)
    ) {
      needsCuration(
        `committed tombstone needs a persistent reviewed declaration: ${record.id}`,
      );
    }
  }

  for (const rename of renameDeclarations) {
    if (
      !previousRecords.has(rename.fromId) ||
      !currentIds.has(rename.toId)
    ) {
      needsCuration(
        `reviewed rename must map a committed record to a current family: ${rename.fromId} -> ${rename.toId}`,
      );
    }
  }

  const previousLatestSync = previousSyncs.get(previous.latestSyncId);
  const records = familyManifest.map((family) => {
    const id = `${providerId}:${family.recordKey}`;
    const directPrevious = previousRecords.get(id);
    const rename = renameTargets.get(id);
    const renamedPrevious = rename
      ? previousRecords.get(rename.fromId)
      : undefined;
    const prior = directPrevious ?? renamedPrevious;
    if (directPrevious?.status === "tombstoned") {
      needsCuration(
        `tombstoned record cannot reactivate without an explicit reviewed decision: ${id}`,
      );
    }
    const unchangedReview =
      directPrevious &&
      existingSync &&
      previous.latestSyncId === reviewedSync.id;
    const contentChanged =
      !prior ||
      Boolean(rename) ||
      previousLatestSync?.lockCommitSha !== reviewedSync.lockCommitSha;
    const slug = createRouteSlug(providerId, family.recordKey);
    return {
      id,
      recordKey: family.recordKey,
      routePath: `samples/${slug}`,
      status: "active",
      firstSeenSync: prior?.firstSeenSync ?? reviewedSync.id,
      lastReviewedSync: unchangedReview
        ? directPrevious.lastReviewedSync
        : reviewedSync.id,
      lastChangedSync: unchangedReview
        ? directPrevious.lastChangedSync
        : contentChanged
          ? reviewedSync.id
          : directPrevious?.lastChangedSync ?? null,
      removedAtSync: null,
    };
  });

  for (const previousRecord of previous.records) {
    if (currentIds.has(previousRecord.id)) {
      continue;
    }
    const declaration =
      tombstones.get(previousRecord.id) ??
      renameSources.get(previousRecord.id);
    if (!declaration) {
      continue;
    }
    records.push({
      ...previousRecord,
      status: "tombstoned",
      lastReviewedSync: reviewedSync.id,
      lastChangedSync:
        previousRecord.status === "tombstoned"
          ? previousRecord.lastChangedSync
          : reviewedSync.id,
      removedAtSync:
        previousRecord.removedAtSync ??
        declaration.removedAtSync ??
        reviewedSync.id,
    });
  }

  return {
    providerId,
    latestSyncId: reviewedSync.id,
    syncs,
    records,
  };
}

function licenseManifest() {
  const repositoryUrl = `https://github.com/${reviewedSnapshot.repository.owner}/${reviewedSnapshot.repository.name}`;
  return {
    schemaVersion: 1,
    providerId,
    repository: reviewedSnapshot.repository,
    lockedCommitSha: reviewedSnapshot.commitSha,
    entries: licenseDefinitions.map((entry) => ({
      ...entry,
      licenseUrl: `${repositoryUrl}/blob/${reviewedSnapshot.commitSha}/${entry.licensePath
        .split("/")
        .map((segment) => encodeURIComponent(segment))
        .join("/")}`,
    })),
  };
}

function replaceProviderItem(values, key, replacement) {
  return [
    ...values.filter((item) => item[key] !== providerId),
    replacement,
  ].sort((left, right) =>
    left[key].localeCompare(right[key], "en-US"),
  );
}

function replaceProviderCacheEntries(values, replacements) {
  return [
    ...values.filter((entry) => entry.providerId !== providerId),
    ...replacements,
  ].sort(
    (left, right) =>
      left.providerId.localeCompare(right.providerId, "en-US") ||
      left.path.localeCompare(right.path, "en-US"),
  );
}

export function buildReviewedStateDocuments(state) {
  const lock = providerLock();
  const previousHistory =
    state.historyFile.providers.find(
      (history) => history.providerId === providerId,
    );
  const nextHistory = reviewedHistory(previousHistory);
  return {
    lock,
    locks: {
      ...state.lockFile,
      locks: replaceProviderItem(
        state.lockFile.locks,
        "providerId",
        lock,
      ),
    },
    cacheManifest: {
      ...state.cacheManifest,
      entries: replaceProviderCacheEntries(
        state.cacheManifest.entries,
        cacheEntries(lock),
      ),
    },
    history: {
      ...state.historyFile,
      providers: replaceProviderItem(
        state.historyFile.providers,
        "providerId",
        nextHistory,
      ),
    },
    licenses: licenseManifest(),
  };
}

export function reviewFamilyLifecycle(
  previousRecords,
  currentRecords,
  {
    renameDeclarations = reviewedRenames,
    tombstoneDeclarations = reviewedTombstones,
  } = {},
) {
  const diff = diffCatalogLifecycle(previousRecords, currentRecords, {
    renameDeclarations,
    tombstoneDeclarations,
  });
  assertReviewedLifecycleDiff(diff);
  return diff;
}

async function optionalFileVersion(filePath) {
  try {
    return sha256Hex(await readFile(filePath));
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function captureVersions(filePaths) {
  return new Map(
    await Promise.all(
      filePaths.map(async (filePath) => [
        filePath,
        await optionalFileVersion(filePath),
      ]),
    ),
  );
}

async function writeStagedFile(filePath, contents) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const handle = await open(filePath, "wx");
  try {
    await handle.writeFile(contents, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function writeDocumentTransaction(writes, expectedVersions, root) {
  const transactionRoot = path.join(
    root,
    "external",
    `.windows-app-sdk-samples-refresh-${process.pid}-${randomUUID()}`,
  );
  await mkdir(transactionRoot, { recursive: true });
  const states = [];
  try {
    for (const [index, write] of writes.entries()) {
      const stagedPath = path.join(transactionRoot, `${index}.json`);
      await writeStagedFile(
        stagedPath,
        canonicalStringify(write.value),
      );
      states.push({
        targetPath: write.path,
        stagedPath,
        backupPath: path.join(transactionRoot, `${index}.backup`),
        backedUp: false,
        installed: false,
      });
    }

    for (const state of states) {
      const expected = expectedVersions.get(state.targetPath);
      const actual = await optionalFileVersion(state.targetPath);
      if (actual !== expected) {
        needsCuration(
          `refresh state changed concurrently: ${state.targetPath}`,
        );
      }
      await mkdir(path.dirname(state.targetPath), { recursive: true });
      if (actual !== null) {
        await rename(state.targetPath, state.backupPath);
        state.backedUp = true;
      }
      await rename(state.stagedPath, state.targetPath);
      state.installed = true;
    }
  } catch (error) {
    const rollbackErrors = [];
    for (const state of [...states].reverse()) {
      if (state.installed) {
        try {
          await rm(state.targetPath, { force: true });
        } catch (rollbackError) {
          rollbackErrors.push(rollbackError);
        }
      }
      if (state.backedUp) {
        try {
          await rename(state.backupPath, state.targetPath);
        } catch (rollbackError) {
          rollbackErrors.push(rollbackError);
        }
      }
    }
    try {
      await rm(transactionRoot, { recursive: true, force: true });
    } catch (cleanupError) {
      rollbackErrors.push(cleanupError);
    }
    if (rollbackErrors.length > 0) {
      throw new AggregateError(
        [error, ...rollbackErrors],
        `${providerId}: document transaction and rollback failed`,
      );
    }
    throw error;
  }
  await rm(transactionRoot, { recursive: true, force: true });
}

export async function refresh({
  provider,
  state,
  repositoryRoot,
  github,
}) {
  if (
    provider.id !== providerId ||
    provider.repository.owner !== reviewedSnapshot.repository.owner ||
    provider.repository.name !== reviewedSnapshot.repository.name
  ) {
    throw new Error(`${providerId}: refresh context provider mismatch`);
  }
  if (
    !infrastructureRoots.includes("Samples/localpackages") ||
    reviewedInventory.counts.sampleRootDirectoryCount !== 23
  ) {
    needsCuration("reviewed infrastructure roots are inconsistent");
  }

  const documents = buildReviewedStateDocuments(state);
  const writes = [
    {
      path: path.join(repositoryRoot, "external", "locks.json"),
      value: documents.locks,
    },
    {
      path: path.join(
        repositoryRoot,
        "external",
        "cache",
        "manifest.json",
      ),
      value: documents.cacheManifest,
    },
    {
      path: path.join(repositoryRoot, "external", "history.json"),
      value: documents.history,
    },
    {
      path: path.join(
        repositoryRoot,
        "external",
        "licenses",
        `${providerId}.json`,
      ),
      value: documents.licenses,
    },
    {
      path: path.join(
        repositoryRoot,
        "external",
        "curation",
        providerId,
        "inventory.json",
      ),
      value: reviewedInventory,
    },
  ];
  const expectedVersions = await captureVersions(
    writes.map((write) => write.path),
  );

  const snapshot = await resolveReviewedSnapshot(github);
  const stagedBlobs = [];
  const concurrency = 8;
  for (
    let index = 0;
    index < reviewedInventory.selectedArtifacts.length;
    index += concurrency
  ) {
    const batch = reviewedInventory.selectedArtifacts.slice(
      index,
      index + concurrency,
    );
    stagedBlobs.push(
      ...(await Promise.all(
        batch.map(async (artifact) => {
          const entry = findExactGitEntry(snapshot.entries, artifact.path);
          const bytes = await fetchBlob(github, entry, artifact);
          return { artifact, bytes };
        }),
      )),
    );
  }

  for (const { artifact, bytes } of stagedBlobs) {
    const outputPath = path.join(
      repositoryRoot,
      "external",
      "cache",
      ...artifact.cachePath.split("/"),
    );
    await atomicWriteBytes(outputPath, bytes);
  }

  const releasePublishLock = await acquirePublishLock(repositoryRoot);
  try {
    await writeDocumentTransaction(
      writes,
      expectedVersions,
      repositoryRoot,
    );
  } finally {
    await releasePublishLock();
  }

  console.log(
    `Refreshed ${providerId} at ${snapshot.commitSha}: ${familyManifest.length} families, ${stagedBlobs.length} cached artifacts.`,
  );
  return {
    providerId,
    commitSha: snapshot.commitSha,
    treeSha: snapshot.treeSha,
    familyCount: familyManifest.length,
    artifactCount: stagedBlobs.length,
  };
}
