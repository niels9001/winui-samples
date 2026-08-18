import assert from "node:assert/strict";
import {
  mkdtemp,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { gitBlobSha } from "../lib/canonical.mjs";
import { createGitHubClient } from "../lib/network.mjs";
import {
  acquirePublishLock,
  fetchGitBlob,
} from "../refresh/winui-gallery.mjs";

function jsonResponse(
  value,
  {
    status = 200,
    url,
    headers = {},
  } = {},
) {
  const response = new Response(
    status === 304 ? null : JSON.stringify(value),
    {
      status,
      headers: {
        "content-type": "application/json",
        ...headers,
      },
    },
  );
  Object.defineProperty(response, "url", { value: url });
  return response;
}

test("explicit refresh blob fetch reuses ETag content on 304", async () => {
  const bytes = Buffer.from("pinned Gallery fixture\n", "utf8");
  const blobSha = gitBlobSha(bytes);
  const calls = [];
  const github = createGitHubClient({
    fetchImpl: async (url, options) => {
      calls.push(options);
      if (calls.length === 1) {
        return jsonResponse(
          {
            sha: blobSha,
            size: bytes.byteLength,
            encoding: "base64",
            content: bytes.toString("base64"),
          },
          {
            url: String(url),
            headers: { etag: '"gallery-blob"' },
          },
        );
      }
      return jsonResponse(null, {
        status: 304,
        url: String(url),
      });
    },
  });
  const context = {
    github,
    repository: { owner: "microsoft", repository: "WinUI-Gallery" },
    owner: "microsoft",
    name: "WinUI-Gallery",
    entry: {
      path: "WinUIGallery/Samples/Button/ButtonPage.xaml",
      mode: "100644",
      type: "blob",
      sha: blobSha,
      size: bytes.byteLength,
    },
  };

  const first = await fetchGitBlob(context);
  const second = await fetchGitBlob(context);
  assert.deepEqual(first.bytes, bytes);
  assert.deepEqual(second.bytes, bytes);
  assert.equal(first.notModified, false);
  assert.equal(second.notModified, true);
  assert.equal(calls[1].headers["If-None-Match"], '"gallery-blob"');
});

test("explicit refresh rejects mismatched Git blob identity and bytes", async () => {
  const bytes = Buffer.from("fixture", "utf8");
  const entry = {
    path: "WinUIGallery/Samples/Button/ButtonPage.xaml",
    mode: "100644",
    type: "blob",
    sha: gitBlobSha(bytes),
    size: bytes.byteLength,
  };
  const github = {
    repositoryUrl: () =>
      "https://api.github.com/repos/microsoft/WinUI-Gallery/git/blobs/fixture",
    requestJson: async () => ({
      value: {
        sha: "0".repeat(40),
        size: bytes.byteLength,
        encoding: "base64",
        content: bytes.toString("base64"),
      },
      notModified: false,
    }),
  };
  await assert.rejects(
    fetchGitBlob({
      github,
      repository: { owner: "microsoft", repository: "WinUI-Gallery" },
      owner: "microsoft",
      name: "WinUI-Gallery",
      entry,
    }),
    /identity or encoding mismatch/,
  );

  github.requestJson = async () => ({
    value: {
      sha: entry.sha,
      size: bytes.byteLength,
      encoding: "base64",
      content: Buffer.from("changed", "utf8").toString("base64"),
    },
    notModified: false,
  });
  await assert.rejects(
    fetchGitBlob({
      github,
      repository: { owner: "microsoft", repository: "WinUI-Gallery" },
      owner: "microsoft",
      name: "WinUI-Gallery",
      entry,
    }),
    /downloaded bytes do not match/,
  );
});

test("OS publication lock rejects concurrent owners and releases cleanly", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "gallery-publish-lock-"));
  t.after(() => rm(root, { recursive: true, force: true }));

  const release = await acquirePublishLock(root);
  await assert.rejects(
    acquirePublishLock(root),
    /another external catalog refresh/,
  );
  await release();

  const releaseAgain = await acquirePublishLock(root);
  await releaseAgain();
});
