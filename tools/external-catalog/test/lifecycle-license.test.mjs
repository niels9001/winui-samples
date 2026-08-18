import assert from "node:assert/strict";
import test from "node:test";

import {
  assertReviewedLifecycleDiff,
  diffCatalogLifecycle,
  recordContentHash,
} from "../lib/lifecycle.mjs";
import {
  resolveLicenseForPath,
  validateLicenseManifest,
} from "../lib/licenses.mjs";
import {
  clone,
  createSecondGalleryRecord,
  loadRecordFixture,
} from "./fixtures.mjs";

test("deletions require explicit tombstones", async () => {
  const record = await loadRecordFixture("winui-gallery");
  const unreviewed = diffCatalogLifecycle([record], []);
  assert.deepEqual(unreviewed.unreviewedRemovals, [record.id]);
  assert.throws(
    () => assertReviewedLifecycleDiff(unreviewed),
    /without reviewed tombstones/,
  );

  const reviewed = diffCatalogLifecycle([record], [], {
    tombstoneDeclarations: [
      {
        id: record.id,
        removedAtSync: "sync-2",
        reason: "Upstream source unit was deliberately retired.",
      },
    ],
  });
  assert.deepEqual(reviewed.unreviewedRemovals, []);
  assert.equal(reviewed.requiresReview, false);
});

test("possible renames are reported as ambiguous and never inferred", async () => {
  const previous = await loadRecordFixture("winui-gallery");
  const current = createSecondGalleryRecord(previous);
  current.source.path = previous.source.path;
  current.title.upstream = previous.title.upstream;

  const ambiguous = diffCatalogLifecycle([previous], [current]);
  assert.deepEqual(ambiguous.ambiguousRenames, [
    {
      fromId: previous.id,
      candidateIds: [current.id],
    },
  ]);
  assert.throws(
    () => assertReviewedLifecycleDiff(ambiguous),
    /none are inferred/,
  );

  const explicit = diffCatalogLifecycle([previous], [current], {
    renameDeclarations: [
      {
        fromId: previous.id,
        toId: current.id,
        declaredAtSync: "sync-2",
        reason: "Reviewed immutable-key replacement.",
      },
    ],
  });

  assert.deepEqual(explicit.ambiguousRenames, []);
  assert.deepEqual(explicit.unreviewedRemovals, []);
});

test("reviewed renames are one-to-one decisions", async () => {
  const previous = await loadRecordFixture("winui-gallery");
  const first = createSecondGalleryRecord(previous);
  const second = clone(first);
  second.id = "winui-gallery:AnotherPage";
  second.recordKey = "AnotherPage";

  assert.throws(
    () =>
      diffCatalogLifecycle([previous], [first, second], {
        renameDeclarations: [
          { fromId: previous.id, toId: first.id },
          { fromId: previous.id, toId: second.id },
        ],
      }),
    /duplicate rename source/,
  );
});

test("commit-only pinned URL changes do not create portal recency", async () => {
  const previous = await loadRecordFixture("winui-gallery");
  const current = clone(previous);
  current.source.lockedCommitSha = "9".repeat(40);
  current.source.commitTime = "2026-08-11T12:00:00Z";
  current.source.canonicalUrl = current.source.canonicalUrl.replaceAll(
    "c".repeat(40),
    "9".repeat(40),
  );
  for (const field of ["source", "commit", "tree"]) {
    current.links[field] = current.links[field].replaceAll(
      "c".repeat(40),
      "9".repeat(40),
    );
  }
  for (const file of current.featuredSourceFiles) {
    file.canonicalUrl = file.canonicalUrl.replaceAll(
      "c".repeat(40),
      "9".repeat(40),
    );
  }
  for (const image of current.images) {
    image.url = image.url.replaceAll(
      "c".repeat(40),
      "9".repeat(40),
    );
  }

  assert.equal(recordContentHash(current), recordContentHash(previous));
});

test("subtree licenses override repository-root licenses", async () => {
  const lock = {
    providerId: "winui-gallery",
    repository: { owner: "microsoft", name: "WinUI-Gallery" },
    commitSha: "c".repeat(40),
  };
  const repositoryPrefix =
    "https://github.com/microsoft/WinUI-Gallery/blob/" + lock.commitSha;
  const manifest = {
    schemaVersion: 1,
    providerId: lock.providerId,
    repository: lock.repository,
    lockedCommitSha: lock.commitSha,
    entries: [
      {
        id: "winui-gallery:root",
        scopePath: "",
        spdxId: "MIT",
        licensePath: "LICENSE",
        licenseUrl: `${repositoryPrefix}/LICENSE`,
        attributionText: null,
      },
      {
        id: "winui-gallery:assets",
        scopePath: "WinUIGallery/Assets",
        spdxId: "CC-BY-4.0",
        licensePath: "WinUIGallery/Assets/LICENSE",
        licenseUrl: `${repositoryPrefix}/WinUIGallery/Assets/LICENSE`,
        attributionText: "Synthetic fixture attribution.",
      },
    ],
  };

  await validateLicenseManifest(manifest, lock);
  assert.equal(
    resolveLicenseForPath(
      manifest,
      "WinUIGallery/Assets/ControlImages/Button.png",
    ).id,
    "winui-gallery:assets",
  );
  assert.equal(
    resolveLicenseForPath(manifest, "WinUIGallery/ControlInfoData.json").id,
    "winui-gallery:root",
  );

  const escaped = clone(manifest);
  escaped.entries[0].licenseUrl =
    `${repositoryPrefix}/../attacker/repo/LICENSE`;
  await assert.rejects(
    validateLicenseManifest(escaped, lock),
    /must exactly match its locked license path/,
  );
});
