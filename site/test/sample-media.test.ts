import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  resolveHeroMedia,
} from "../src/lib/sample-media";
import { fallbackVisualIndex } from "../src/lib/visuals";
import { makeSample } from "./fixtures";

test("prefers WebP, falls back to PNG, and never invents an image URL", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "sample-media-"));
  const sample = makeSample("media-test", "Showing sample media", {
    project: {
      folder: "MediaTest",
      name: "MediaTest",
      repositoryPath: "Samples/MediaTest",
    },
  });
  const mediaDirectory = path.join(root, "Samples", "MediaTest", "media");

  try {
    await mkdir(mediaDirectory, { recursive: true });
    assert.equal(await resolveHeroMedia(sample, root), undefined);

    await writeFile(path.join(mediaDirectory, "hero.png"), "png");
    assert.equal(
      (await resolveHeroMedia(sample, root))?.filename,
      "hero.png",
    );

    await writeFile(path.join(mediaDirectory, "hero.webp"), "webp");
    const resolved = await resolveHeroMedia(sample, root);
    assert.equal(resolved?.filename, "hero.webp");
    assert.equal(
      resolved?.routePath,
      "/sample-media/media-test/hero.webp",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("produces deterministic category fallback themes", () => {
  assert.equal(
    fallbackVisualIndex("files-and-data"),
    fallbackVisualIndex("files-and-data"),
  );
  assert.ok(fallbackVisualIndex("files-and-data") >= 0);
  assert.ok(fallbackVisualIndex("files-and-data") < 6);
});
