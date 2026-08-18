import {
  canonicalStringify,
  sha256Hex,
} from "./canonical.mjs";

function contentProjection(record) {
  const {
    lifecycle: _lifecycle,
    source,
    links,
    badges,
    ...content
  } = record;
  return {
    ...content,
    featuredSourceFiles: content.featuredSourceFiles.map(
      ({ canonicalUrl: _canonicalUrl, ...file }) => file,
    ),
    images: content.images.map(({ url: _url, ...image }) => image),
    source: {
      repository: source.repository,
      path: source.path,
    },
    links: {
      provider: links.provider,
      repository: links.repository,
    },
    badges: {
      upstreamEditorial: badges.upstreamEditorial,
    },
  };
}

export function recordContentHash(record) {
  return sha256Hex(canonicalStringify(contentProjection(record)));
}

function renameFingerprint(record) {
  return [
    record.source.repository.owner.toLowerCase(),
    record.source.repository.name.toLowerCase(),
    record.source.path.toLowerCase(),
    (record.title.upstream ?? record.title.display).toLowerCase(),
  ].join("\0");
}

export function diffCatalogLifecycle(
  previousRecords,
  currentRecords,
  {
    renameDeclarations = [],
    tombstoneDeclarations = [],
  } = {},
) {
  const previous = new Map(previousRecords.map((record) => [record.id, record]));
  const current = new Map(currentRecords.map((record) => [record.id, record]));
  const renameByOldId = new Map();
  const renameTargets = new Set();
  for (const rename of renameDeclarations) {
    if (renameByOldId.has(rename.fromId)) {
      throw new Error(
        `duplicate rename source requires an explicit split decision: ${rename.fromId}`,
      );
    }
    if (renameTargets.has(rename.toId)) {
      throw new Error(
        `duplicate rename target requires an explicit merge decision: ${rename.toId}`,
      );
    }
    renameByOldId.set(rename.fromId, rename);
    renameTargets.add(rename.toId);
  }

  const tombstoneById = new Map();
  for (const tombstone of tombstoneDeclarations) {
    if (tombstoneById.has(tombstone.id)) {
      throw new Error(`duplicate tombstone declaration: ${tombstone.id}`);
    }
    if (renameByOldId.has(tombstone.id)) {
      throw new Error(
        `record cannot be both renamed and tombstoned: ${tombstone.id}`,
      );
    }
    tombstoneById.set(tombstone.id, tombstone);
  }

  const added = currentRecords
    .filter((record) => !previous.has(record.id))
    .map((record) => record.id);
  const removed = previousRecords
    .filter((record) => !current.has(record.id))
    .map((record) => record.id);
  const changed = currentRecords
    .filter(
      (record) =>
        previous.has(record.id) &&
        recordContentHash(previous.get(record.id)) !== recordContentHash(record),
    )
    .map((record) => record.id);
  const unchanged = currentRecords
    .filter(
      (record) =>
        previous.has(record.id) &&
        recordContentHash(previous.get(record.id)) === recordContentHash(record),
    )
    .map((record) => record.id);

  const acceptedRenames = [];
  for (const rename of renameDeclarations) {
    if (!previous.has(rename.fromId) || current.has(rename.fromId)) {
      throw new Error(
        `rename declaration source must be a removed record: ${rename.fromId}`,
      );
    }
    if (!current.has(rename.toId) || previous.has(rename.toId)) {
      throw new Error(
        `rename declaration target must be an added record: ${rename.toId}`,
      );
    }
    acceptedRenames.push(rename);
  }

  const ambiguousRenames = [];
  for (const removedId of removed) {
    if (renameByOldId.has(removedId) || tombstoneById.has(removedId)) {
      continue;
    }
    const removedRecord = previous.get(removedId);
    const candidates = added.filter(
      (addedId) =>
        renameFingerprint(current.get(addedId)) ===
        renameFingerprint(removedRecord),
    );
    if (candidates.length > 0) {
      ambiguousRenames.push({
        fromId: removedId,
        candidateIds: candidates.sort(),
      });
    }
  }

  const unreviewedRemovals = removed.filter(
    (id) => !renameByOldId.has(id) && !tombstoneById.has(id),
  );

  return {
    added: added.sort(),
    changed: changed.sort(),
    unchanged: unchanged.sort(),
    removed: removed.sort(),
    acceptedRenames,
    tombstones: removed
      .filter((id) => tombstoneById.has(id))
      .map((id) => tombstoneById.get(id)),
    ambiguousRenames,
    unreviewedRemovals,
    requiresReview:
      unreviewedRemovals.length > 0 || ambiguousRenames.length > 0,
  };
}

export function assertReviewedLifecycleDiff(diff) {
  if (diff.ambiguousRenames.length > 0) {
    const details = diff.ambiguousRenames
      .map(
        (rename) =>
          `${rename.fromId} -> ${rename.candidateIds.join(" | ")}`,
      )
      .join(", ");
    throw new Error(
      `possible renames require an explicit decision; none are inferred: ${details}`,
    );
  }
  if (diff.unreviewedRemovals.length > 0) {
    throw new Error(
      `records were removed without reviewed tombstones or rename declarations: ${diff.unreviewedRemovals.join(", ")}`,
    );
  }
}

export function lifecycleFromHistory(recordHistory) {
  return {
    status: recordHistory.status,
    firstSeenSync: recordHistory.firstSeenSync,
    lastReviewedSync: recordHistory.lastReviewedSync,
    lastChangedSync: recordHistory.lastChangedSync,
    removedAtSync: recordHistory.removedAtSync,
  };
}
