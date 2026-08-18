import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  canonicalStringify,
} from "../lib/canonical.mjs";
import {
  createRouteSlug,
  validateGlobalIdentity,
  validateNormalizedRecord,
} from "../lib/identity.mjs";
import { mergeProviderOutputs } from "../lib/merge.mjs";
import { assertContract } from "../lib/schema.mjs";
import {
  clone,
  createEnabledGalleryState,
  createSecondGalleryRecord,
  loadRecordFixture,
} from "./fixtures.mjs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

test("all compact provider fixtures satisfy the normalized schema", async () => {
  for (const name of [
    "local",
    "winui-gallery",
    "windows-app-sdk-samples",
  ]) {
    await validateNormalizedRecord(await loadRecordFixture(name));
  }
});

test("canonical JSON preserves authored array order", () => {
  const value = {
    actions: [
      { kind: "click", position: 2 },
      { kind: "wait", position: 1 },
    ],
  };
  assert.deepEqual(
    JSON.parse(canonicalStringify(value)).actions.map((action) => action.kind),
    ["click", "wait"],
  );
});

test("decorative images require empty alt while informative images require meaningful alt", async () => {
  const informative = await loadRecordFixture("winui-gallery");
  await assert.doesNotReject(validateNormalizedRecord(informative));

  const decorative = clone(informative);
  decorative.images[0].decorative = true;
  decorative.images[0].alt = "";
  await assert.doesNotReject(validateNormalizedRecord(decorative));

  const redundant = clone(decorative);
  redundant.images[0].alt = redundant.title.display;
  await assert.rejects(
    validateNormalizedRecord(redundant),
    /must be equal to constant/,
  );

  const emptyInformative = clone(informative);
  emptyInformative.images[0].alt = "   ";
  await assert.rejects(
    validateNormalizedRecord(emptyInformative),
    /must match pattern/,
  );
});

test("image ids are unique within each normalized record", async () => {
  const record = await loadRecordFixture("winui-gallery");
  record.images.push({
    ...clone(record.images[0]),
    path: "WinUIGallery/Assets/ControlImages/Duplicate.png",
    url: record.images[0].url.replace("Button.png", "Duplicate.png"),
    provenance: {
      ...record.images[0].provenance,
      sourcePath: "WinUIGallery/Assets/ControlImages/Duplicate.png",
    },
  });
  await assert.rejects(
    validateNormalizedRecord(record),
    /duplicate image id/,
  );
});

test("route identity is stable across title and source path changes", async () => {
  const record = await loadRecordFixture("winui-gallery");
  const changed = clone(record);
  changed.title.display = "A completely different editorial title";
  changed.source.path = "WinUIGallery/Data/Renamed.json";

  assert.equal(
    createRouteSlug(record.provider.id, record.recordKey),
    createRouteSlug(changed.provider.id, changed.recordKey),
  );
  assert.equal(record.route.slug, changed.route.slug);
});

test("global ids, slugs, and route paths cannot collide", async () => {
  const record = await loadRecordFixture("winui-gallery");
  const duplicate = clone(record);
  duplicate.id = "winui-gallery:DifferentKey";

  assert.throws(
    () => validateGlobalIdentity([record, duplicate]),
    /duplicate route slug/,
  );
});

test("previous paths cannot collide with active or redirect routes", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "external-routes-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const first = await loadRecordFixture("winui-gallery");
  const second = createSecondGalleryRecord(first);
  second.route.previousPaths = [
    {
      path: first.route.path,
      declaredAtSync: "gallery-fixture-sync-1",
      reason: "Synthetic collision.",
    },
  ];
  const { state, output } = await createEnabledGalleryState(root, [
    first,
    second,
  ]);

  await assert.rejects(
    mergeProviderOutputs(state, [output]),
    /is claimed by/,
  );
});

test("redirect routes reject normalized traversal aliases", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "external-route-alias-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const record = await loadRecordFixture("winui-gallery");
  const { state, output } = await createEnabledGalleryState(root, [record]);
  output.redirects = [
    {
      fromPath: `samples/ignored/../${record.route.slug}`,
      toId: record.id,
      declaredAtSync: "gallery-fixture-sync-1",
      reason: "Synthetic traversal alias.",
    },
  ];

  await assert.rejects(
    mergeProviderOutputs(state, [output]),
    /pattern|unsafe traversal segment/,
  );
});

test("previous and redirect routes require committed reviewed sync ids", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "external-route-sync-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const record = await loadRecordFixture("winui-gallery");
  record.route.previousPaths = [
    {
      path: "samples/legacy-button",
      declaredAtSync: "missing-sync",
      reason: "Synthetic unreviewed route.",
    },
  ];
  const { state, output } = await createEnabledGalleryState(root, [record]);

  await assert.rejects(
    mergeProviderOutputs(state, [output]),
    /previous route references unknown reviewed sync missing-sync/,
  );

  record.route.previousPaths[0].declaredAtSync = "gallery-fixture-sync-1";
  output.redirects = [
    {
      fromPath: "samples/another-legacy-button",
      toId: record.id,
      declaredAtSync: "missing-sync",
      reason: "Synthetic unreviewed redirect.",
    },
  ];
  await assert.rejects(
    mergeProviderOutputs(state, [output]),
    /redirect .* references unknown reviewed sync missing-sync/,
  );
});

test("required field provenance is complete and points at real fields", async () => {
  const record = await loadRecordFixture("local");
  record.fieldProvenance = record.fieldProvenance
    .filter((entry) => entry.field !== "/summary")
    .concat({
      field: "/tags",
      kind: "authored",
      sourcePath: "Samples/FileAccess/sample.yml",
    });

  await assert.rejects(
    validateNormalizedRecord(record),
    /missing field provenance for \/summary/,
  );
});

test("all provenance source paths use safe repository syntax", async () => {
  const record = await loadRecordFixture("winui-gallery");
  record.images[0].provenance.sourcePath = "../../secret";
  await assert.rejects(
    validateNormalizedRecord(record),
    /pattern|traversal|unsafe repository path/,
  );
});

test("pinned source URLs must exactly match their declared paths", async () => {
  const record = await loadRecordFixture("winui-gallery");
  record.images[0].url = record.images[0].url.replace(
    "Button.png",
    "../Other.png",
  );
  await assert.rejects(
    validateNormalizedRecord(record),
    /must exactly match its locked source path/,
  );
});

test("provider registry rejects unknown fields", async () => {
  const registry = JSON.parse(await readFile("external/providers.json", "utf8"));
  registry.providers[0].unknownImporterOption = true;

  await assert.rejects(
    assertContract("provider-registry", registry),
    /additional properties/,
  );
});

test("merged output is byte-identical regardless provider record order", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "external-contract-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const first = await loadRecordFixture("winui-gallery");
  const second = createSecondGalleryRecord(first);
  const { state, output } = await createEnabledGalleryState(root, [
    first,
    second,
  ]);

  const forward = await mergeProviderOutputs(state, [output]);
  output.records.reverse();
  const reverse = await mergeProviderOutputs(state, [output]);
  assert.equal(canonicalStringify(reverse), canonicalStringify(forward));
  assert.deepEqual(
    JSON.parse(canonicalStringify(forward)).records.map((record) => record.id),
    ["winui-gallery:ButtonPage", "winui-gallery:TextBlockPage"],
  );
});

test("latest reviewed sync is explicit rather than array-order dependent", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "external-sync-order-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const record = await loadRecordFixture("winui-gallery");
  const { state, output } = await createEnabledGalleryState(root, [record]);
  state.histories.get("winui-gallery").syncs.push({
    id: "older-sync",
    reviewedAt: "2026-08-01T12:00:00Z",
    lockCommitSha: output.lock.commitSha,
  });

  await assert.doesNotReject(mergeProviderOutputs(state, [output]));
  state.histories.get("winui-gallery").syncs.reverse();
  await assert.doesNotReject(mergeProviderOutputs(state, [output]));
});

test("provider completeness is enforced only when explicitly enabled", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "external-completeness-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const record = await loadRecordFixture("winui-gallery");
  const { state, output } = await createEnabledGalleryState(root, [record]);
  const provider = state.providers.get("winui-gallery");
  provider.completenessPolicy = "enforced";
  provider.expectedRecordCount = 2;

  await assert.rejects(
    mergeProviderOutputs(state, [output]),
    /expected 2 records, received 1/,
  );
});
