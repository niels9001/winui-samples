import assert from "node:assert/strict";
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

import {
  canonicalStringify,
  gitBlobSha,
  sha256Hex,
} from "../lib/canonical.mjs";
import {
  readCacheEntry,
} from "../lib/cache.mjs";
import {
  expectedCachePath,
  loadExternalState,
} from "../lib/config.mjs";
import { generateExternalCatalog } from "../lib/generate.mjs";
import {
  createRouteSlug,
  validateGlobalIdentity,
} from "../lib/identity.mjs";
import {
  assertReviewedLifecycleDiff,
  diffCatalogLifecycle,
} from "../lib/lifecycle.mjs";
import { repositoryRoot } from "../lib/schema.mjs";
import {
  DYNAMIC_LEGACY_OVERRIDES,
  EXPECTED,
  PINNED_SNAPSHOT,
} from "../providers/winui-gallery/constants.mjs";
import {
  dryRun,
  validateStateCommit,
} from "../providers/winui-gallery/dry-run.mjs";

const expectedOutputBytes = 2085418;
const expectedOutputSha256 =
  "e9e089160fb048c43617efb1dec5ca0cf1eb92bdb7e6d71589b86db690bde9a6";
const dryRunPromise = dryRun();
const goldenPromise = readFile(
  path.join(
    repositoryRoot,
    "external",
    "curation",
    "winui-gallery",
    "golden-records.json",
  ),
  "utf8",
).then(JSON.parse);

function sorted(values) {
  return [...values].sort((left, right) => left.localeCompare(right, "en-US"));
}

function goldenProjection(record) {
  const apiNamespace =
    record.apis.find(
      (api) => api.description === "Upstream API namespace",
    )?.name ?? null;
  const baseClasses = sorted(
    record.apis
      .filter((api) => api.description === "Upstream base class")
      .map((api) => api.name),
  );
  const image = record.images[0];
  return {
    apiNamespace,
    baseClasses,
    categories: record.categories.provider,
    description: record.description,
    documentationCount: record.documentation.length,
    exampleTitles: record.content.examples.map((example) => example.title),
    featuredSourcePaths: sorted(
      record.featuredSourceFiles.map((file) => file.path),
    ),
    id: record.id,
    image: {
      blobSha: image.blobSha,
      height: image.height,
      path: image.path,
      sha256: image.sha256,
      size: image.size,
      width: image.width,
    },
    relatedIds: sorted(
      record.relations.map((relation) => relation.targetId),
    ),
    routePath: record.route.path,
    summary: record.summary,
    tags: record.tags,
    title: record.title.display,
  };
}

test("Button and special missing-description records match golden projections", async () => {
  const [{ output }, golden] = await Promise.all([
    dryRunPromise,
    goldenPromise,
  ]);
  for (const recordKey of ["Button", "Color"]) {
    const record = output.records.find(
      (candidate) => candidate.recordKey === recordKey,
    );
    assert.deepEqual(
      goldenProjection(record),
      golden.records[recordKey],
    );
  }
});

test("provider emits the exact pinned 120-page catalog and nested inventory", async () => {
  const { output } = await dryRunPromise;
  const records = output.records;
  const ids = new Set(records.map((record) => record.id));
  const categoryTitles = new Set(
    records.map((record) => record.categories.provider[0]),
  );
  const specialRecords = records.filter((record) =>
    record.categories.provider.includes("Upstream special section"),
  );
  const missingDescriptions = records.filter((record) =>
    record.metadata.warnings.some(
      (warning) => warning.code === "upstream-description-absent",
    ),
  );
  const apiNamespaceRecords = records.filter((record) =>
    record.apis.some(
      (api) => api.description === "Upstream API namespace",
    ),
  );
  const baseClassRecords = records.filter((record) =>
    record.apis.some((api) => api.description === "Upstream base class"),
  );
  const documentationCount = records.reduce(
    (total, record) => total + record.documentation.length,
    0,
  );
  const storeWarnings = records.flatMap((record) =>
    record.metadata.warnings.filter(
      (warning) => warning.code === "non-web-documentation-uri",
    ),
  );
  const relatedEdges = records.flatMap((record) => record.relations);
  const examples = records.flatMap((record) => record.content.examples);
  const nestedCodeUnits = examples.flatMap((example) => example.children);
  const featuredByPath = new Map(
    records.flatMap((record) =>
      record.featuredSourceFiles.map((file) => [file.path, file]),
    ),
  );
  const definitions = [...featuredByPath.keys()].filter(
    (sourcePath) =>
      sourcePath.endsWith(".txt") &&
      !sourcePath.includes("/Samples/SampleCode/"),
  );
  const imagesByPath = new Map(
    records.flatMap((record) =>
      record.images.map((image) => [image.path, image]),
    ),
  );

  assert.equal(records.length, EXPECTED.records);
  assert.equal(ids.size, EXPECTED.records);
  assert.equal(categoryTitles.size, EXPECTED.groups);
  assert.equal(specialRecords.length, EXPECTED.specialRecords);
  assert.equal(missingDescriptions.length, 7);
  assert.equal(apiNamespaceRecords.length, EXPECTED.apiNamespaces);
  assert.equal(baseClassRecords.length, EXPECTED.baseClasses);
  assert.equal(documentationCount, EXPECTED.httpsDocumentationLinks);
  assert.equal(
    documentationCount + storeWarnings.length,
    EXPECTED.documentationLinks,
  );
  assert.match(
    storeWarnings[0].message,
    /ms-windows-store:\/\/pdp\/\?productid=9N3J5TG8FF7F/,
  );
  assert.equal(relatedEdges.length, EXPECTED.relatedEdges);
  assert.equal(
    relatedEdges.every((relation) => ids.has(relation.targetId)),
    true,
  );
  assert.equal(examples.length, EXPECTED.controlExamples);
  assert.equal(nestedCodeUnits.length, EXPECTED.nestedCodeUnits);
  assert.equal(definitions.length, EXPECTED.sampleDefinitions);
  assert.equal(featuredByPath.size, EXPECTED.selectedSourceFiles);
  assert.equal(
    [...featuredByPath.values()].reduce(
      (total, file) => total + file.size,
      0,
    ),
    EXPECTED.selectedSourceBytes,
  );
  assert.equal(imagesByPath.size, EXPECTED.uniqueImages);
  assert.equal(
    [...imagesByPath.values()].reduce(
      (total, image) => total + image.size,
      0,
    ),
    499589,
  );
  assert.equal(output.lock.artifacts.length, EXPECTED.lockedArtifacts);
  assert.equal(
    output.lock.artifacts.reduce(
      (total, artifact) => total + artifact.size,
      0,
    ),
    EXPECTED.lockedArtifactBytes,
  );

  for (const record of records) {
    const paths = new Set(
      record.featuredSourceFiles.map((file) => file.path),
    );
    assert.equal(paths.has(record.source.path), true);
    assert.equal(paths.has(`${record.source.path}.cs`), true);
    assert.equal(record.title.display, record.title.upstream);
    assert.equal(record.summary === null, false);
    assert.equal(record.images.length, 1);
    assert.equal(record.images[0].decorative, true);
    assert.equal(record.images[0].alt, "");
    assert.equal(
      record.metadata.warnings.some(
        (warning) => warning.code === "decorative-icon-alt-contract",
      ),
      false,
    );
  }
  assert.deepEqual(
    sorted(
      [...featuredByPath.keys()].filter((sourcePath) =>
        sourcePath.includes("/Samples/SampleCode/"),
      ),
    ),
    sorted(DYNAMIC_LEGACY_OVERRIDES.map((item) => item.path)),
  );
});

test("SourcePath stays an external implementation pointer and Store URI stays non-web", async () => {
  const { output } = await dryRunPromise;
  const pointerWarnings = output.records.flatMap((record) =>
    record.metadata.warnings.filter(
      (warning) => warning.code === "external-implementation-pointer",
    ),
  );
  assert.equal(pointerWarnings.length, 66);
  assert.equal(
    output.records
      .flatMap((record) => [
        record.source.path,
        ...record.featuredSourceFiles.map((file) => file.path),
      ])
      .some((sourcePath) => sourcePath.includes("microsoft-ui-xaml")),
    false,
  );
  const animatedVisualPlayer = output.records.find(
    (record) => record.recordKey === "AnimatedVisualPlayer",
  );
  assert.equal(
    animatedVisualPlayer.documentation.some((document) =>
      document.url.startsWith("ms-windows-store:"),
    ),
    false,
  );
  assert.match(
    animatedVisualPlayer.metadata.warnings.find(
      (warning) => warning.code === "non-web-documentation-uri",
    ).message,
    /9N3J5TG8FF7F/,
  );
});

test("upstream editorial badges never become portal PR activity", async () => {
  const { output } = await dryRunPromise;
  const badges = output.records.flatMap(
    (record) => record.badges.upstreamEditorial,
  );
  assert.equal(
    badges.filter((badge) => badge.id === "upstream-new").length,
    16,
  );
  assert.equal(
    badges.filter((badge) => badge.id === "upstream-updated").length,
    7,
  );
  assert.equal(
    badges.every((badge) => badge.label.startsWith("Upstream editorial:")),
    true,
  );
  assert.equal(
    output.records.every(
      (record) =>
        JSON.stringify(record.badges.portalLifecycle) ===
        JSON.stringify(["new"]),
    ),
    true,
  );
});

test("portal lifecycle badges derive from committed multi-sync history", async () => {
  const state = await loadExternalState();
  for (const provider of state.providers.values()) {
    provider.enabled = provider.id === "winui-gallery";
  }
  const history = state.histories.get("winui-gallery");
  const priorSync = {
    id: "winui-gallery@prior-reviewed",
    reviewedAt: "2025-01-01T00:00:00Z",
    lockCommitSha: "0".repeat(40),
  };
  history.syncs.unshift(priorSync);
  const updatedId = history.records[0].id;
  const unchangedId = history.records[1].id;
  history.records.forEach((record, index) => {
    record.firstSeenSync = priorSync.id;
    record.lastChangedSync =
      index === 0 ? history.latestSyncId : priorSync.id;
  });

  const catalog = await generateExternalCatalog({ state });
  assert.deepEqual(
    catalog.records.find((record) => record.id === updatedId).badges
      .portalLifecycle,
    ["updated"],
  );
  assert.deepEqual(
    catalog.records.find((record) => record.id === unchangedId).badges
      .portalLifecycle,
    [],
  );
  assert.equal(
    catalog.records.every(
      (record) => record.lifecycle.firstSeenSync === priorSync.id,
    ),
    true,
  );
});

test("offline dry generation is byte-identical and makes zero network calls", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => {
    throw new Error("network must not be used");
  };
  try {
    const first = await dryRun();
    const second = await dryRun();
    assert.equal(
      canonicalStringify(second.output),
      canonicalStringify(first.output),
    );
    assert.equal(first.report.outputBytes, expectedOutputBytes);
    assert.equal(first.report.outputSha256, expectedOutputSha256);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("explicitly disabled providers leave the external catalog empty", async () => {
  const state = await loadExternalState();
  for (const provider of state.providers.values()) {
    provider.enabled = false;
  }
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => {
    throw new Error("network must not be used");
  };
  try {
    const merged = await generateExternalCatalog({ state });
    assert.deepEqual(merged.providers, []);
    assert.deepEqual(merged.records, []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("duplicate identity and silent deletion or rename remain review failures", async () => {
  const { output } = await dryRunPromise;
  const button = output.records.find((record) => record.recordKey === "Button");
  const duplicate = structuredClone(button);
  duplicate.id = "winui-gallery:DifferentRecord";
  assert.throws(
    () => validateGlobalIdentity([button, duplicate]),
    /duplicate route slug/,
  );

  const deleted = diffCatalogLifecycle([button], []);
  assert.deepEqual(deleted.unreviewedRemovals, [button.id]);
  assert.throws(
    () => assertReviewedLifecycleDiff(deleted),
    /without reviewed tombstones/,
  );

  const renamed = structuredClone(button);
  renamed.id = "winui-gallery:RenamedButton";
  renamed.recordKey = "RenamedButton";
  renamed.route.slug = createRouteSlug("winui-gallery", renamed.recordKey);
  renamed.route.path = `samples/${renamed.route.slug}`;
  const possibleRename = diffCatalogLifecycle([button], [renamed]);
  assert.deepEqual(possibleRename.ambiguousRenames, [
    {
      fromId: button.id,
      candidateIds: [renamed.id],
    },
  ]);
  assert.throws(
    () => assertReviewedLifecycleDiff(possibleRename),
    /explicit decision/,
  );
});

test("committed cache hits offline and cold or corrupt payloads fail closed", async (t) => {
  const state = await loadExternalState();
  const entry = [...state.cacheEntries.values()].find(
    (candidate) =>
      candidate.providerId === "winui-gallery" &&
      candidate.path.endsWith("ButtonPage.xaml"),
  );
  const bytes = await readCacheEntry(state, entry, {
    repoRoot: repositoryRoot,
  });
  assert.equal(bytes.byteLength, entry.size);

  const coldRoot = await mkdtemp(path.join(tmpdir(), "gallery-cold-"));
  t.after(() => rm(coldRoot, { recursive: true, force: true }));
  await assert.rejects(
    readCacheEntry(state, entry, { repoRoot: coldRoot }),
    /unavailable offline/,
  );

  const corruptPath = path.join(
    coldRoot,
    "external",
    "cache",
    ...entry.cachePath.split("/"),
  );
  await mkdir(path.dirname(corruptPath), { recursive: true });
  await writeFile(corruptPath, Buffer.alloc(entry.size, 0x20));
  await assert.rejects(
    readCacheEntry(state, entry, { repoRoot: coldRoot }),
    /SHA-256 mismatch/,
  );
});

test("corrupt image signatures fail even when cache hashes match", async (t) => {
  const state = await loadExternalState();
  const template = [...state.cacheEntries.values()].find(
    (candidate) =>
      candidate.providerId === "winui-gallery" &&
      candidate.mediaType === "image/png",
  );
  const root = await mkdtemp(path.join(tmpdir(), "gallery-image-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const bytes = Buffer.from("not a PNG payload", "utf8");
  const sha256 = sha256Hex(bytes);
  const entry = {
    ...template,
    blobSha: gitBlobSha(bytes),
    sha256,
    size: bytes.byteLength,
    cachePath: expectedCachePath(sha256),
  };
  const payloadPath = path.join(
    root,
    "external",
    "cache",
    ...entry.cachePath.split("/"),
  );
  await mkdir(path.dirname(payloadPath), { recursive: true });
  await writeFile(payloadPath, bytes);
  await assert.rejects(
    readCacheEntry(state, entry, { repoRoot: root }),
    /media signature/,
  );
});

test("root MIT license is pinned and decorative integration metadata is explicit", async () => {
  const [{ output }, review, licenseBytes] = await Promise.all([
    dryRunPromise,
    readFile(
      path.join(
        repositoryRoot,
        "external",
        "curation",
        "winui-gallery",
        "review.json",
      ),
      "utf8",
    ).then(JSON.parse),
    readFile(
      path.join(
        repositoryRoot,
        "external",
        "curation",
        "winui-gallery",
        "LICENSE",
      ),
    ),
  ]);
  assert.equal(gitBlobSha(licenseBytes), PINNED_SNAPSHOT.licenseBlobSha);
  assert.equal(licenseBytes.byteLength, PINNED_SNAPSHOT.licenseSize);
  assert.equal(review.pin.license.spdxId, "MIT");
  assert.equal(review.pin.license.noticeFilePresent, false);
  assert.equal(review.pin.license.thirdPartyFilePresent, false);
  assert.equal(review.imagePolicy.normalizedDecorative, true);
  assert.equal(review.imagePolicy.integratedAltBesideVisibleTitle, "");
  assert.equal(
    review.links.appDeepLinkTemplate,
    "winui3gallery://item/{UniqueId}",
  );
  assert.deepEqual(output.licenseManifest.entries.map((entry) => entry.id), [
    "winui-gallery:root",
  ]);
  assert.equal(
    output.records.every((record) =>
      record.attribution.licenseRefs.includes("winui-gallery:root"),
    ),
    true,
  );
});

test("Gallery publication marker ignores unrelated provider updates", async () => {
  const state = await loadExternalState();
  const stateCommit = JSON.parse(
    await readFile(
      path.join(
        repositoryRoot,
        "external",
        "curation",
        "winui-gallery",
        "state-commit.json",
      ),
      "utf8",
    ),
  );
  const unrelated = {
    ...state,
    locks: new Map(state.locks).set("other-provider", {
      providerId: "other-provider",
    }),
    cacheManifest: {
      ...state.cacheManifest,
      entries: [
        ...state.cacheManifest.entries,
        { providerId: "other-provider" },
      ],
    },
    histories: new Map(state.histories).set("other-provider", {
      providerId: "other-provider",
    }),
  };
  assert.equal(
    validateStateCommit(
      stateCommit,
      unrelated,
      stateCommit.providerFiles,
    ),
    true,
  );

  const changedGallery = {
    ...state,
    locks: new Map(state.locks).set("winui-gallery", {
      ...state.locks.get("winui-gallery"),
      commitSha: "0".repeat(40),
    }),
  };
  assert.throws(
    () =>
      validateStateCommit(
        stateCommit,
        changedGallery,
        stateCommit.providerFiles,
      ),
    /publication is incomplete/,
  );
  assert.throws(
    () =>
      validateStateCommit(stateCommit, state, {
        ...stateCommit.providerFiles,
        reviewSha256: "0".repeat(64),
      }),
    /publication is incomplete/,
  );
});
