import {
  lstat,
  readFile,
  realpath,
} from "node:fs/promises";
import path from "node:path";

import {
  gitBlobSha,
  sha256Hex,
} from "./canonical.mjs";
import {
  cacheEntryKey,
  expectedCachePath,
} from "./config.mjs";
import {
  assertSafePosixPath,
  validateCachedArtifact,
} from "./guards.mjs";

function assertEntryMatchesArtifact(entry, lock, artifact) {
  const expected = {
    providerId: lock.providerId,
    repository: lock.repository,
    commitSha: lock.commitSha,
    treeSha: lock.treeSha,
    path: artifact.path,
    blobSha: artifact.blobSha,
    sha256: artifact.sha256,
    size: artifact.size,
    mediaType: artifact.mediaType,
    cachePath: artifact.cachePath,
  };

  for (const [field, value] of Object.entries(expected)) {
    if (field === "repository") {
      if (
        entry.repository.owner !== value.owner ||
        entry.repository.name !== value.name
      ) {
        throw new Error(
          `${lock.providerId}:${artifact.path}: cache repository mismatch`,
        );
      }
    } else if (entry[field] !== value) {
      throw new Error(
        `${lock.providerId}:${artifact.path}: cache ${field} mismatch`,
      );
    }
  }
}

export function findLockedCacheEntry(state, lock, sourcePath) {
  assertSafePosixPath(sourcePath);
  const artifact = lock.artifacts.find((item) => item.path === sourcePath);
  if (!artifact) {
    throw new Error(
      `${lock.providerId}:${sourcePath}: artifact is not in the exact source lock`,
    );
  }
  const entry = state.cacheEntries.get(
    cacheEntryKey(lock.providerId, lock.commitSha, sourcePath),
  );
  if (!entry) {
    throw new Error(
      `${lock.providerId}:${sourcePath}: locked cache entry is absent (offline generation never downloads it)`,
    );
  }
  assertEntryMatchesArtifact(entry, lock, artifact);
  return entry;
}

export async function readCacheEntry(
  state,
  entry,
  { repoRoot } = {},
) {
  const expected = expectedCachePath(entry.sha256);
  if (entry.cachePath !== expected) {
    throw new Error(
      `${entry.providerId}:${entry.path}: cache path must be ${expected}`,
    );
  }
  assertSafePosixPath(entry.cachePath);

  const resolvedRepoRoot = repoRoot ?? process.cwd();
  const cacheRoot = path.join(
    resolvedRepoRoot,
    "external",
    "cache",
  );
  const filePath = path.resolve(
    cacheRoot,
    ...entry.cachePath.split("/"),
  );
  const relative = path.relative(cacheRoot, filePath);
  if (
    relative.startsWith("..") ||
    path.isAbsolute(relative)
  ) {
    throw new Error(`${entry.providerId}:${entry.path}: cache path escapes root`);
  }

  let metadata;
  let bytes;
  try {
    const [realRepoRoot, realCacheRoot] = await Promise.all([
      realpath(resolvedRepoRoot),
      realpath(cacheRoot),
    ]);
    const cacheRootRelative = path.relative(realRepoRoot, realCacheRoot);
    if (
      cacheRootRelative.startsWith("..") ||
      path.isAbsolute(cacheRootRelative)
    ) {
      throw new Error("cache root resolves outside the repository");
    }

    const cacheRootEntry = await lstat(cacheRoot);
    if (cacheRootEntry.isSymbolicLink()) {
      throw new Error("cache root cannot be a symbolic link");
    }
    const cacheSegments = entry.cachePath.split("/");
    let current = cacheRoot;
    for (const [index, segment] of cacheSegments.entries()) {
      current = path.join(current, segment);
      const item = await lstat(current);
      if (item.isSymbolicLink()) {
        throw new Error(`cache path contains a symbolic link: ${entry.cachePath}`);
      }
      const last = index === cacheSegments.length - 1;
      if (!last && !item.isDirectory()) {
        throw new Error(`cache path contains a non-directory: ${entry.cachePath}`);
      }
      if (last) {
        metadata = item;
      }
    }
    if (!metadata?.isFile()) {
      throw new Error("cache payload must be a regular file");
    }
    bytes = await readFile(filePath);
  } catch (error) {
    throw new Error(
      `${entry.providerId}:${entry.path}: locked cache payload is unavailable offline at ${entry.cachePath}: ${error.message}`,
    );
  }

  if (metadata.size !== entry.size || bytes.byteLength !== entry.size) {
    throw new Error(
      `${entry.providerId}:${entry.path}: cache size mismatch (expected ${entry.size}, received ${bytes.byteLength})`,
    );
  }
  const digest = sha256Hex(bytes);
  if (digest !== entry.sha256) {
    throw new Error(
      `${entry.providerId}:${entry.path}: cache SHA-256 mismatch (expected ${entry.sha256}, received ${digest})`,
    );
  }
  const blobSha = gitBlobSha(bytes);
  if (blobSha !== entry.blobSha) {
    throw new Error(
      `${entry.providerId}:${entry.path}: Git blob SHA mismatch (expected ${entry.blobSha}, received ${blobSha})`,
    );
  }

  validateCachedArtifact({
    path: entry.path,
    bytes,
    mediaType: entry.mediaType,
  });
  return bytes;
}

export function createArtifactReader(state, lock, options = {}) {
  return async (sourcePath) => {
    const entry = findLockedCacheEntry(state, lock, sourcePath);
    return readCacheEntry(state, entry, options);
  };
}

export async function validateEnabledCache(state, options = {}) {
  for (const provider of state.providers.values()) {
    if (!provider.enabled) {
      continue;
    }
    const lock = state.locks.get(provider.id);
    for (const artifact of lock.artifacts) {
      const entry = findLockedCacheEntry(state, lock, artifact.path);
      await readCacheEntry(state, entry, options);
    }
  }
}
