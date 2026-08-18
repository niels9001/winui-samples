import {
  canonicalStringify,
  hashCanonicalJson,
} from "./canonical.mjs";
import { assertLockMatchesProvider } from "./config.mjs";
import {
  assertAllowedSourceRoot,
  assertRecordAssetBudget,
  assertSafePosixPath,
} from "./guards.mjs";
import {
  createGlobalId,
  createRouteSlug,
  validateGlobalIdentity,
  validateNormalizedRecord,
} from "./identity.mjs";
import { recordContentHash } from "./lifecycle.mjs";
import { validateLicenseManifest } from "./licenses.mjs";
import { assertContract } from "./schema.mjs";

function equalCanonical(left, right) {
  return canonicalStringify(left) === canonicalStringify(right);
}

function historyMaps(history) {
  return {
    syncs: new Map(history.syncs.map((sync) => [sync.id, sync])),
    records: new Map(history.records.map((record) => [record.id, record])),
  };
}

function nestedPaths(units) {
  return units.flatMap((unit) => [
    ...unit.sourcePaths,
    ...nestedPaths(unit.children),
  ]);
}

function assertRecordSourceRoots(record, provider) {
  const paths = [
    record.source.path,
    ...record.featuredSourceFiles.map((file) => file.path),
    ...record.images.map((image) => image.path),
    ...nestedPaths(record.content.variants),
    ...nestedPaths(record.content.scenarios),
    ...nestedPaths(record.content.examples),
  ];
  for (const sourcePath of paths) {
    assertAllowedSourceRoot(sourcePath, provider.allowedSourceRoots);
  }
}

function assertRecordAssetsMatchLock(record, lock) {
  const artifacts = new Map(
    lock.artifacts.map((artifact) => [artifact.path, artifact]),
  );
  const sizes = [];

  for (const image of record.images) {
    const artifact = artifacts.get(image.path);
    if (!artifact) {
      throw new Error(`${record.id}: image is absent from source lock: ${image.path}`);
    }
    for (const field of ["blobSha", "sha256", "size", "mediaType"]) {
      if (image[field] !== artifact[field]) {
        throw new Error(
          `${record.id}: image ${field} does not match source lock: ${image.path}`,
        );
      }
    }
    sizes.push({ size: image.size });
  }

  for (const file of record.featuredSourceFiles) {
    if (file.sha256 === null || file.size === null) {
      continue;
    }
    const artifact = artifacts.get(file.path);
    if (!artifact) {
      throw new Error(
        `${record.id}: cached featured file is absent from source lock: ${file.path}`,
      );
    }
    for (const field of ["blobSha", "sha256", "size"]) {
      if (file[field] !== artifact[field]) {
        throw new Error(
          `${record.id}: featured file ${field} does not match source lock: ${file.path}`,
        );
      }
    }
    sizes.push({ size: file.size });
  }
  assertRecordAssetBudget(sizes);
}

function assertLifecycleMatchesHistory(record, historyRecord) {
  if (!historyRecord) {
    throw new Error(
      `${record.id}: record is absent from committed reviewed sync history`,
    );
  }

  if (historyRecord.status !== "active") {
    throw new Error(`${record.id}: active output has tombstoned history`);
  }
  if (
    historyRecord.recordKey !== record.recordKey ||
    historyRecord.routePath !== record.route.path
  ) {
    throw new Error(`${record.id}: identity differs from reviewed sync history`);
  }

  for (const field of [
    "status",
    "firstSeenSync",
    "lastReviewedSync",
    "lastChangedSync",
    "removedAtSync",
  ]) {
    if (record.lifecycle[field] !== historyRecord[field]) {
      throw new Error(
        `${record.id}: lifecycle.${field} differs from reviewed sync history`,
      );
    }
  }
  if (
    typeof historyRecord.contentHash === "string" &&
    recordContentHash(record) !== historyRecord.contentHash
  ) {
    throw new Error(
      `${record.id}: normalized content does not match reviewed history contentHash`,
    );
  }
}

function assertTombstoneMatchesHistory(tombstone, historyRecord) {
  if (!historyRecord || historyRecord.status !== "tombstoned") {
    throw new Error(
      `${tombstone.id}: tombstone is absent from committed reviewed sync history`,
    );
  }
  if (
    tombstone.recordKey !== historyRecord.recordKey ||
    tombstone.routePath !== historyRecord.routePath ||
    tombstone.removedAtSync !== historyRecord.removedAtSync
  ) {
    throw new Error(
      `${tombstone.id}: tombstone differs from reviewed sync history`,
    );
  }
}

export async function validateProviderOutput(output, state, provider) {
  await assertContract("provider-output", output, `${provider.id} output`);
  const lock = state.locks.get(provider.id);
  const history = state.histories.get(provider.id);
  if (!lock || !history) {
    throw new Error(`${provider.id}: enabled provider state is incomplete`);
  }

  if (output.providerId !== provider.id) {
    throw new Error(`${provider.id}: output providerId mismatch`);
  }
  if (
    provider.completenessPolicy === "enforced" &&
    output.records.length !== provider.expectedRecordCount
  ) {
    throw new Error(
      `${provider.id}: expected ${provider.expectedRecordCount} records, received ${output.records.length}`,
    );
  }
  assertLockMatchesProvider(output.lock, provider);
  if (!equalCanonical(output.lock, lock)) {
    throw new Error(`${provider.id}: output does not embed the exact source lock`);
  }

  const { syncs, records: historyRecords } = historyMaps(history);
  const latestSync = syncs.get(history.latestSyncId);
  if (
    !latestSync ||
    !equalCanonical(output.reviewedSync, latestSync) ||
    output.reviewedSync.lockCommitSha !== lock.commitSha
  ) {
    throw new Error(
      `${provider.id}: output reviewedSync must be the latest committed sync for the locked commit`,
    );
  }
  if (!syncs.has(output.reviewedSync.id)) {
    throw new Error(`${provider.id}: output references an unknown reviewed sync`);
  }

  for (const record of output.records) {
    await validateNormalizedRecord(record);
    if (
      record.provider.id !== provider.id ||
      record.provider.name !== provider.name ||
      record.provider.kind !== provider.kind
    ) {
      throw new Error(`${record.id}: provider identity mismatch`);
    }
    if (
      record.source.repository.owner !== lock.repository.owner ||
      record.source.repository.name !== lock.repository.name ||
      record.source.lockedCommitSha !== lock.commitSha ||
      record.source.treeSha !== lock.treeSha ||
      record.source.ref !== lock.ref ||
      record.source.commitTime !== lock.commitTime
    ) {
      throw new Error(`${record.id}: source does not match the exact provider lock`);
    }
    assertRecordSourceRoots(record, provider);
    assertRecordAssetsMatchLock(record, lock);
    assertLifecycleMatchesHistory(record, historyRecords.get(record.id));
    for (const previousPath of record.route.previousPaths) {
      if (!syncs.has(previousPath.declaredAtSync)) {
        throw new Error(
          `${record.id}: previous route references unknown reviewed sync ${previousPath.declaredAtSync}`,
        );
      }
    }
  }

  for (const redirect of output.redirects) {
    if (!syncs.has(redirect.declaredAtSync)) {
      throw new Error(
        `${provider.id}: redirect ${redirect.fromPath} references unknown reviewed sync ${redirect.declaredAtSync}`,
      );
    }
  }

  const outputRecordIds = new Set(output.records.map((record) => record.id));
  const tombstoneIds = new Set();
  for (const tombstone of output.tombstones) {
    if (tombstone.providerId !== provider.id) {
      throw new Error(`${tombstone.id}: tombstone provider mismatch`);
    }
    const expectedId = createGlobalId(
      tombstone.providerId,
      tombstone.recordKey,
    );
    const expectedRoute = `samples/${createRouteSlug(
      tombstone.providerId,
      tombstone.recordKey,
    )}`;
    if (tombstone.id !== expectedId || tombstone.routePath !== expectedRoute) {
      throw new Error(
        `${tombstone.id}: tombstone identity/route must derive from its immutable record key`,
      );
    }
    if (tombstoneIds.has(tombstone.id)) {
      throw new Error(`${provider.id}: duplicate tombstone ${tombstone.id}`);
    }
    tombstoneIds.add(tombstone.id);
    if (!syncs.has(tombstone.removedAtSync)) {
      throw new Error(
        `${tombstone.id}: tombstone references unknown reviewed sync ${tombstone.removedAtSync}`,
      );
    }
    assertTombstoneMatchesHistory(
      tombstone,
      historyRecords.get(tombstone.id),
    );
  }

  for (const historyRecord of history.records) {
    if (
      historyRecord.status === "active" &&
      !outputRecordIds.has(historyRecord.id)
    ) {
      throw new Error(
        `${provider.id}: reviewed active record disappeared without a tombstone: ${historyRecord.id}`,
      );
    }
    if (
      historyRecord.status === "tombstoned" &&
      !tombstoneIds.has(historyRecord.id)
    ) {
      throw new Error(
        `${provider.id}: reviewed tombstone is missing from output: ${historyRecord.id}`,
      );
    }
  }

  if (output.licenseManifest) {
    await validateLicenseManifest(output.licenseManifest, lock);
  }
  const licenseIds = new Set(
    output.licenseManifest?.entries.map((entry) => entry.id) ?? [],
  );
  for (const record of output.records) {
    for (const reference of [
      ...record.attribution.licenseRefs,
      ...record.attribution.attributionRefs,
    ]) {
      if (!licenseIds.has(reference)) {
        throw new Error(`${record.id}: unknown license/attribution ref ${reference}`);
      }
    }
  }
  return output;
}

function assertMergedRoutes(records, redirects, tombstones) {
  validateGlobalIdentity(records);
  const recordIds = new Set(records.map((record) => record.id));
  const routeOwners = new Map();

  function claimRoute(routePath, owner) {
    assertSafePosixPath(routePath);
    if (!routePath.startsWith("samples/")) {
      throw new Error(`portal route must start with samples/: ${routePath}`);
    }
    if (routeOwners.has(routePath)) {
      throw new Error(
        `route ${routePath} is claimed by ${routeOwners.get(routePath)} and ${owner}`,
      );
    }
    routeOwners.set(routePath, owner);
  }

  for (const record of records) {
    claimRoute(record.route.path, `active record ${record.id}`);
  }

  for (const record of records) {
    for (const previousPath of record.route.previousPaths) {
      claimRoute(previousPath.path, `previous route for ${record.id}`);
    }
  }

  for (const redirect of redirects) {
    if (!recordIds.has(redirect.toId)) {
      throw new Error(`redirect target is absent: ${redirect.toId}`);
    }
    claimRoute(redirect.fromPath, `redirect to ${redirect.toId}`);
  }

  const tombstoneIds = new Set();
  for (const tombstone of tombstones) {
    if (recordIds.has(tombstone.id)) {
      throw new Error(`tombstone conflicts with active record ${tombstone.id}`);
    }
    if (tombstoneIds.has(tombstone.id)) {
      throw new Error(`duplicate tombstone ${tombstone.id}`);
    }
    if (
      tombstone.redirectToId !== null &&
      !recordIds.has(tombstone.redirectToId)
    ) {
      throw new Error(
        `tombstone redirect target is absent: ${tombstone.redirectToId}`,
      );
    }
    claimRoute(tombstone.routePath, `tombstone ${tombstone.id}`);
    tombstoneIds.add(tombstone.id);
  }
}

export async function mergeProviderOutputs(state, outputs) {
  const enabledProviders = [...state.providers.values()].filter(
    (provider) => provider.enabled,
  ).sort((left, right) => left.id.localeCompare(right.id, "en-US"));
  const outputByProvider = new Map();
  for (const output of outputs) {
    if (outputByProvider.has(output.providerId)) {
      throw new Error(`duplicate output for provider ${output.providerId}`);
    }
    outputByProvider.set(output.providerId, output);
  }
  for (const provider of enabledProviders) {
    const output = outputByProvider.get(provider.id);
    if (!output) {
      throw new Error(
        `${provider.id}: enabled provider produced no output; zero-record fallback is forbidden`,
      );
    }
    await validateProviderOutput(output, state, provider);
  }
  for (const providerId of outputByProvider.keys()) {
    const provider = state.providers.get(providerId);
    if (!provider?.enabled) {
      throw new Error(`received output for disabled/unknown provider ${providerId}`);
    }
  }

  const records = outputs
    .flatMap((output) => output.records)
    .sort((left, right) => left.id.localeCompare(right.id, "en-US"));
  const redirects = outputs
    .flatMap((output) => output.redirects)
    .sort((left, right) =>
      left.fromPath.localeCompare(right.fromPath, "en-US"),
    );
  const tombstones = outputs
    .flatMap((output) => output.tombstones)
    .sort((left, right) => left.id.localeCompare(right.id, "en-US"));
  assertMergedRoutes(records, redirects, tombstones);

  const core = {
    schemaVersion: 1,
    catalogVersion: 1,
    generatedBy: "tools/external-catalog",
    generatedFrom: {
      ...state.hashes,
      providerLocks: enabledProviders.map((provider) =>
        state.locks.get(provider.id),
      ),
    },
    providers: enabledProviders.map((provider) => {
      const output = outputByProvider.get(provider.id);
      return {
        id: provider.id,
        name: provider.name,
        kind: provider.kind,
        repository: `https://github.com/${provider.repository.owner}/${provider.repository.name}`,
        recordCount: output.records.length,
        reviewedSync: output.reviewedSync,
      };
    }),
    records,
    redirects,
    tombstones,
    licenses: outputs
      .map((output) => output.licenseManifest)
      .filter(Boolean)
      .sort((left, right) =>
        left.providerId.localeCompare(right.providerId, "en-US"),
      ),
  };
  const catalog = {
    ...core,
    contentHash: hashCanonicalJson(core),
  };
  await assertContract("merged-catalog", catalog, "merged external catalog");
  return catalog;
}
