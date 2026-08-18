import {
  mkdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

import {
  expectedCachePath,
} from "../lib/config.mjs";
import { createRouteSlug } from "../lib/identity.mjs";
import {
  gitBlobSha,
  sha256Hex,
} from "../lib/canonical.mjs";

const fixtureRoot = path.resolve(
  "tools",
  "external-catalog",
  "fixtures",
  "records",
);

export async function loadRecordFixture(name) {
  return JSON.parse(
    await readFile(path.join(fixtureRoot, `${name}.json`), "utf8"),
  );
}

export function clone(value) {
  return structuredClone(value);
}

export function createSecondGalleryRecord(record) {
  const result = clone(record);
  result.id = "winui-gallery:TextBlockPage";
  result.recordKey = "TextBlockPage";
  result.route.slug = createRouteSlug("winui-gallery", result.recordKey);
  result.route.path = `samples/${result.route.slug}`;
  result.title.display = "Present read-only text";
  result.title.upstream = "Text block";
  result.source.path = "WinUIGallery/ControlInfoData.json";
  result.lifecycle = {
    status: "active",
    firstSeenSync: "gallery-fixture-sync-1",
    lastReviewedSync: "gallery-fixture-sync-1",
    lastChangedSync: "gallery-fixture-sync-1",
    removedAtSync: null,
  };
  return result;
}

export async function createEnabledGalleryState(repoRoot, records) {
  const bytes = Buffer.from('{"fixture":true}\n', "utf8");
  const sha256 = sha256Hex(bytes);
  const cachePath = expectedCachePath(sha256);
  const artifact = {
    path: "WinUIGallery/ControlInfoData.json",
    blobSha: gitBlobSha(bytes),
    sha256,
    size: bytes.byteLength,
    mediaType: "application/json",
    cachePath,
  };
  const imageBytes = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);
  const imageSha256 = sha256Hex(imageBytes);
  const imageArtifact = {
    path: "WinUIGallery/Assets/ControlImages/Button.png",
    blobSha: gitBlobSha(imageBytes),
    sha256: imageSha256,
    size: imageBytes.byteLength,
    mediaType: "image/png",
    cachePath: expectedCachePath(imageSha256),
  };
  const lock = {
    providerId: "winui-gallery",
    repository: {
      owner: "microsoft",
      name: "WinUI-Gallery",
    },
    ref: "main",
    commitSha: "cccccccccccccccccccccccccccccccccccccccc",
    treeSha: "dddddddddddddddddddddddddddddddddddddddd",
    commitTime: "2026-08-02T12:00:00Z",
    artifacts: [artifact, imageArtifact],
  };
  const provider = {
    id: "winui-gallery",
    name: "WinUI Gallery",
    kind: "external",
    enabled: true,
    repository: {
      owner: "microsoft",
      name: "WinUI-Gallery",
    },
    adapterModule: "tools/external-catalog/providers/winui-gallery/index.mjs",
    refreshModule: "tools/external-catalog/refresh/winui-gallery.mjs",
    routeNamespace: "winui-gallery",
    sourceUnit: {
      name: "ControlInfoData page",
      granularity: "One UniqueId page is one record; examples remain nested.",
    },
    recordKey: {
      sourceField: "UniqueId",
      immutable: true,
    },
    allowedSourceRoots: ["WinUIGallery"],
    completenessPolicy: "not-enforced",
    expectedRecordCount: null,
  };
  const entries = [artifact, imageArtifact].map((item) => ({
    providerId: provider.id,
    repository: lock.repository,
    commitSha: lock.commitSha,
    treeSha: lock.treeSha,
    ...item,
  }));
  const entry = entries[0];
  const reviewedSync = {
    id: "gallery-fixture-sync-1",
    reviewedAt: "2026-08-10T12:00:00Z",
    lockCommitSha: lock.commitSha,
  };
  const history = {
    providerId: provider.id,
    latestSyncId: reviewedSync.id,
    syncs: [reviewedSync],
    records: records.map((record) => ({
      id: record.id,
      recordKey: record.recordKey,
      routePath: record.route.path,
      ...record.lifecycle,
    })),
  };
  const state = {
    registry: {
      schemaVersion: 1,
      providers: [provider],
    },
    lockFile: {
      schemaVersion: 1,
      locks: [lock],
    },
    cacheManifest: {
      schemaVersion: 1,
      entries,
    },
    historyFile: {
      schemaVersion: 1,
      providers: [history],
    },
    hashes: {
      registrySha256: "1".repeat(64),
      lockFileSha256: "2".repeat(64),
      cacheManifestSha256: "3".repeat(64),
      historySha256: "4".repeat(64),
    },
    providers: new Map([[provider.id, provider]]),
    locks: new Map([[provider.id, lock]]),
    cacheEntries: new Map(
      entries.map((item) => [
        `${provider.id}\0${lock.commitSha}\0${item.path}`,
        item,
      ]),
    ),
    histories: new Map([[provider.id, history]]),
  };

  const payloadPath = path.join(
    repoRoot,
    "external",
    "cache",
    ...cachePath.split("/"),
  );
  await mkdir(path.dirname(payloadPath), { recursive: true });
  await writeFile(payloadPath, bytes);
  const imagePayloadPath = path.join(
    repoRoot,
    "external",
    "cache",
    ...imageArtifact.cachePath.split("/"),
  );
  await mkdir(path.dirname(imagePayloadPath), { recursive: true });
  await writeFile(imagePayloadPath, imageBytes);

  const output = {
    schemaVersion: 1,
    providerId: provider.id,
    reviewedSync,
    lock,
    records,
    redirects: [],
    tombstones: [],
    licenseManifest: null,
  };
  return { state, output, payloadPath, entry, bytes };
}
