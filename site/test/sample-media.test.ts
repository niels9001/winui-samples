import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  resolveAllCatalogMedia,
  resolveHeroMedia,
  resolvePrimaryIconMedia,
} from "../src/lib/sample-media";
import { parseCatalog } from "../src/lib/catalog";
import { fallbackVisualIndex } from "../src/lib/visuals";
import { makeSample } from "./fixtures";

async function writeApprovedHero(
  mediaDirectory: string,
  sample: ReturnType<typeof makeSample>,
  filename: "hero.webp" | "hero.png",
  contents: string,
  overrides: Record<string, unknown> = {},
) {
  const bytes = Buffer.from(contents);
  await writeFile(path.join(mediaDirectory, filename), bytes);
  await writeFile(
    path.join(mediaDirectory, "hero.json"),
    JSON.stringify({
      schemaVersion: 1,
      sampleId: sample.id,
      screenshotId: "primary",
      scenario: "primary",
      alt: "The sample app showing its primary scenario.",
      sourceMetadata: `${sample.project.repositoryPath}/sample.yml`,
      image: {
        file: filename,
        width: 1440,
        height: 900,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      },
      ...overrides,
    }),
  );
}

test("prefers approved WebP, falls back to PNG, and never invents an image URL", async () => {
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

    await writeApprovedHero(mediaDirectory, sample, "hero.png", "png");
    const png = await resolveHeroMedia(sample, root);
    assert.equal(png?.filename, "hero.png");
    assert.equal(png?.alt, "The sample app showing its primary scenario.");
    assert.equal(png?.width, 1440);
    assert.equal(png?.height, 900);
    assert.equal(
      png?.sha256,
      createHash("sha256").update("png").digest("hex"),
    );

    await writeApprovedHero(mediaDirectory, sample, "hero.webp", "webp");
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

test("rejects unpaired or modified local hero media", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "sample-media-invalid-"));
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
    await writeFile(path.join(mediaDirectory, "hero.png"), "unreviewed");
    await assert.rejects(
      resolveHeroMedia(sample, root),
      /requires both an image and media\/hero\.json/,
    );

    await writeApprovedHero(mediaDirectory, sample, "hero.png", "approved");
    await writeFile(path.join(mediaDirectory, "hero.png"), "modified");
    await assert.rejects(
      resolveHeroMedia(sample, root),
      /does not match the approved SHA-256/,
    );

    await writeApprovedHero(mediaDirectory, sample, "hero.png", "approved", {
      sampleId: "another-sample",
    });
    await assert.rejects(
      resolveHeroMedia(sample, root),
      /does not match the approved screenshot contract/,
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

test("preserves decorative Gallery icons and informative provider media", async () => {
  const catalogSource = await readFile(
    new URL("../src/generated/sample-catalog.json", import.meta.url),
    "utf8",
  );
  const catalog = parseCatalog(JSON.parse(catalogSource));
  const media = await resolveAllCatalogMedia(catalog.samples);
  const localIds = new Set(
    catalog.samples
      .filter((sample) => !sample.federated)
      .map((sample) => sample.id),
  );
  const localMedia = media.filter((entry) => localIds.has(entry.sampleId));
  const galleryMedia = media.filter((entry) =>
    entry.sampleId.startsWith("winui-gallery--"),
  );
  const windowsMedia = media.filter((entry) =>
    entry.sampleId.startsWith("windows-app-sdk-samples--"),
  );

  assert.equal(media.length, 170);
  assert.equal(localMedia.length, 48);
  assert.equal(localIds.size - localMedia.length, 23);
  assert.ok(
    localMedia.every(
      (entry) =>
        entry.filename === "hero.png" &&
        entry.width === 1440 &&
        entry.height === 900 &&
        entry.alt.trim().length > 0,
    ),
  );
  const fileAccess = localMedia.find((entry) => entry.sampleId === "file-access");
  assert.equal(fileAccess?.routePath, "/sample-media/file-access/hero.png");
  assert.equal(
    fileAccess?.sha256,
    "144bcaa016ce6be0e94aa7eec454e6418911f15299fc127ab367d237c3cc2eab",
  );
  assert.equal(galleryMedia.length, 120);
  assert.equal(
    new Set(galleryMedia.map((entry) => entry.sourcePath)).size,
    101,
  );
  assert.equal(
    new Set(
      catalog.samples
        .filter((sample) => sample.provider?.id === "winui-gallery")
        .flatMap((sample) =>
          sample.federated?.record.images.map((image) => image.path) ?? [],
        ),
    ).size,
    102,
  );
  assert.ok(
    galleryMedia.every(
      (entry) => entry.decorative && entry.alt === "",
    ),
  );
  assert.equal(windowsMedia.length, 2);
  assert.ok(
    windowsMedia.every(
      (entry) => !entry.decorative && entry.alt.trim().length > 0,
    ),
  );

  const button = catalog.samples.find(
    (sample) => sample.globalId === "winui-gallery:Button",
  );
  assert.ok(button);
  assert.equal(await resolveHeroMedia(button), undefined);
  assert.equal((await resolvePrimaryIconMedia(button))?.decorative, true);
});
