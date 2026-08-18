import { readFile } from "node:fs/promises";
import path from "node:path";

import { hashCanonicalJson } from "./canonical.mjs";
import {
  assertAllowedSourceRoot,
  assertSafePosixPath,
} from "./guards.mjs";
import { assertContract, repositoryRoot } from "./schema.mjs";

export const defaultRegistryPath = path.join(
  repositoryRoot,
  "external",
  "providers.json",
);
export const defaultLocksPath = path.join(
  repositoryRoot,
  "external",
  "locks.json",
);
export const defaultCacheManifestPath = path.join(
  repositoryRoot,
  "external",
  "cache",
  "manifest.json",
);
export const defaultHistoryPath = path.join(
  repositoryRoot,
  "external",
  "history.json",
);

function uniqueMap(values, key, context) {
  const result = new Map();
  for (const value of values) {
    const id = key(value);
    if (result.has(id)) {
      throw new Error(`duplicate ${context}: ${id}`);
    }
    result.set(id, value);
  }
  return result;
}

async function readJsonDocument(filePath) {
  let bytes;
  try {
    bytes = await readFile(filePath);
  } catch (error) {
    throw new Error(`cannot read ${filePath}: ${error.message}`);
  }

  try {
    const value = JSON.parse(bytes.toString("utf8"));
    return {
      filePath,
      bytes,
      sha256: hashCanonicalJson(value),
      value,
    };
  } catch (error) {
    throw new Error(`cannot parse ${filePath}: ${error.message}`);
  }
}

function sameRepository(left, right) {
  return left.owner === right.owner && left.name === right.name;
}

export function cacheEntryKey(providerId, commitSha, sourcePath) {
  return `${providerId}\0${commitSha}\0${sourcePath}`;
}

export function expectedCachePath(sha256) {
  return `blobs/sha256/${sha256.slice(0, 2)}/${sha256}`;
}

function assertRegistryInvariants(registry) {
  const providers = uniqueMap(
    registry.providers,
    (provider) => provider.id,
    "provider id",
  );
  const routeNamespaces = new Set();

  for (const provider of registry.providers) {
    for (const modulePath of [
      provider.adapterModule,
      provider.refreshModule,
      ...provider.allowedSourceRoots,
    ]) {
      assertSafePosixPath(modulePath);
    }
    if (routeNamespaces.has(provider.routeNamespace)) {
      throw new Error(
        `duplicate provider route namespace: ${provider.routeNamespace}`,
      );
    }
    routeNamespaces.add(provider.routeNamespace);
    if (provider.routeNamespace !== provider.id) {
      throw new Error(
        `${provider.id}: routeNamespace must equal the stable provider id`,
      );
    }
    if (
      provider.completenessPolicy === "enforced" &&
      !Number.isInteger(provider.expectedRecordCount)
    ) {
      throw new Error(
        `${provider.id}: enforced completeness requires expectedRecordCount`,
      );
    }
  }

  return providers;
}

function assertLockInvariants(lockFile, providers) {
  const locks = uniqueMap(
    lockFile.locks,
    (lock) => lock.providerId,
    "provider lock",
  );

  for (const lock of lockFile.locks) {
    const provider = providers.get(lock.providerId);
    if (!provider) {
      throw new Error(`lock references unknown provider ${lock.providerId}`);
    }
    if (!sameRepository(lock.repository, provider.repository)) {
      throw new Error(
        `${lock.providerId}: lock repository does not match provider registry`,
      );
    }

    const artifactPaths = new Set();
    for (const artifact of lock.artifacts) {
      assertSafePosixPath(artifact.path);
      assertAllowedSourceRoot(artifact.path, provider.allowedSourceRoots);
      if (artifactPaths.has(artifact.path)) {
        throw new Error(
          `${lock.providerId}: duplicate locked artifact ${artifact.path}`,
        );
      }
      artifactPaths.add(artifact.path);
      const expected = expectedCachePath(artifact.sha256);
      if (artifact.cachePath !== expected) {
        throw new Error(
          `${lock.providerId}:${artifact.path}: cachePath must be ${expected}`,
        );
      }
    }
  }
  return locks;
}

function assertCacheInvariants(cacheManifest, providers) {
  const entries = uniqueMap(
    cacheManifest.entries,
    (entry) => cacheEntryKey(entry.providerId, entry.commitSha, entry.path),
    "cache manifest source",
  );

  for (const entry of cacheManifest.entries) {
    const provider = providers.get(entry.providerId);
    if (!provider) {
      throw new Error(
        `cache manifest references unknown provider ${entry.providerId}`,
      );
    }
    if (!sameRepository(entry.repository, provider.repository)) {
      throw new Error(
        `${entry.providerId}:${entry.path}: cache repository does not match provider registry`,
      );
    }
    assertSafePosixPath(entry.path);
    assertAllowedSourceRoot(entry.path, provider.allowedSourceRoots);
    const expected = expectedCachePath(entry.sha256);
    if (entry.cachePath !== expected) {
      throw new Error(
        `${entry.providerId}:${entry.path}: cachePath must be ${expected}`,
      );
    }
  }
  return entries;
}

function assertHistoryInvariants(historyFile, providers) {
  const histories = uniqueMap(
    historyFile.providers,
    (history) => history.providerId,
    "provider sync history",
  );

  for (const history of historyFile.providers) {
    if (!providers.has(history.providerId)) {
      throw new Error(
        `sync history references unknown provider ${history.providerId}`,
      );
    }
    const syncs = uniqueMap(history.syncs, (sync) => sync.id, "reviewed sync id");
    const records = uniqueMap(
      history.records,
      (record) => record.id,
      "history record id",
    );
    if (!syncs.has(history.latestSyncId)) {
      throw new Error(
        `${history.providerId}: latestSyncId references unknown sync ${history.latestSyncId}`,
      );
    }
    for (const record of history.records) {
      if (!record.id.startsWith(`${history.providerId}:`)) {
        throw new Error(
          `${record.id}: history record does not match provider ${history.providerId}`,
        );
      }
      for (const syncId of [
        record.firstSeenSync,
        record.lastReviewedSync,
        record.lastChangedSync,
        record.removedAtSync,
      ].filter(Boolean)) {
        if (!syncs.has(syncId)) {
          throw new Error(`${record.id}: history references unknown sync ${syncId}`);
        }
      }
      if (record.status === "active" && record.removedAtSync !== null) {
        throw new Error(`${record.id}: active history cannot have removedAtSync`);
      }
      if (record.status === "tombstoned" && record.removedAtSync === null) {
        throw new Error(`${record.id}: tombstone history needs removedAtSync`);
      }
    }
  }
  return histories;
}

function assertEnabledProviderState({
  providers,
  locks,
  cacheEntries,
  histories,
}) {
  for (const provider of providers.values()) {
    const lock = locks.get(provider.id);
    const history = histories.get(provider.id);

    if (!provider.enabled) {
      continue;
    }
    if (!lock) {
      throw new Error(
        `${provider.id}: enabled provider has no exact source lock in external/locks.json`,
      );
    }
    if (!history) {
      throw new Error(
        `${provider.id}: enabled provider has no reviewed sync history in external/history.json`,
      );
    }

    for (const artifact of lock.artifacts) {
      const key = cacheEntryKey(provider.id, lock.commitSha, artifact.path);
      const cacheEntry = cacheEntries.get(key);
      if (!cacheEntry) {
        throw new Error(
          `${provider.id}:${artifact.path}: locked cache entry is absent; run an explicit reviewed refresh`,
        );
      }
      for (const field of [
        "treeSha",
        "blobSha",
        "sha256",
        "size",
        "mediaType",
        "cachePath",
      ]) {
        if (cacheEntry[field] !== (field === "treeSha" ? lock.treeSha : artifact[field])) {
          throw new Error(
            `${provider.id}:${artifact.path}: cache ${field} does not match the exact source lock`,
          );
        }
      }
    }
  }
}

export async function loadExternalState({
  registryPath = defaultRegistryPath,
  locksPath = defaultLocksPath,
  cacheManifestPath = defaultCacheManifestPath,
  historyPath = defaultHistoryPath,
} = {}) {
  const [registryDocument, locksDocument, cacheDocument, historyDocument] =
    await Promise.all([
      readJsonDocument(registryPath),
      readJsonDocument(locksPath),
      readJsonDocument(cacheManifestPath),
      readJsonDocument(historyPath),
    ]);

  await Promise.all([
    assertContract(
      "provider-registry",
      registryDocument.value,
      registryDocument.filePath,
    ),
    assertContract("source-lock", locksDocument.value, locksDocument.filePath),
    assertContract(
      "cache-manifest",
      cacheDocument.value,
      cacheDocument.filePath,
    ),
    assertContract(
      "sync-history",
      historyDocument.value,
      historyDocument.filePath,
    ),
  ]);

  const providers = assertRegistryInvariants(registryDocument.value);
  const locks = assertLockInvariants(locksDocument.value, providers);
  const cacheEntries = assertCacheInvariants(cacheDocument.value, providers);
  const histories = assertHistoryInvariants(historyDocument.value, providers);

  const state = {
    registry: registryDocument.value,
    lockFile: locksDocument.value,
    cacheManifest: cacheDocument.value,
    historyFile: historyDocument.value,
    hashes: {
      registrySha256: registryDocument.sha256,
      lockFileSha256: locksDocument.sha256,
      cacheManifestSha256: cacheDocument.sha256,
      historySha256: historyDocument.sha256,
    },
    providers,
    locks,
    cacheEntries,
    histories,
  };
  assertEnabledProviderState(state);
  return state;
}

export function assertLockMatchesProvider(lock, provider) {
  if (lock.providerId !== provider.id) {
    throw new Error(
      `provider output lock ${lock.providerId} does not match ${provider.id}`,
    );
  }
  if (!sameRepository(lock.repository, provider.repository)) {
    throw new Error(`${provider.id}: provider output lock repository mismatch`);
  }
}
