import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { createServer } from "node:net";
import path from "node:path";

import {
  atomicWriteCanonicalJson,
  atomicWriteFile,
  gitBlobSha,
  hashCanonicalJson,
  sha256Hex,
} from "../lib/canonical.mjs";
import {
  expectedCachePath,
  loadExternalState,
} from "../lib/config.mjs";
import {
  findExactGitEntry,
  validateCachedArtifact,
  validateTextArtifact,
} from "../lib/guards.mjs";
import { createRouteSlug } from "../lib/identity.mjs";
import {
  AUXILIARY_SOURCES,
  CATALOG_PATH,
  DYNAMIC_LEGACY_OVERRIDES,
  EXPECTED,
  PINNED_SNAPSHOT,
  PROVIDER_ID,
  REVIEWED_SYNC,
  ROOT_LICENSE_PATH,
  UPSTREAM_SCHEMA_PATH,
  mediaTypeForPath,
  pagePaths,
  repositoryUrl,
} from "../providers/winui-gallery/constants.mjs";
import {
  parsePinnedUpstreamSchema,
  resolveImagePath,
  validateAndFlattenCatalog,
  validateUpstreamSchema,
} from "../providers/winui-gallery/catalog.mjs";
import {
  decodeUtf8,
  parseControlExamples,
  parseSampleDefinition,
} from "../providers/winui-gallery/parser.mjs";

const refreshConcurrency = 12;

function fail(message) {
  throw new Error(`${PROVIDER_ID}: ${message}`);
}

function unique(values) {
  return [...new Set(values)];
}

function filename(sourcePath) {
  return sourcePath.slice(sourcePath.lastIndexOf("/") + 1);
}

function withoutTextExtension(sourcePath) {
  return filename(sourcePath).replace(/\.txt$/, "");
}

function parseJson(bytes, sourcePath) {
  try {
    return JSON.parse(decodeUtf8(bytes, sourcePath));
  } catch (error) {
    fail(`${sourcePath}: invalid JSON: ${error.message}`);
  }
}

function expectedRepository(provider) {
  if (
    provider.id !== PROVIDER_ID ||
    provider.repository.owner !== PINNED_SNAPSHOT.owner ||
    provider.repository.name !== PINNED_SNAPSHOT.repository
  ) {
    fail("provider registry identity drifted");
  }
  return {
    owner: PINNED_SNAPSHOT.owner,
    repository: PINNED_SNAPSHOT.repository,
  };
}

function assertCommitIdentity(commit) {
  if (
    commit.sha !== PINNED_SNAPSHOT.commitSha ||
    commit.tree?.sha !== PINNED_SNAPSHOT.treeSha ||
    commit.committer?.date !== PINNED_SNAPSHOT.commitTime
  ) {
    fail("Git commit response does not match the approved immutable snapshot");
  }
}

function assertNoAdditionalLicenseFiles(tree) {
  const unexpected = tree.filter((entry) => {
    const name = filename(entry.path);
    return (
      entry.type === "blob" &&
      entry.path !== ROOT_LICENSE_PATH &&
      /^(?:notice|third[-_. ]?party(?:notices?)?)(?:[._-].*)?$/i.test(name)
    );
  });
  if (unexpected.length > 0) {
    fail(
      `unexpected NOTICE/third-party files require review: ${unexpected
        .map((entry) => entry.path)
        .sort()
        .join(", ")}`,
    );
  }
}

async function mapLimit(values, limit, action) {
  const results = new Array(values.length);
  let cursor = 0;
  async function worker() {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await action(values[index], index);
    }
  }
  await Promise.all(
    Array.from(
      { length: Math.min(limit, values.length) },
      () => worker(),
    ),
  );
  return results;
}

export async function fetchGitBlob({
  github,
  repository,
  owner,
  name,
  entry,
}) {
  const url = github.repositoryUrl(owner, name, `git/blobs/${entry.sha}`);
  const response = await github.requestJson(url, { repository });
  const value = response.value;
  if (
    value?.sha !== entry.sha ||
    value?.encoding !== "base64" ||
    typeof value.content !== "string"
  ) {
    fail(`${entry.path}: Git blob response identity or encoding mismatch`);
  }
  const bytes = Buffer.from(value.content.replace(/\s/g, ""), "base64");
  if (
    value.size !== entry.size ||
    bytes.byteLength !== entry.size ||
    gitBlobSha(bytes) !== entry.sha
  ) {
    fail(`${entry.path}: downloaded bytes do not match the Git tree blob`);
  }
  return {
    bytes,
    etag: response.etag ?? null,
    notModified: response.notModified,
  };
}

function createBlobLoader({ github, repository, tree, owner, name }) {
  const promises = new Map();
  return async function load(sourcePath) {
    if (!promises.has(sourcePath)) {
      const entry = findExactGitEntry(tree, sourcePath);
      promises.set(
        sourcePath,
        fetchGitBlob({
          github,
          repository,
          owner,
          name,
          entry,
        }).then((result) => result.bytes),
      );
    }
    return promises.get(sourcePath);
  };
}

function assertExactSiblingSources(tree, pages) {
  const expectedAuxiliary = new Set(Object.values(AUXILIARY_SOURCES).flat());
  const discoveredAuxiliary = [];
  for (const page of pages) {
    const directory = `WinUIGallery/Samples/${page.UniqueId}`;
    const expectedPagePaths = new Set(pagePaths(page.UniqueId));
    const siblings = tree
      .filter(
        (entry) =>
          entry.type === "blob" &&
          entry.path.startsWith(`${directory}/`) &&
          !entry.path.slice(directory.length + 1).includes("/") &&
          /\.(?:xaml|cs)$/.test(entry.path),
      )
      .map((entry) => entry.path);
    for (const expected of expectedPagePaths) {
      findExactGitEntry(tree, expected);
    }
    for (const sibling of siblings) {
      if (!expectedPagePaths.has(sibling)) {
        discoveredAuxiliary.push(sibling);
      }
    }
  }
  const discovered = new Set(discoveredAuxiliary);
  const missing = [...expectedAuxiliary].filter((item) => !discovered.has(item));
  const extra = [...discovered].filter((item) => !expectedAuxiliary.has(item));
  if (missing.length > 0 || extra.length > 0) {
    fail(
      `sibling source inventory drifted; missing=[${missing.sort().join(", ")}], extra=[${extra.sort().join(", ")}]`,
    );
  }
}

function assertDefinitionInventory(tree, referencedDefinitions) {
  const available = new Set(
    tree
      .filter(
        (entry) =>
          entry.type === "blob" &&
          entry.path.startsWith("WinUIGallery/Samples/") &&
          !entry.path.startsWith("WinUIGallery/Samples/SampleCode/") &&
          entry.path.endsWith(".txt"),
      )
      .map((entry) => entry.path),
  );
  const missing = [...referencedDefinitions].filter(
    (sourcePath) => !available.has(sourcePath),
  );
  const unreferenced = [...available].filter(
    (sourcePath) => !referencedDefinitions.has(sourcePath),
  );
  if (missing.length > 0 || unreferenced.length > 0) {
    fail(
      `SampleDefinition inventory drifted; missing=[${missing.sort().join(", ")}], unreferenced=[${unreferenced.sort().join(", ")}]`,
    );
  }
}

function buildLockArtifact(sourcePath, entry, bytes) {
  const sha256 = sha256Hex(bytes);
  return {
    path: sourcePath,
    blobSha: entry.sha,
    sha256,
    size: bytes.byteLength,
    mediaType: mediaTypeForPath(sourcePath),
    cachePath: expectedCachePath(sha256),
  };
}

function replaceProvider(values, providerId, replacement, key) {
  return [
    ...values.filter((value) => key(value) !== providerId),
    replacement,
  ];
}

function buildHistory(pages) {
  return {
    providerId: PROVIDER_ID,
    latestSyncId: REVIEWED_SYNC.id,
    syncs: [{ ...REVIEWED_SYNC }],
    records: pages.map((page) => {
      const slug = createRouteSlug(PROVIDER_ID, page.UniqueId);
      return {
        id: `${PROVIDER_ID}:${page.UniqueId}`,
        recordKey: page.UniqueId,
        routePath: `samples/${slug}`,
        status: "active",
        firstSeenSync: REVIEWED_SYNC.id,
        lastReviewedSync: REVIEWED_SYNC.id,
        lastChangedSync: REVIEWED_SYNC.id,
        removedAtSync: null,
      };
    }),
  };
}

function buildLicenseManifest() {
  return {
    schemaVersion: 1,
    providerId: PROVIDER_ID,
    repository: {
      owner: PINNED_SNAPSHOT.owner,
      name: PINNED_SNAPSHOT.repository,
    },
    lockedCommitSha: PINNED_SNAPSHOT.commitSha,
    entries: [
      {
        id: `${PROVIDER_ID}:root`,
        scopePath: "",
        spdxId: "MIT",
        licensePath: ROOT_LICENSE_PATH,
        licenseUrl: `${repositoryUrl()}/blob/${PINNED_SNAPSHOT.commitSha}/${ROOT_LICENSE_PATH}`,
        attributionText: null,
      },
    ],
  };
}

function buildReviewDocument({
  selectedSourcePaths,
  imagePaths,
  logicalCacheBytes,
  uniqueCacheBytes,
}) {
  return {
    schemaVersion: 1,
    providerId: PROVIDER_ID,
    repository: {
      owner: PINNED_SNAPSHOT.owner,
      name: PINNED_SNAPSHOT.repository,
    },
    pin: {
      ref: PINNED_SNAPSHOT.ref,
      commitSha: PINNED_SNAPSHOT.commitSha,
      treeSha: PINNED_SNAPSHOT.treeSha,
      commitTime: PINNED_SNAPSHOT.commitTime,
      catalog: {
        path: CATALOG_PATH,
        blobSha: PINNED_SNAPSHOT.catalogBlobSha,
        size: PINNED_SNAPSHOT.catalogSize,
      },
      upstreamSchema: {
        path: UPSTREAM_SCHEMA_PATH,
        blobSha: PINNED_SNAPSHOT.schemaBlobSha,
        size: PINNED_SNAPSHOT.schemaSize,
        underSpecifiedFields: ["BaseClasses", "SourcePath"],
        defaultsApplied: false,
      },
      license: {
        path: ROOT_LICENSE_PATH,
        blobSha: PINNED_SNAPSHOT.licenseBlobSha,
        size: PINNED_SNAPSHOT.licenseSize,
        spdxId: "MIT",
        cachedPath: "external/curation/winui-gallery/LICENSE",
        noticeFilePresent: false,
        thirdPartyFilePresent: false,
      },
    },
    granularity: {
      recordSource: "ControlInfoData.Groups[].Items[].UniqueId",
      recordCount: EXPECTED.records,
      groupsAreCategories: true,
      controlExamplesAreNested: true,
      sampleDefinitionsAreNested: true,
    },
    inventory: {
      groups: EXPECTED.groups,
      specialRecords: EXPECTED.specialRecords,
      controlExamples: EXPECTED.controlExamples,
      sampleDefinitions: EXPECTED.sampleDefinitions,
      nestedCodeUnits: EXPECTED.nestedCodeUnits,
      selectedSourceFiles: selectedSourcePaths.length,
      selectedSourceBytes: EXPECTED.selectedSourceBytes,
      uniqueImages: imagePaths.length,
      imageBytes: 499589,
      lockedArtifacts: EXPECTED.lockedArtifacts,
      logicalCacheBytes,
      uniqueCacheBytes,
      cachedFilesIncludingLicense: EXPECTED.cachedFilesIncludingLicense,
      cachedBytesIncludingLicense: EXPECTED.cachedBytesIncludingLicense,
    },
    sourcePolicy: {
      pagePairTemplate:
        "WinUIGallery/Samples/{UniqueId}/{UniqueId}Page.xaml[.cs]",
      rawUrlTemplate:
        `https://raw.githubusercontent.com/${PINNED_SNAPSHOT.owner}/${PINNED_SNAPSHOT.repository}/${PINNED_SNAPSHOT.commitSha}/{path}`,
      dynamicLegacyOverrides: DYNAMIC_LEGACY_OVERRIDES,
      auxiliarySources: Object.values(AUXILIARY_SOURCES).flat(),
      unreferencedLegacySampleCodeIncluded: false,
      largeJsonSampleDataIncluded: false,
      sourcePathRepository: "microsoft/microsoft-ui-xaml",
      sourcePathCombinedWithGalleryPin: false,
    },
    imagePolicy: {
      role: "icon",
      screenshot: false,
      integratedAltBesideVisibleTitle: "",
      privateUseGroupGlyphUsed: false,
      reviewedCaseCorrections: {
        "WinUIGallery/Assets/ControlImages/CheckBox.png":
          "WinUIGallery/Assets/ControlImages/Checkbox.png",
        "WinUIGallery/Assets/ControlImages/AnnotatedScrollbar.png":
          "WinUIGallery/Assets/ControlImages/AnnotatedScrollBar.png",
      },
    },
    links: {
      repository: repositoryUrl(),
      commit: `${repositoryUrl()}/commit/${PINNED_SNAPSHOT.commitSha}`,
      tree: `${repositoryUrl()}/tree/${PINNED_SNAPSHOT.commitSha}`,
      appDeepLinkTemplate: "winui3gallery://item/{UniqueId}",
    },
  };
}

function publishLockEndpoint(repositoryRoot) {
  const resolved = path.resolve(repositoryRoot);
  const normalized =
    process.platform === "win32" ? resolved.toLowerCase() : resolved;
  const digest = sha256Hex(normalized).slice(0, 32);
  if (process.platform === "win32") {
    return `\\\\.\\pipe\\winui-samples-external-catalog-${digest}`;
  }
  if (process.platform === "linux") {
    return `\0winui-samples-external-catalog-${digest}`;
  }
  return {
    host: "127.0.0.1",
    port: 49152 + (Number.parseInt(digest.slice(0, 4), 16) % 16384),
    exclusive: true,
  };
}

export async function acquirePublishLock(repositoryRoot) {
  const server = createServer((socket) => socket.destroy());
  const endpoint = publishLockEndpoint(await realpath(repositoryRoot));
  await new Promise((resolve, reject) => {
    function onError(error) {
      if (error.code === "EADDRINUSE") {
        reject(
          new Error(
            `${PROVIDER_ID}: another external catalog refresh is publishing state`,
          ),
        );
      } else {
        reject(error);
      }
    }
    server.once("error", onError);
    server.listen(endpoint, () => {
      server.off("error", onError);
      resolve();
    });
  });

  let released = false;
  return async () => {
    if (released) {
      return;
    }
    released = true;
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  };
}

function providerStateProjection(state) {
  return {
    lock: state.locks.get(PROVIDER_ID) ?? null,
    cacheEntries: state.cacheManifest.entries.filter(
      (entry) => entry.providerId === PROVIDER_ID,
    ),
    history: state.histories.get(PROVIDER_ID) ?? null,
  };
}

function assertProviderStateUnchanged(previousState, currentState) {
  if (
    hashCanonicalJson(providerStateProjection(previousState)) !==
    hashCanonicalJson(providerStateProjection(currentState))
  ) {
    fail("WinUI Gallery state changed while the refresh was being prepared");
  }
}

function providerPublicationPaths(repositoryRoot) {
  return {
    cachedLicense: path.join(
      repositoryRoot,
      "external",
      "curation",
      PROVIDER_ID,
      "LICENSE",
    ),
    review: path.join(
      repositoryRoot,
      "external",
      "curation",
      PROVIDER_ID,
      "review.json",
    ),
    licenseManifest: path.join(
      repositoryRoot,
      "external",
      "licenses",
      `${PROVIDER_ID}.json`,
    ),
    stateCommit: path.join(
      repositoryRoot,
      "external",
      "curation",
      PROVIDER_ID,
      "state-commit.json",
    ),
  };
}

async function readOptionalFile(filePath) {
  try {
    return await readFile(filePath);
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function readProviderPublicationHashes(repositoryRoot) {
  const paths = providerPublicationPaths(repositoryRoot);
  const [cachedLicense, review, licenseManifest, stateCommit] =
    await Promise.all([
      readOptionalFile(paths.cachedLicense),
      readOptionalFile(paths.review),
      readOptionalFile(paths.licenseManifest),
      readOptionalFile(paths.stateCommit),
    ]);
  function jsonHash(bytes, sourcePath) {
    if (bytes === null) {
      return null;
    }
    try {
      return hashCanonicalJson(JSON.parse(bytes.toString("utf8")));
    } catch (error) {
      fail(`${sourcePath}: cannot parse provider publication: ${error.message}`);
    }
  }
  return {
    cachedLicenseSha256:
      cachedLicense === null ? null : sha256Hex(cachedLicense),
    reviewSha256: jsonHash(review, paths.review),
    licenseManifestSha256: jsonHash(
      licenseManifest,
      paths.licenseManifest,
    ),
    stateCommitSha256: jsonHash(stateCommit, paths.stateCommit),
  };
}

function assertProviderPublicationUnchanged(previous, current) {
  if (hashCanonicalJson(previous) !== hashCanonicalJson(current)) {
    fail("WinUI Gallery curation/license publication changed during refresh");
  }
}

function buildStateCommit(
  lock,
  cacheEntries,
  history,
  providerFiles,
) {
  return {
    schemaVersion: 1,
    providerId: PROVIDER_ID,
    lockCommitSha: PINNED_SNAPSHOT.commitSha,
    documents: {
      providerLockSha256: hashCanonicalJson(lock),
      providerCacheEntriesSha256: hashCanonicalJson(cacheEntries),
      providerHistorySha256: hashCanonicalJson(history),
    },
    providerFiles,
  };
}

async function materializeCache({
  repositoryRoot,
  payloads,
}) {
  const cacheRoot = path.join(repositoryRoot, "external", "cache");
  await mkdir(cacheRoot, { recursive: true });
  const stage = await mkdtemp(
    path.join(cacheRoot, ".winui-gallery-refresh-"),
  );
  const uniquePayloads = new Map();
  for (const payload of payloads) {
    uniquePayloads.set(payload.sha256, payload.bytes);
  }

  try {
    for (const [sha256, bytes] of uniquePayloads) {
      await writeFile(path.join(stage, sha256), bytes);
    }
    for (const [sha256, bytes] of uniquePayloads) {
      const relative = expectedCachePath(sha256);
      const destination = path.join(cacheRoot, ...relative.split("/"));
      let existing = null;
      try {
        existing = await readFile(destination);
      } catch (error) {
        if (error.code !== "ENOENT") {
          throw error;
        }
      }
      if (existing) {
        if (
          existing.byteLength !== bytes.byteLength ||
          sha256Hex(existing) !== sha256
        ) {
          fail(`existing content-addressed cache blob is corrupt: ${relative}`);
        }
        continue;
      }
      await mkdir(path.dirname(destination), { recursive: true });
      await rename(path.join(stage, sha256), destination);
    }
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
  return {
    uniqueFiles: uniquePayloads.size,
    uniqueBytes: [...uniquePayloads.values()].reduce(
      (total, bytes) => total + bytes.byteLength,
      0,
    ),
  };
}

export async function refresh({
  provider,
  state,
  repositoryRoot,
  github,
}) {
  const repository = expectedRepository(provider);
  const initialProviderPublication =
    await readProviderPublicationHashes(repositoryRoot);
  const { owner, repository: name } = repository;
  const commitResponse = await github.requestJson(
    github.repositoryUrl(owner, name, `git/commits/${PINNED_SNAPSHOT.commitSha}`),
    { repository },
  );
  assertCommitIdentity(commitResponse.value);
  const tree = await github.fetchTree(owner, name, PINNED_SNAPSHOT.treeSha);
  assertNoAdditionalLicenseFiles(tree);
  const treeByPath = new Map(tree.map((entry) => [entry.path, entry]));
  if (treeByPath.size !== tree.length) {
    fail("Git tree contains duplicate paths");
  }

  const loadBlob = createBlobLoader({
    github,
    repository,
    tree,
    owner,
    name,
  });
  const [catalogBytes, schemaBytes, licenseBytes] = await mapLimit(
    [CATALOG_PATH, UPSTREAM_SCHEMA_PATH, ROOT_LICENSE_PATH],
    3,
    loadBlob,
  );
  const catalogEntry = findExactGitEntry(tree, CATALOG_PATH);
  const schemaEntry = findExactGitEntry(tree, UPSTREAM_SCHEMA_PATH);
  const licenseEntry = findExactGitEntry(tree, ROOT_LICENSE_PATH);
  for (const [label, entry, bytes, expectedSha, expectedSize] of [
    [
      "catalog",
      catalogEntry,
      catalogBytes,
      PINNED_SNAPSHOT.catalogBlobSha,
      PINNED_SNAPSHOT.catalogSize,
    ],
    [
      "schema",
      schemaEntry,
      schemaBytes,
      PINNED_SNAPSHOT.schemaBlobSha,
      PINNED_SNAPSHOT.schemaSize,
    ],
    [
      "license",
      licenseEntry,
      licenseBytes,
      PINNED_SNAPSHOT.licenseBlobSha,
      PINNED_SNAPSHOT.licenseSize,
    ],
  ]) {
    if (
      entry.sha !== expectedSha ||
      entry.size !== expectedSize ||
      bytes.byteLength !== expectedSize
    ) {
      fail(`${label} blob identity drifted`);
    }
  }
  validateTextArtifact({
    path: "WinUIGallery/LICENSE.txt",
    bytes: licenseBytes,
  });

  const catalog = parseJson(catalogBytes, CATALOG_PATH);
  validateUpstreamSchema(
    parsePinnedUpstreamSchema(
      decodeUtf8(schemaBytes, UPSTREAM_SCHEMA_PATH),
    ),
  );
  const pages = validateAndFlattenCatalog(catalog);
  assertExactSiblingSources(tree, pages);

  const pageXamlPaths = pages.map((page) => pagePaths(page.UniqueId)[0]);
  const pageXamlBytes = await mapLimit(
    pageXamlPaths,
    refreshConcurrency,
    loadBlob,
  );
  const pageXaml = new Map(
    pageXamlPaths.map((sourcePath, index) => [
      sourcePath,
      pageXamlBytes[index],
    ]),
  );
  const referencedDefinitions = new Set();
  const pageExamples = new Map();
  let controlExampleCount = 0;
  let controlExamplePages = 0;
  for (const page of pages) {
    const sourcePath = pagePaths(page.UniqueId)[0];
    const examples = parseControlExamples(
      decodeUtf8(pageXaml.get(sourcePath), sourcePath),
      sourcePath,
    );
    pageExamples.set(page.UniqueId, examples);
    controlExampleCount += examples.length;
    if (examples.length > 0) {
      controlExamplePages += 1;
    }
    for (const example of examples) {
      if (!example.sampleDefinition) {
        continue;
      }
      const definition =
        `WinUIGallery/Samples/${example.sampleDefinition}`;
      if (!definition.startsWith(`WinUIGallery/Samples/${page.UniqueId}/`)) {
        fail(`${page.UniqueId}: SampleDefinition crosses its page directory`);
      }
      if (referencedDefinitions.has(definition)) {
        fail(`duplicate live SampleDefinition reference ${definition}`);
      }
      referencedDefinitions.add(definition);
    }
  }
  if (
    controlExampleCount !== EXPECTED.controlExamples ||
    controlExamplePages !== EXPECTED.controlExamplePages ||
    referencedDefinitions.size !== EXPECTED.sampleDefinitions
  ) {
    fail("ControlExample/SampleDefinition counts drifted");
  }
  assertDefinitionInventory(tree, referencedDefinitions);

  const definitionPaths = [...referencedDefinitions];
  const definitionBytes = await mapLimit(
    definitionPaths,
    refreshConcurrency,
    loadBlob,
  );
  definitionPaths.forEach((sourcePath, index) => {
    parseSampleDefinition(
      decodeUtf8(definitionBytes[index], sourcePath),
      sourcePath,
    );
  });

  const pageCodePaths = pages.map((page) => pagePaths(page.UniqueId)[1]);
  const pageCodeBytes = await mapLimit(
    pageCodePaths,
    refreshConcurrency,
    loadBlob,
  );
  const pageCode = new Map(
    pageCodePaths.map((sourcePath, index) => [
      sourcePath,
      pageCodeBytes[index],
    ]),
  );
  for (const dynamic of DYNAMIC_LEGACY_OVERRIDES) {
    findExactGitEntry(tree, dynamic.path);
    const [xamlPath, codePath] = pagePaths(dynamic.recordKey);
    const liveSource = [
      decodeUtf8(pageXaml.get(xamlPath), xamlPath),
      decodeUtf8(pageCode.get(codePath), codePath),
    ].join("\n");
    if (!liveSource.includes(withoutTextExtension(dynamic.path))) {
      fail(`dynamic legacy override is not live: ${dynamic.path}`);
    }
    if (
      !pageExamples
        .get(dynamic.recordKey)
        .some((example) => example.position === dynamic.examplePosition)
    ) {
      fail(`dynamic override targets a missing ControlExample: ${dynamic.path}`);
    }
  }

  const imagePaths = unique(
    pages.map((page) =>
      resolveImagePath(page.ImagePath, `${page.UniqueId}.ImagePath`).resolvedPath,
    ),
  );
  imagePaths.forEach((sourcePath) => findExactGitEntry(tree, sourcePath));

  const selectedSourcePaths = unique([
    ...pages.flatMap((page) => pagePaths(page.UniqueId)),
    ...Object.values(AUXILIARY_SOURCES).flat(),
    ...definitionPaths,
    ...DYNAMIC_LEGACY_OVERRIDES.map((item) => item.path),
  ]);
  const selectedSourceBytes = selectedSourcePaths.reduce(
    (total, sourcePath) =>
      total + findExactGitEntry(tree, sourcePath).size,
    0,
  );
  if (
    selectedSourcePaths.length !== EXPECTED.selectedSourceFiles ||
    selectedSourceBytes !== EXPECTED.selectedSourceBytes ||
    imagePaths.length !== EXPECTED.uniqueImages
  ) {
    fail("selected source/image inventory drifted");
  }

  const artifactPaths = unique([
    CATALOG_PATH,
    UPSTREAM_SCHEMA_PATH,
    ...selectedSourcePaths,
    ...imagePaths,
  ]).sort((left, right) => left.localeCompare(right, "en-US"));
  const logicalCacheBytes = artifactPaths.reduce(
    (total, sourcePath) =>
      total + findExactGitEntry(tree, sourcePath).size,
    0,
  );
  if (
    artifactPaths.length !== EXPECTED.lockedArtifacts ||
    logicalCacheBytes !== EXPECTED.lockedArtifactBytes
  ) {
    fail("locked artifact inventory drifted");
  }

  const artifactBytes = await mapLimit(
    artifactPaths,
    refreshConcurrency,
    loadBlob,
  );
  const lockArtifacts = artifactPaths.map((sourcePath, index) => {
    const entry = findExactGitEntry(tree, sourcePath);
    const bytes = artifactBytes[index];
    const mediaType = mediaTypeForPath(sourcePath);
    validateCachedArtifact({
      path: sourcePath,
      bytes,
      mediaType,
    });
    return buildLockArtifact(sourcePath, entry, bytes);
  });
  const lock = {
    providerId: PROVIDER_ID,
    repository: {
      owner: PINNED_SNAPSHOT.owner,
      name: PINNED_SNAPSHOT.repository,
    },
    ref: PINNED_SNAPSHOT.ref,
    commitSha: PINNED_SNAPSHOT.commitSha,
    treeSha: PINNED_SNAPSHOT.treeSha,
    commitTime: PINNED_SNAPSHOT.commitTime,
    artifacts: lockArtifacts,
  };
  const cacheEntries = lockArtifacts.map((artifact) => ({
    providerId: PROVIDER_ID,
    repository: lock.repository,
    commitSha: lock.commitSha,
    treeSha: lock.treeSha,
    ...artifact,
  }));

  const materialized = await materializeCache({
    repositoryRoot,
    payloads: lockArtifacts.map((artifact, index) => ({
      sha256: artifact.sha256,
      bytes: artifactBytes[index],
    })),
  });

  const locksPath = path.join(repositoryRoot, "external", "locks.json");
  const manifestPath = path.join(
    repositoryRoot,
    "external",
    "cache",
    "manifest.json",
  );
  const historyPath = path.join(repositoryRoot, "external", "history.json");
  const providerHistory = buildHistory(pages);
  const reviewDocument = buildReviewDocument({
    selectedSourcePaths,
    imagePaths,
    logicalCacheBytes,
    uniqueCacheBytes: materialized.uniqueBytes,
  });
  const curationRoot = path.join(
    repositoryRoot,
    "external",
    "curation",
    PROVIDER_ID,
  );
  const licensePath = path.join(
    repositoryRoot,
    "external",
    "licenses",
    `${PROVIDER_ID}.json`,
  );
  const licenseManifest = buildLicenseManifest();
  const providerFileHashes = {
    cachedLicenseSha256: sha256Hex(licenseBytes),
    reviewSha256: hashCanonicalJson(reviewDocument),
    licenseManifestSha256: hashCanonicalJson(licenseManifest),
  };
  const releasePublishLock = await acquirePublishLock(repositoryRoot);
  try {
    const currentState = await loadExternalState({
      registryPath: path.join(
        repositoryRoot,
        "external",
        "providers.json",
      ),
      locksPath,
      cacheManifestPath: manifestPath,
      historyPath,
    });
    assertProviderStateUnchanged(state, currentState);
    assertProviderPublicationUnchanged(
      initialProviderPublication,
      await readProviderPublicationHashes(repositoryRoot),
    );
    const lockFile = {
      ...currentState.lockFile,
      locks: replaceProvider(
        currentState.lockFile.locks,
        PROVIDER_ID,
        lock,
        (item) => item.providerId,
      ),
    };
    const cacheManifest = {
      ...currentState.cacheManifest,
      entries: [
        ...currentState.cacheManifest.entries.filter(
          (entry) => entry.providerId !== PROVIDER_ID,
        ),
        ...cacheEntries,
      ],
    };
    const historyFile = {
      ...currentState.historyFile,
      providers: replaceProvider(
        currentState.historyFile.providers,
        PROVIDER_ID,
        providerHistory,
        (item) => item.providerId,
      ),
    };

    await atomicWriteFile(path.join(curationRoot, "LICENSE"), licenseBytes);
    await atomicWriteCanonicalJson(
      path.join(curationRoot, "review.json"),
      reviewDocument,
    );
    await atomicWriteCanonicalJson(licensePath, licenseManifest);
    await atomicWriteCanonicalJson(locksPath, lockFile);
    await atomicWriteCanonicalJson(manifestPath, cacheManifest);
    await atomicWriteCanonicalJson(historyPath, historyFile);
    await atomicWriteCanonicalJson(
      path.join(curationRoot, "state-commit.json"),
      buildStateCommit(
        lock,
        cacheEntries,
        providerHistory,
        providerFileHashes,
      ),
    );
  } finally {
    await releasePublishLock();
  }

  const report = {
    providerId: PROVIDER_ID,
    commitSha: PINNED_SNAPSHOT.commitSha,
    treeSha: PINNED_SNAPSHOT.treeSha,
    records: pages.length,
    selectedSourceFiles: selectedSourcePaths.length,
    uniqueImages: imagePaths.length,
    lockedArtifacts: lockArtifacts.length,
    logicalCacheBytes,
    uniqueCacheFiles: materialized.uniqueFiles,
    uniqueCacheBytes: materialized.uniqueBytes,
    licenseBytes: licenseBytes.byteLength,
  };
  console.log(JSON.stringify(report, null, 2));
  return report;
}
