import assert from "node:assert/strict";
import {
  mkdtemp,
  readFile,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  canonicalStringify,
  hashCanonicalJson,
} from "../../external-catalog/lib/canonical.mjs";
import {
  generatePortalCatalog,
  normalizeSearchText,
} from "../generate.mjs";

const localPath = path.resolve(
  "site",
  "src",
  "generated",
  "local-sample-catalog.json",
);
const externalPath = path.resolve(
  "external",
  "generated",
  "catalog.json",
);

test("portal catalog joins all providers with stable unique routes", async () => {
  const [catalog, local] = await Promise.all([
    generatePortalCatalog({ localPath, externalPath }),
    readFile(localPath, "utf8").then(JSON.parse),
  ]);
  assert.equal(catalog.samples.length, 233);
  assert.deepEqual(
    catalog.providers.map(({ id, label, recordCount }) => ({
      id,
      label,
      recordCount,
    })),
    [
      { id: "winui-samples", label: "WinUI samples", recordCount: 71 },
      { id: "winui-gallery", label: "WinUI Gallery", recordCount: 120 },
      {
        id: "windows-app-sdk-samples",
        label: "Windows App SDK samples",
        recordCount: 42,
      },
    ],
  );
  assert.equal(new Set(catalog.samples.map((sample) => sample.id)).size, 233);
  assert.equal(
    new Set(catalog.samples.map((sample) => sample.globalId)).size,
    233,
  );
  assert.equal(
    new Set(catalog.samples.map((sample) => sample.routePath)).size,
    233,
  );
  assert.deepEqual(
    catalog.samples
      .filter((sample) => sample.provider.id === "winui-samples")
      .map((sample) => [sample.id, sample.routePath]),
    local.samples.map((sample) => [sample.id, `samples/${sample.id}`]),
  );
  const fileAccess = catalog.samples.find(
    (sample) => sample.id === "file-access",
  );
  assert.ok(fileAccess);
  assert.deepEqual(fileAccess.languages, ["C#", "XAML"]);
});

test("external granularity and technical-null summaries remain intact", async () => {
  const catalog = await generatePortalCatalog({ localPath, externalPath });
  const gallery = catalog.samples.filter(
    (sample) => sample.provider.id === "winui-gallery",
  );
  const windows = catalog.samples.filter(
    (sample) => sample.provider.id === "windows-app-sdk-samples",
  );
  const galleryRecords = gallery.map((sample) => sample.federated.record);
  const windowsRecords = windows.map((sample) => sample.federated.record);
  assert.equal(
    galleryRecords.reduce(
      (total, record) => total + record.content.examples.length,
      0,
    ),
    330,
  );
  assert.equal(
    new Set(
      galleryRecords.flatMap((record) =>
        record.featuredSourceFiles
          .map((file) => file.path)
          .filter(
            (sourcePath) =>
              sourcePath.endsWith(".txt") &&
              !sourcePath.includes("/Samples/SampleCode/"),
          ),
      ),
    ).size,
    316,
  );
  assert.equal(
    new Set(
      galleryRecords.flatMap((record) =>
        record.featuredSourceFiles.map((file) => file.path),
      ),
    ).size,
    575,
  );
  assert.equal(
    new Set(
      galleryRecords.flatMap((record) =>
        record.images.map((image) => image.path),
      ),
    ).size,
    102,
  );
  assert.equal(
    windowsRecords.reduce(
      (total, record) => total + record.content.variants.length,
      0,
    ),
    216,
  );
  assert.equal(
    windowsRecords.reduce(
      (total, record) => total + record.content.scenarios.length,
      0,
    ),
    72,
  );
  assert.equal(
    windowsRecords.find((record) => record.recordKey === "windows-ai")
      .content.examples.length,
    20,
  );
  const secureUi = catalog.samples.find(
    (sample) =>
      sample.globalId === "windows-app-sdk-samples:secure-ui",
  );
  assert.equal(secureUi.summary, null);
});

test("search projection is complete, versioned, and excludes review internals", async () => {
  const catalog = await generatePortalCatalog({ localPath, externalPath });
  assert.equal(catalog.searchIndex.schemaVersion, 1);
  assert.equal(catalog.searchIndex.records.length, 233);
  const { contentHash, ...core } = catalog.searchIndex;
  assert.equal(contentHash, hashCanonicalJson(core));
  const serialized = canonicalStringify(catalog.searchIndex);
  for (const forbidden of [
    "cachePath",
    "licenseRefs",
    "metadata.warnings",
    "pull request",
    "migration notes",
  ]) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
  assert.ok(
    catalog.searchIndex.records.some((entry) =>
      entry.searchGroups.technical.includes("d3d9exsample vcxproj"),
    ),
  );
  assert.ok(
    catalog.searchIndex.records.some((entry) =>
      entry.searchGroups.scenarios.includes("window basics"),
    ),
  );
  assert.equal(normalizeSearchText("C#"), "csharp");
  assert.equal(normalizeSearchText("C++"), "cplusplus");
  assert.notEqual(normalizeSearchText("C#"), normalizeSearchText("C++"));
  const nestedRecord = catalog.samples.find((sample) => {
    const content = sample.federated?.record.content;
    return (
      content &&
      [content.variants, content.scenarios, content.examples].filter(
        (group) => group.length > 0,
      ).length > 1
    );
  });
  assert.ok(nestedRecord);
  const nestedContent = nestedRecord.federated.record.content;
  const nestedEntry = catalog.searchIndex.records.find(
    (entry) => entry.sample.id === nestedRecord.id,
  );
  assert.ok(nestedEntry);
  assert.equal(
    nestedEntry.sample.contentCount,
    nestedContent.variants.length +
      nestedContent.scenarios.length +
      nestedContent.examples.length,
  );
  assert.equal(nestedEntry.sample.contentLabel, "nested items");
  for (const entry of catalog.searchIndex.records) {
    for (const [facet, values] of Object.entries(entry.facets)) {
      for (const value of values) {
        assert.ok(
          entry.facetLabels[facet][value],
          `${entry.sample.id}: missing ${facet} label for ${value}`,
        );
      }
    }
  }
  const listViewEntry = catalog.searchIndex.records.find((entry) =>
    entry.facets.tag.includes("listview"),
  );
  assert.ok(listViewEntry);
  assert.equal(listViewEntry.facetLabels.tag.listview, "ListView");
});

test("generation is byte-identical across repeated cold outputs", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "portal-catalog-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const first = await generatePortalCatalog({ localPath, externalPath });
  const second = await generatePortalCatalog({ localPath, externalPath });
  assert.equal(canonicalStringify(second), canonicalStringify(first));
});
