import assert from "node:assert/strict";
import test from "node:test";

import {
  classifySampleChange,
  fetchMergedActivity,
  fetchGitHubPage,
  fetchPaginated,
  localMergedPullRequests,
  mapPullRequestsToActivity,
} from "../lib.mjs";

const sample = {
  id: "file-access",
  project: { repositoryPath: "Samples/FileAccess" },
};
const catalog = { samples: [sample] };

test("classifies new, updated, and refreshed sample changes honestly", () => {
  assert.equal(
    classifySampleChange(sample, [
      {
        filename: "Samples/FileAccess/FileAccess.csproj",
        status: "added",
      },
    ]),
    "new",
  );
  assert.equal(
    classifySampleChange(sample, [
      { filename: "Samples/FileAccess/MainPage.xaml.cs", status: "modified" },
    ]),
    "updated",
  );
  assert.equal(
    classifySampleChange(sample, [
      { filename: "Samples/FileAccess/README.md", status: "modified" },
      { filename: "Samples/FileAccess/media/hero.webp", status: "added" },
    ]),
    "refreshed",
  );
  assert.equal(
    classifySampleChange(sample, [
      { filename: "site/src/pages/index.astro", status: "modified" },
    ]),
    undefined,
  );
});

test("uses renamed file provenance when mapping projects", () => {
  assert.equal(
    classifySampleChange(sample, [
      {
        filename: "Samples/Renamed/MainPage.xaml",
        previous_filename: "Samples/FileAccess/MainPage.xaml",
        status: "renamed",
      },
    ]),
    "updated",
  );
});

test("deduplicates by latest merge while retaining ordered provenance", () => {
  const pulls = [
    {
      number: 8,
      title: "Latest",
      html_url: "https://github.com/o/r/pull/8",
      merged_at: "2026-08-17T12:00:00Z",
    },
    {
      number: 7,
      title: "Earlier",
      html_url: "https://github.com/o/r/pull/7",
      merged_at: "2026-08-16T12:00:00Z",
    },
  ];
  const files = new Map(
    pulls.map((pull) => [
      pull.number,
      [{ filename: "Samples/FileAccess/README.md", status: "modified" }],
    ]),
  );
  const [entry] = mapPullRequestsToActivity(pulls, files, catalog);
  assert.equal(entry.pullRequest.number, 8);
  assert.deepEqual(
    entry.provenance.map((pull) => pull.number),
    [8, 7],
  );
});

test("paginates bounded GitHub collections", async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    const page = new URL(url).searchParams.get("page");
    return new Response(JSON.stringify(page === "1" ? [{ id: 1 }] : []));
  };
  const result = await fetchPaginated(fetchImpl, "https://example.test/items", "x", {
    perPage: 1,
    maxPages: 3,
  });

  test("limits activity after sorting by merge time", async () => {
    const pullRequests = [
      {
        number: 1,
        title: "Older but recently updated",
        html_url: "https://github.com/o/r/pull/1",
        merged_at: "2026-08-01T12:00:00Z",
      },
      {
        number: 2,
        title: "Newest merge",
        html_url: "https://github.com/o/r/pull/2",
        merged_at: "2026-08-17T12:00:00Z",
      },
      {
        number: 3,
        title: "Middle merge",
        html_url: "https://github.com/o/r/pull/3",
        merged_at: "2026-08-10T12:00:00Z",
      },
    ];
    const fetchImpl = async (url) => {
      if (url.includes("/files")) {
        return new Response(
          JSON.stringify([
            { filename: "Samples/FileAccess/README.md", status: "modified" },
          ]),
        );
      }
      return new Response(JSON.stringify(pullRequests));
    };
    const [entry] = await fetchMergedActivity({
      fetchImpl,
      repository: "o/r",
      token: "x",
      catalog,
      maxPullRequests: 2,
    });
    assert.equal(entry.pullRequest.number, 2);
    assert.deepEqual(
      entry.provenance.map((pull) => pull.number),
      [2, 3],
    );
  });
  assert.equal(result.length, 1);
  assert.equal(calls.length, 2);
});

test("reports rate limits and malformed responses explicitly", async () => {
  await assert.rejects(
    fetchGitHubPage(
      async () =>
        new Response("{}", {
          status: 403,
          statusText: "Forbidden",
          headers: { "x-ratelimit-remaining": "0" },
        }),
      "https://example.test",
      "secret",
    ),
    /rate limit exhausted/,
  );
  await assert.rejects(
    fetchGitHubPage(
      async () => new Response("{}"),
      "https://example.test",
      "secret",
    ),
    /must be an array/,
  );
});

test("local fallback only returns merge commits with real PR numbers", async () => {
  const entries = await localMergedPullRequests({
    cwd: ".",
    exec: async () => ({
      stdout:
        "abc\t2026-08-17T12:00:00Z\tMerge pull request #12 from owner/topic\n" +
        "def\t2026-08-16T12:00:00Z\tMerge synchronized branch\n",
    }),
  });
  assert.deepEqual(entries.map((entry) => entry.number), [12]);
});
