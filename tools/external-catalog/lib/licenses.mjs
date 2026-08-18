import { assertSafePosixPath } from "./guards.mjs";
import { assertContract } from "./schema.mjs";

export async function validateLicenseManifest(manifest, lock) {
  await assertContract("license-manifest", manifest, "license manifest");
  if (manifest.providerId !== lock.providerId) {
    throw new Error("license manifest provider does not match source lock");
  }
  if (
    manifest.repository.owner !== lock.repository.owner ||
    manifest.repository.name !== lock.repository.name
  ) {
    throw new Error("license manifest repository does not match source lock");
  }
  if (manifest.lockedCommitSha !== lock.commitSha) {
    throw new Error("license manifest must pin the locked commit SHA");
  }

  const ids = new Set();
  const scopes = new Set();
  for (const entry of manifest.entries) {
    assertSafePosixPath(entry.scopePath, { allowEmpty: true });
    assertSafePosixPath(entry.licensePath);
    if (ids.has(entry.id)) {
      throw new Error(`duplicate license entry id ${entry.id}`);
    }
    if (scopes.has(entry.scopePath)) {
      throw new Error(
        `duplicate license scope ${entry.scopePath || "(repository root)"}`,
      );
    }
    ids.add(entry.id);
    scopes.add(entry.scopePath);
    const repositoryUrl = `https://github.com/${lock.repository.owner}/${lock.repository.name}`;
    const encodedPath = entry.licensePath
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/");
    const expectedUrl = `${repositoryUrl}/blob/${lock.commitSha}/${encodedPath}`;
    if (entry.licenseUrl !== expectedUrl) {
      throw new Error(
        `${entry.id}: licenseUrl must exactly match its locked license path`,
      );
    }
  }
  return manifest;
}

export function resolveLicenseForPath(manifest, sourcePath) {
  assertSafePosixPath(sourcePath);
  const candidates = manifest.entries.filter(
    (entry) =>
      entry.scopePath === "" ||
      sourcePath === entry.scopePath ||
      sourcePath.startsWith(`${entry.scopePath}/`),
  );
  candidates.sort(
    (left, right) =>
      right.scopePath.length - left.scopePath.length ||
      left.id.localeCompare(right.id, "en-US"),
  );
  return candidates[0];
}
