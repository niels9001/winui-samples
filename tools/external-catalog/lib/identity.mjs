import { sha256Hex } from "./canonical.mjs";
import {
  assertHtmlSafeValue,
  assertSafePosixPath,
} from "./guards.mjs";
import { assertContract } from "./schema.mjs";

const requiredProvenanceFields = [
  "/description",
  "/summary",
  "/title/display",
  "/title/upstream",
];

function slugify(value) {
  const slug = value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
  return slug || "record";
}

export function createRouteSlug(providerId, recordKey) {
  const digest = sha256Hex(`${providerId}\0${recordKey}`).slice(0, 12);
  return `${providerId}--${slugify(recordKey)}--${digest}`;
}

export function createGlobalId(providerId, recordKey) {
  return `${providerId}:${recordKey}`;
}

function hasJsonPointer(value, pointer) {
  const segments = pointer
    .slice(1)
    .split("/")
    .map((segment) => segment.replaceAll("~1", "/").replaceAll("~0", "~"));
  let current = value;
  for (const segment of segments) {
    if (
      current === null ||
      typeof current !== "object" ||
      !Object.prototype.hasOwnProperty.call(current, segment)
    ) {
      return false;
    }
    current = current[segment];
  }
  return true;
}

function encodeGitHubPath(value) {
  return value
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function assertPinnedGitHubLinks(record) {
  const { owner, name, url } = record.source.repository;
  const repositoryUrl = `https://github.com/${owner}/${name}`;
  const commitSha = record.source.lockedCommitSha;

  if (url !== repositoryUrl || record.links.repository !== repositoryUrl) {
    throw new Error(`${record.id}: repository URL must match source repository`);
  }
  if (record.links.provider.label !== record.provider.name) {
    throw new Error(`${record.id}: provider link label must match provider name`);
  }
  if (record.links.provider.url !== repositoryUrl) {
    throw new Error(`${record.id}: provider link must use the canonical repository`);
  }
  if (record.links.commit !== `${repositoryUrl}/commit/${commitSha}`) {
    throw new Error(`${record.id}: commit link must pin the locked commit SHA`);
  }
  if (record.links.tree !== `${repositoryUrl}/tree/${commitSha}`) {
    throw new Error(`${record.id}: tree link must pin the locked commit SHA`);
  }
  const sourcePath = encodeGitHubPath(record.source.path);
  const sourceUrls = new Set([
    `${repositoryUrl}/blob/${commitSha}/${sourcePath}`,
    `${repositoryUrl}/tree/${commitSha}/${sourcePath}`,
  ]);
  if (!sourceUrls.has(record.source.canonicalUrl)) {
    throw new Error(
      `${record.id}: source.canonicalUrl must exactly match its locked source path`,
    );
  }
  if (record.links.source !== record.source.canonicalUrl) {
    throw new Error(`${record.id}: links.source must equal source.canonicalUrl`);
  }
  for (const [field, value] of [
    ...record.featuredSourceFiles.map((file) => [
      `featuredSourceFiles.${file.path}`,
      file.canonicalUrl,
    ]),
    ...record.images.map((image) => [`images.${image.path}`, image.url]),
  ]) {
    const declaredPath = field.slice(field.indexOf(".") + 1);
    const expected = `${repositoryUrl}/blob/${commitSha}/${encodeGitHubPath(declaredPath)}`;
    if (value !== expected) {
      throw new Error(
        `${record.id}: ${field} must exactly match its locked source path`,
      );
    }
  }
}

function assertProvenance(record) {
  const fields = new Set();
  for (const provenance of record.fieldProvenance) {
    if (fields.has(provenance.field)) {
      throw new Error(
        `${record.id}: duplicate provenance for ${provenance.field}`,
      );
    }
    fields.add(provenance.field);
    if (!hasJsonPointer(record, provenance.field)) {
      throw new Error(
        `${record.id}: provenance points to missing field ${provenance.field}`,
      );
    }
    assertSafePosixPath(provenance.sourcePath);
  }
  for (const field of requiredProvenanceFields) {
    if (!fields.has(field)) {
      throw new Error(`${record.id}: missing field provenance for ${field}`);
    }
  }
}

function nestedSourcePaths(units) {
  return units.flatMap((unit) => [
    ...unit.sourcePaths,
    ...nestedSourcePaths(unit.children),
  ]);
}

export async function validateNormalizedRecord(record) {
  await assertContract("normalized-record", record, record?.id ?? "record");
  const expectedId = createGlobalId(record.provider.id, record.recordKey);
  if (record.id !== expectedId) {
    throw new Error(`${record.id}: id must be ${expectedId}`);
  }

  const expectedSlug = createRouteSlug(record.provider.id, record.recordKey);
  if (record.route.slug !== expectedSlug) {
    throw new Error(`${record.id}: route slug must be ${expectedSlug}`);
  }
  if (record.route.path !== `samples/${expectedSlug}`) {
    throw new Error(
      `${record.id}: route path must be samples/${expectedSlug}`,
    );
  }

  const imageIds = new Set();
  for (const image of record.images) {
    if (imageIds.has(image.id)) {
      throw new Error(`${record.id}: duplicate image id ${image.id}`);
    }
    imageIds.add(image.id);
  }

  assertSafePosixPath(record.source.path);
  for (const path of [
    ...record.featuredSourceFiles.map((file) => file.path),
    ...record.images.map((image) => image.path),
    ...nestedSourcePaths(record.content.variants),
    ...nestedSourcePaths(record.content.scenarios),
    ...nestedSourcePaths(record.content.examples),
  ]) {
    assertSafePosixPath(path);
  }
  for (const provenancePath of [
    ...record.images.map((image) => image.provenance.sourcePath),
    ...record.badges.upstreamEditorial.map((badge) => badge.sourcePath),
    ...record.metadata.warnings
      .map((warning) => warning.sourcePath)
      .filter(Boolean),
  ]) {
    assertSafePosixPath(provenancePath);
  }

  for (const relation of record.relations) {
    if (!relation.targetId.startsWith(`${relation.providerId}:`)) {
      throw new Error(
        `${record.id}: relation target ${relation.targetId} does not match provider ${relation.providerId}`,
      );
    }
  }

  if (
    record.lifecycle.status === "active" &&
    record.lifecycle.removedAtSync !== null
  ) {
    throw new Error(`${record.id}: active records cannot have removedAtSync`);
  }
  if (
    record.lifecycle.status === "tombstoned" &&
    record.lifecycle.removedAtSync === null
  ) {
    throw new Error(`${record.id}: tombstoned records require removedAtSync`);
  }
  const expectedLifecycleBadges =
    record.lifecycle.status !== "active"
      ? []
      : record.lifecycle.firstSeenSync === record.lifecycle.lastReviewedSync
        ? ["new"]
        : record.lifecycle.lastChangedSync === record.lifecycle.lastReviewedSync
          ? ["updated"]
          : [];
  if (
    JSON.stringify([...record.badges.portalLifecycle].sort()) !==
    JSON.stringify(expectedLifecycleBadges)
  ) {
    throw new Error(
      `${record.id}: portal lifecycle badges must be derived from reviewed sync history`,
    );
  }

  assertPinnedGitHubLinks(record);
  assertProvenance(record);
  assertHtmlSafeValue(record);
  return record;
}

export function validateGlobalIdentity(records) {
  const ids = new Map();
  const slugs = new Map();
  const paths = new Map();

  for (const record of records) {
    for (const [map, value, label] of [
      [ids, record.id, "global id"],
      [slugs, record.route.slug, "route slug"],
      [paths, record.route.path, "route path"],
    ]) {
      if (map.has(value)) {
        throw new Error(
          `duplicate ${label} ${value}: ${map.get(value)} and ${record.id}`,
        );
      }
      map.set(value, record.id);
    }
  }
}
