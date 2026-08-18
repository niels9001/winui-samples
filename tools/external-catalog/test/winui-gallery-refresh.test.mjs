import assert from "node:assert/strict";
import {
  mkdtemp,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  canonicalStringify,
  gitBlobSha,
} from "../lib/canonical.mjs";
import { loadExternalState } from "../lib/config.mjs";
import { createGitHubClient } from "../lib/network.mjs";
import {
  PROVIDER_ID,
  REVIEWED_SYNC,
} from "../providers/winui-gallery/constants.mjs";
import {
  acquirePublishLock,
  buildReviewDocument,
  buildReviewedHistory,
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

test("refresh merges reviewed history and rejects undeclared removals", async () => {
  const state = await loadExternalState();
  const committed = state.histories.get(PROVIDER_ID);
  const pages = committed.records
    .filter((record) => record.status === "active")
    .map((record) => ({ UniqueId: record.recordKey }));
  assert.equal(
    canonicalStringify(buildReviewedHistory(pages, committed)),
    canonicalStringify(committed),
  );

  const priorSync = {
    id: "winui-gallery@prior-reviewed",
    reviewedAt: "2025-01-01T00:00:00Z",
    lockCommitSha: "0".repeat(40),
  };
  const tombstone = {
    id: `${PROVIDER_ID}:RemovedPage`,
    recordKey: "RemovedPage",
    routePath: "samples/winui-gallery--removedpage--000000000000",
    status: "tombstoned",
    firstSeenSync: priorSync.id,
    lastReviewedSync: priorSync.id,
    lastChangedSync: priorSync.id,
    removedAtSync: priorSync.id,
  };
  const previous = {
    providerId: PROVIDER_ID,
    latestSyncId: priorSync.id,
    syncs: [priorSync],
    records: [
      ...committed.records.map((record) => ({
        ...record,
        firstSeenSync: priorSync.id,
        lastReviewedSync: priorSync.id,
        lastChangedSync: priorSync.id,
      })),
      tombstone,
    ],
  };
  const tombstoneDeclarations = [
    {
      id: tombstone.id,
      removedAtSync: priorSync.id,
      reason: "Reviewed retirement.",
    },
  ];
  const merged = buildReviewedHistory(pages, previous, {
    tombstoneDeclarations,
  });
  assert.deepEqual(
    merged.syncs.map((sync) => sync.id),
    [priorSync.id, REVIEWED_SYNC.id],
  );
  assert.equal(
    merged.records.find((record) => record.id === committed.records[0].id)
      .firstSeenSync,
    priorSync.id,
  );
  assert.equal(
    merged.records.find((record) => record.id === committed.records[0].id)
      .lastChangedSync,
    priorSync.id,
  );
  assert.equal(
    merged.records.find((record) => record.id === tombstone.id).removedAtSync,
    priorSync.id,
  );
  assert.equal(
    merged.records.find((record) => record.id === tombstone.id).lastChangedSync,
    priorSync.id,
  );
  assert.throws(
    () => buildReviewedHistory(pages.slice(1), committed),
    /reviewed active record disappeared/,
  );

  const changedId = committed.records[0].id;
  const contentHashes = new Map(
    committed.records.map((record) => [record.id, record.contentHash]),
  );
  contentHashes.set(changedId, "f".repeat(64));
  const changed = buildReviewedHistory(pages, previous, {
    recordContentHashes: contentHashes,
    tombstoneDeclarations,
  });
  assert.equal(
    changed.records.find((record) => record.id === changedId).lastChangedSync,
    REVIEWED_SYNC.id,
  );
  assert.equal(
    changed.records.find((record) => record.id === committed.records[1].id)
      .lastChangedSync,
    priorSync.id,
  );
});

test("refresh review output preserves decorative icon semantics", () => {
  const review = buildReviewDocument({
    selectedSourcePaths: [],
    imagePaths: [],
    logicalCacheBytes: 0,
    uniqueCacheBytes: 0,
  });
  assert.equal(review.imagePolicy.normalizedDecorative, true);
  assert.equal(review.imagePolicy.integratedAltBesideVisibleTitle, "");
});
