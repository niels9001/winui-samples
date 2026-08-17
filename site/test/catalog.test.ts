import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { parseCatalog } from "../src/lib/catalog";

const generatedCatalogUrl = new URL(
  "../src/generated/sample-catalog.json",
  import.meta.url,
);

test("loads the generated partial catalog and FileAccess pilot", async () => {
  const source = await readFile(generatedCatalogUrl, "utf8");
  const catalog = parseCatalog(JSON.parse(source));
  const pilot = catalog.samples.find((sample) => sample.id === "file-access");

  assert.ok(pilot);
  assert.equal(pilot.project.name, "FileAccess");
  assert.equal(
    pilot.title,
    "Reading and writing files in a Windows app",
  );
  assert.ok(catalog.coverage.metadataFiles < catalog.coverage.totalProjects);
});

test("fails clearly when generated data does not match the catalog contract", () => {
  assert.throws(
    () => parseCatalog({ catalogVersion: 1 }),
    /sampleSchemaVersion must be 1/,
  );
});
