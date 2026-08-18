import assert from "node:assert/strict";
import {
  mkdtemp,
  rm,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  readCacheEntry,
} from "../lib/cache.mjs";
import {
  assertHtmlSafeValue,
  assertOfflineAdapterSource,
  assertRecordAssetBudget,
  assertSafePosixPath,
  findExactGitEntry,
  validateMediaArtifact,
  validateTextArtifact,
} from "../lib/guards.mjs";
import {
  createEnabledGalleryState,
  loadRecordFixture,
} from "./fixtures.mjs";

test("safe paths reject traversal, encoded traversal, absolute paths, and NUL", () => {
  for (const value of [
    "../secret.txt",
    "folder/../secret.txt",
    "folder/%2e%2e/secret.txt",
    "folder/%2Fsecret.txt",
    "/absolute.txt",
    "C:\\absolute.txt",
    "folder/\0secret.txt",
  ]) {
    assert.throws(() => assertSafePosixPath(value), /path|unsafe|encoded/i);
  }
});

test("HTML safety permits technical angle brackets but rejects executable markup", () => {
  assert.doesNotThrow(() =>
    assertHtmlSafeValue({
      text: "Use <Button> with List<T> in this developer-facing description.",
    }),
  );
  assert.throws(
    () => assertHtmlSafeValue({ text: "<script>alert(1)</script>" }),
    /raw HTML/,
  );
});

test("offline provider adapters cannot import I/O or call fetch", () => {
  assert.doesNotThrow(() =>
    assertOfflineAdapterSource(
      'export async function generate({ readArtifact }) { return JSON.parse(await readArtifact("Data.json")); }',
    ),
  );
  assert.throws(
    () =>
      assertOfflineAdapterSource(
        'import { createGitHubClient } from "../lib/network.mjs";',
      ),
    /network client/,
  );
  assert.throws(
    () => assertOfflineAdapterSource('import fs from "node:fs/promises";'),
    /cannot import node:fs/,
  );
  assert.throws(
    () => assertOfflineAdapterSource("const value = await fetch(url);"),
    /cannot call fetch/,
  );
});

test("Git tree lookup enforces exact case and denies symlinks and submodules", () => {
  const entries = [
    { path: "Source/App.cs", mode: "100644", type: "blob" },
    { path: "Source/Link.cs", mode: "120000", type: "blob" },
    { path: "Source/Vendor", mode: "160000", type: "commit" },
  ];
  assert.equal(findExactGitEntry(entries, "Source/App.cs"), entries[0]);
  assert.throws(
    () => findExactGitEntry(entries, "source/app.cs"),
    /casing mismatch/,
  );
  assert.throws(
    () => findExactGitEntry(entries, "Source/Link.cs"),
    /symbolic links/,
  );
  assert.throws(
    () => findExactGitEntry(entries, "Source/Vendor"),
    /submodules/,
  );
});

test("text guards reject binary, invalid UTF-8, oversize, and secrets", () => {
  assert.throws(
    () =>
      validateTextArtifact({
        path: "Source/App.cs",
        bytes: Buffer.from([0, 1]),
      }),
    /binary/,
  );
  assert.throws(
    () =>
      validateTextArtifact({
        path: "Source/App.cs",
        bytes: Buffer.from([0xc3, 0x28]),
      }),
    /UTF-8/,
  );
  assert.throws(
    () =>
      validateTextArtifact({
        path: "Source/App.cs",
        bytes: Buffer.from("abc"),
        maxBytes: 2,
      }),
    /exceeds/,
  );
  assert.throws(
    () =>
      validateTextArtifact({
        path: "Source/.env",
        bytes: Buffer.from("SAFE=value"),
      }),
    /secret-like files/,
  );
  assert.throws(
    () =>
      validateTextArtifact({
        path: "Source/App.cs",
        bytes: Buffer.from(
          'const token = "github_pat_abcdefghijklmnopqrstuvwxyz123456";',
        ),
      }),
    /secret-like content/,
  );
});

test("media and aggregate guards enforce MIME, signature, and byte caps", () => {
  const png = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);
  assert.deepEqual(
    validateMediaArtifact({
      path: "Assets/Preview.png",
      bytes: png,
      mediaType: "image/png",
    }),
    { mediaType: "image/png", size: png.byteLength },
  );
  assert.throws(
    () =>
      validateMediaArtifact({
        path: "Assets/Preview.png",
        bytes: Buffer.from("not png"),
        mediaType: "image/png",
      }),
    /signature/,
  );
  assert.throws(
    () => assertRecordAssetBudget([{ size: 6 }], 5),
    /aggregate limit/,
  );
});

test("cache reads valid content offline and fails cold or hash-mismatched", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "external-cache-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const record = await loadRecordFixture("winui-gallery");
  const { state, entry, payloadPath, bytes } =
    await createEnabledGalleryState(root, [record]);

  assert.deepEqual(await readCacheEntry(state, entry, { repoRoot: root }), bytes);
  await assert.rejects(
    readCacheEntry(
      state,
      { ...entry, blobSha: "0".repeat(40) },
      { repoRoot: root },
    ),
    /Git blob SHA mismatch/,
  );

  await writeFile(payloadPath, Buffer.from('{"fixture":fals}\n', "utf8"));
  await assert.rejects(
    readCacheEntry(state, entry, { repoRoot: root }),
    /SHA-256 mismatch/,
  );

  await unlink(payloadPath);
  await assert.rejects(
    readCacheEntry(state, entry, { repoRoot: root }),
    /unavailable offline/,
  );
});
