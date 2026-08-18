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

import { codeToHtml } from "shiki";

import {
  describeFeaturedFiles,
  featuredFileSizeLimit,
  readFeaturedFile,
  safeFeaturedFileExtensions,
  validateFeaturedFilePath,
} from "../src/lib/featured-files";
import { makeSample } from "./fixtures";

test("allows documented text types and rejects unsafe paths", () => {
  assert.equal(validateFeaturedFilePath("MainPage.xaml.cs").valid, true);
  assert.equal(validateFeaturedFilePath("Package.appxmanifest").valid, true);
  assert.equal(
    validateFeaturedFilePath("content/item.appcontent-ms").valid,
    true,
  );
  assert.equal(
    validateFeaturedFilePath("sketch/SerialCommand.ino").valid,
    true,
  );
  assert.equal(validateFeaturedFilePath("../outside.cs").valid, false);
  assert.equal(validateFeaturedFilePath("Scenarios\\Main.cs").valid, false);
  assert.equal(validateFeaturedFilePath("obj/Generated.cs").valid, false);
  assert.equal(validateFeaturedFilePath("config/secrets.json").valid, false);
  assert.equal(validateFeaturedFilePath("secrets/config.json").valid, false);
  assert.equal(validateFeaturedFilePath(".private/config.json").valid, false);
  assert.equal(validateFeaturedFilePath("x64/Generated.cs").valid, false);
  assert.equal(validateFeaturedFilePath("Assets/logo.png").valid, false);
});

test("maps every allowed extension to a bundled Shiki grammar", async () => {
  const languages = new Set(
    [...safeFeaturedFileExtensions.values()].map(
      (extension) => extension.language,
    ),
  );

  for (const language of languages) {
    await assert.doesNotReject(() =>
      codeToHtml("sample", {
        lang: language,
        theme: "github-light",
      }),
    );
  }
});

test("creates stable code routes and exact main-branch GitHub links", () => {
  const sample = makeSample("file-access", "Reading and writing files", {
    project: {
      folder: "FileAccess",
      name: "FileAccess",
      repositoryPath: "Samples/FileAccess",
    },
    featuredFiles: [
      {
        path: "Scenarios/Scenario1_Create.xaml.cs",
        label: "Create a file",
      },
    ],
  });
  const descriptor = describeFeaturedFiles(sample)[0];
  assert.ok(descriptor);
  assert.match(
    descriptor.key,
    /^scenarios-scenario1-create-xaml-cs-[0-9a-f]{12}$/,
  );
  assert.equal(
    descriptor.routePath,
    `/samples/file-access/code/${descriptor.key}/`,
  );
  assert.equal(
    descriptor.sourceUrl,
    "https://github.com/niels9001/winui-samples/blob/main/Samples/FileAccess/Scenarios/Scenario1_Create.xaml.cs",
  );

  sample.featuredFiles.unshift({
    path: "App.xaml.cs",
    label: "Application entry point",
  });
  const reordered = describeFeaturedFiles(sample).find(
    (file) => file.path === descriptor.path,
  );
  assert.equal(reordered?.key, descriptor.key);

  const collidingSlugs = makeSample("slug-collision", "Slug collision", {
    featuredFiles: [
      { path: "A/B.cs", label: "Nested" },
      { path: "A-B.cs", label: "Flat" },
    ],
  });
  const [nested, flat] = describeFeaturedFiles(collidingSlugs);
  assert.notEqual(nested?.key, flat?.key);
});

test("reads only in-folder UTF-8 files under the size ceiling", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "featured-file-"));
  const sample = makeSample("safe-source", "Reading safe source files", {
    project: {
      folder: "SafeSource",
      name: "SafeSource",
      repositoryPath: "Samples/SafeSource",
    },
    featuredFiles: [
      {
        path: "Scenarios/Main.cs",
        label: "Main implementation",
      },
    ],
  });
  const directory = path.join(root, "Samples", "SafeSource", "Scenarios");

  try {
    await mkdir(directory, { recursive: true });
    await writeFile(
      path.join(directory, "Main.cs"),
      "public sealed class MainPage {}\n",
    );
    const descriptor = describeFeaturedFiles(sample)[0];
    assert.ok(descriptor);
    const result = await readFeaturedFile(sample, descriptor, root);
    assert.equal(result.status, "ready");
    if (result.status === "ready") {
      assert.match(result.code, /MainPage/);
      assert.equal(result.descriptor.language, "csharp");
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("returns a clear fallback for oversized files", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "featured-large-"));
  const sample = makeSample("large-source", "Handling oversized source files", {
    project: {
      folder: "LargeSource",
      name: "LargeSource",
      repositoryPath: "Samples/LargeSource",
    },
    featuredFiles: [{ path: "Large.cs", label: "Large source" }],
  });
  const directory = path.join(root, "Samples", "LargeSource");

  try {
    await mkdir(directory, { recursive: true });
    await writeFile(
      path.join(directory, "Large.cs"),
      Buffer.alloc(featuredFileSizeLimit + 1, 65),
    );
    const descriptor = describeFeaturedFiles(sample)[0];
    assert.ok(descriptor);
    const result = await readFeaturedFile(sample, descriptor, root);
    assert.equal(result.status, "unavailable");
    if (result.status === "unavailable") {
      assert.match(result.reason, /128 KiB preview limit/);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
