import assert from "node:assert/strict";
import test from "node:test";

import { getRelatedSamples } from "../src/lib/related-samples";
import {
  makeCatalog,
  makeSample,
} from "./fixtures";

test("places explicit relationships first and derives weighted candidates", () => {
  const source = makeSample("source", "Working with local app files", {
    categories: {
      primary: "files-and-data",
      secondary: ["app-fundamentals"],
    },
    tags: ["files", "storage"],
    apis: [{ name: "Windows.Storage.StorageFile" }],
    relatedSamples: ["explicit"],
  });
  const explicit = makeSample("explicit", "Rendering a media timeline", {
    categories: { primary: "media" },
    tags: ["video"],
    apis: [{ name: "Windows.Media.Playback.MediaPlayer" }],
  });
  const apiMatch = makeSample("api-match", "Inspecting storage files", {
    categories: { primary: "files-and-data" },
    tags: ["files"],
    apis: [{ name: "Windows.Storage.StorageFile" }],
  });
  const tagOnly = makeSample("tag-only", "Indexing app content", {
    categories: { primary: "app-fundamentals" },
    tags: ["storage"],
  });

  const related = getRelatedSamples(
    source,
    makeCatalog([source, tagOnly, explicit, apiMatch]),
  );

  assert.deepEqual(
    related.map((entry) => entry.sample.id),
    ["explicit", "api-match", "tag-only"],
  );
  assert.equal(related[0]?.explicit, true);
  assert.deepEqual(related[0]?.sharedTopics, ["Curated relation"]);
  assert.ok(
    related[1]?.sharedTopics.some((topic) => topic.includes("StorageFile")),
  );
});

test("uses stable title and id ordering for equal scores", () => {
  const source = makeSample("source", "Building a Windows experience", {
    tags: ["shared"],
  });
  const zeta = makeSample("zeta", "Zeta shared behavior", {
    tags: ["shared"],
  });
  const alpha = makeSample("alpha", "Alpha shared behavior", {
    tags: ["shared"],
  });

  const firstRun = getRelatedSamples(
    source,
    makeCatalog([source, zeta, alpha]),
  );
  const secondRun = getRelatedSamples(
    source,
    makeCatalog([alpha, source, zeta]),
  );

  assert.deepEqual(
    firstRun.map((entry) => entry.sample.id),
    ["alpha", "zeta"],
  );
  assert.deepEqual(
    secondRun.map((entry) => entry.sample.id),
    ["alpha", "zeta"],
  );
});

test("handles a one-record catalog", () => {
  const source = makeSample("source", "Building a Windows experience");
  assert.deepEqual(
    getRelatedSamples(source, makeCatalog([source])),
    [],
  );
});
