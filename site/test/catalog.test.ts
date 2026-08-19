import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { parseCatalog } from "../src/lib/catalog";
import { getDetailRouteDefinitions } from "../src/lib/detail-routes";
import {
  makeCatalog,
  makeSample,
} from "./fixtures";

const generatedCatalogUrl = new URL(
  "../src/generated/sample-catalog.json",
  import.meta.url,
);

test("loads the generated 233-record catalog and FileAccess pilot", async () => {
  const source = await readFile(generatedCatalogUrl, "utf8");
  const catalog = parseCatalog(JSON.parse(source));
  const pilot = catalog.samples.find((sample) => sample.id === "file-access");

  assert.ok(pilot);
  assert.equal(pilot.project.name, "FileAccess");
  assert.equal(
    pilot.title,
    "Reading and writing files in a Windows app",
  );
  assert.equal(
    catalog.coverage.metadataFiles,
    catalog.coverage.totalProjects,
  );
  assert.equal(
    catalog.coverage.validSamples,
    catalog.coverage.totalProjects,
  );
  assert.equal(catalog.samples.length, 233);
  assert.deepEqual(
    Object.fromEntries(
      catalog.providers?.map((provider) => [
        provider.id,
        provider.recordCount,
      ]) ?? [],
    ),
    {
      "winui-gallery": 120,
      "windows-app-sdk-samples": 42,
      "winui-samples": 71,
    },
  );
  assert.equal(catalog.searchIndex?.records.length, 233);
  assert.deepEqual(
    Object.fromEntries(
      (catalog.searchIndex?.records ?? []).reduce(
        (counts, entry) => {
          const provider = entry.facets.provider?.[0];
          if (provider) {
            counts.set(provider, (counts.get(provider) ?? 0) + 1);
          }
          return counts;
        },
        new Map<string, number>(),
      ),
    ),
    {
      "winui-gallery": 120,
      "windows-app-sdk-samples": 42,
      "winui-samples": 71,
    },
  );
  assert.deepEqual(catalog.coverage.missingProjects, []);
});

test("fails clearly when generated data does not match the catalog contract", () => {
  assert.throws(
    () => parseCatalog({ catalogVersion: 1 }),
    /sampleSchemaVersion must be 1/,
  );
});

test("materializes reviewed redirects as stable static detail routes", () => {
  const target = makeSample("new-route", "Renamed sample");
  target.globalId = "winui-gallery:NewPage";
  const catalog = makeCatalog([target]);
  catalog.routes = {
    detailCount: 1,
    redirects: [
      {
        fromPath: "samples/winui-gallery--oldpage--000000000000",
        toId: target.globalId,
        declaredAtSync: "sync-2",
        reason: "Reviewed immutable-key replacement.",
      },
    ],
  };

  assert.deepEqual(getDetailRouteDefinitions(catalog), [
    { kind: "sample", id: target.id, sample: target },
    {
      kind: "redirect",
      id: "winui-gallery--oldpage--000000000000",
      redirectTo: target.id,
    },
  ]);
});
