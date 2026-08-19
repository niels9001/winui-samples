import assert from "node:assert/strict";
import test from "node:test";

import {
  originalSourceSampleCount,
  outcomeBrowsePath,
  outcomeLinks,
  selectFeaturedSamples,
} from "../src/lib/landing";
import { makeCatalog, makeSample } from "./fixtures";

test("featured selection follows curation and fills missing entries deterministically", () => {
  const samples = [
    makeSample("other", "Other"),
    makeSample("camera", "Camera"),
    makeSample("file-access", "File access"),
  ];
  assert.deepEqual(
    selectFeaturedSamples(samples, 3).map((sample) => sample.id),
    ["camera", "file-access", "other"],
  );
});

test("source proof counts distinct original sample URLs", () => {
  const first = makeSample("first", "First");
  const second = makeSample("second", "Second", {
    originalSamples: [...first.originalSamples],
  });
  assert.equal(originalSourceSampleCount(makeCatalog([first, second])), 1);
});

test("outcome links serialize into shareable Browse filters", () => {
  const outcome = outcomeLinks.at(0);
  assert.ok(outcome);
  assert.equal(
    outcomeBrowsePath(outcome),
    "/samples/?primary=app-fundamentals",
  );
});
