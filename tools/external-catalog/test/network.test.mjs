import assert from "node:assert/strict";
import test from "node:test";

import {
  GitHubApiError,
  createGitHubClient,
} from "../lib/network.mjs";

function jsonResponse(
  value,
  {
    status = 200,
    url = "https://api.github.com/repos/microsoft/example/resource",
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

test("GitHub requests send pinned headers without serializing the token", async () => {
  const calls = [];
  const token = "github_pat_fixtureTokenValue123456789";
  const client = createGitHubClient({
    token,
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), options });
      return jsonResponse(
        { ok: true },
        { url: String(url), headers: { etag: '"fixture"' } },
      );
    },
  });
  const url = client.repositoryUrl("microsoft", "example", "contents/file.json");
  await client.requestJson(url, {
    repository: { owner: "microsoft", repository: "example" },
  });

  assert.equal(calls[0].options.headers["X-GitHub-Api-Version"], "2022-11-28");
  assert.equal(
    calls[0].options.headers["User-Agent"],
    "winui-samples-external-catalog/1.0",
  );
  assert.equal(calls[0].options.headers.Authorization, `Bearer ${token}`);
  assert.equal(calls[0].options.redirect, "error");
  assert.doesNotMatch(JSON.stringify(client), new RegExp(token));
});

test("ETag cache reuses a prior representation on 304", async () => {
  const calls = [];
  const client = createGitHubClient({
    fetchImpl: async (url, options) => {
      calls.push(options);
      if (calls.length === 1) {
        return jsonResponse(
          { value: 42 },
          { url: String(url), headers: { etag: '"v1"' } },
        );
      }
      return jsonResponse(null, { status: 304, url: String(url) });
    },
  });
  const repository = { owner: "microsoft", repository: "example" };
  const url = client.repositoryUrl("microsoft", "example", "contents/data.json");
  const first = await client.requestJson(url, { repository });
  const second = await client.requestJson(url, { repository });

  assert.deepEqual(first.value, { value: 42 });
  assert.deepEqual(second.value, { value: 42 });
  assert.equal(second.notModified, true);
  assert.equal(calls[1].headers["If-None-Match"], '"v1"');
});

test("pagination follows same-repository Link headers", async () => {
  const client = createGitHubClient({
    fetchImpl: async (url) => {
      const current = new URL(url);
      if (current.searchParams.get("page") === "2") {
        return jsonResponse([3], { url: current.toString() });
      }
      const next =
        "https://api.github.com/repos/microsoft/example/items?page=2";
      return jsonResponse([1, 2], {
        url: current.toString(),
        headers: { link: `<${next}>; rel="next"` },
      });
    },
  });
  const items = await client.paginate(
    "https://api.github.com/repos/microsoft/example/items?page=1",
    {
      repository: { owner: "microsoft", repository: "example" },
    },
  );
  assert.deepEqual(items, [1, 2, 3]);
});

test("truncated Git trees are recursively expanded", async () => {
  const requests = [];
  const client = createGitHubClient({
    fetchImpl: async (url) => {
      const value = String(url);
      requests.push(value);
      if (value.endsWith("/git/trees/root?recursive=1")) {
        return jsonResponse(
          { sha: "root", truncated: true, tree: [] },
          { url: value },
        );
      }
      if (value.endsWith("/git/trees/root")) {
        return jsonResponse(
          {
            sha: "root",
            truncated: false,
            tree: [
              {
                path: "Root.cs",
                mode: "100644",
                type: "blob",
                sha: "blob-root",
              },
              {
                path: "Sub",
                mode: "040000",
                type: "tree",
                sha: "subtree",
              },
            ],
          },
          { url: value },
        );
      }
      if (value.endsWith("/git/trees/subtree")) {
        return jsonResponse(
          {
            sha: "subtree",
            truncated: false,
            tree: [
              {
                path: "Child.cs",
                mode: "100644",
                type: "blob",
                sha: "blob-child",
              },
            ],
          },
          { url: value },
        );
      }
      throw new Error(`unexpected request ${value}`);
    },
  });

  const entries = await client.fetchTree("microsoft", "example", "root");
  assert.deepEqual(
    entries.map((entry) => entry.path),
    ["Root.cs", "Sub", "Sub/Child.cs"],
  );
  assert.equal(requests.length, 3);
});

test("recursive tree fallback fails rather than silently accepting truncation", async () => {
  const client = createGitHubClient({
    fetchImpl: async (url) => {
      const value = String(url);
      if (value.endsWith("?recursive=1")) {
        return jsonResponse(
          { sha: "root", truncated: true, tree: [] },
          { url: value },
        );
      }
      return jsonResponse(
        { sha: "root", truncated: true, tree: [] },
        { url: value },
      );
    },
  });
  await assert.rejects(
    client.fetchTree("microsoft", "example", "root"),
    /remains truncated/,
  );
});

test("Git tree responses must match the requested tree SHA", async () => {
  const client = createGitHubClient({
    fetchImpl: async (url) =>
      jsonResponse(
        { sha: "other", truncated: false, tree: [] },
        { url: String(url) },
      ),
  });
  await assert.rejects(
    client.fetchTree("microsoft", "example", "root"),
    /Git tree response SHA mismatch/,
  );
});

test("same-repository validation rejects redirected responses and pagination", async () => {
  const client = createGitHubClient({
    fetchImpl: async (url) =>
      jsonResponse(
        { ok: true },
        {
          url: "https://api.github.com/repos/microsoft/other/resource",
        },
      ),
  });
  await assert.rejects(
    client.requestJson(
      "https://api.github.com/repos/microsoft/example/resource",
      {
        repository: { owner: "microsoft", repository: "example" },
      },
    ),
    /crossed repository boundary/,
  );

  const paginationClient = createGitHubClient({
    fetchImpl: async (url) =>
      jsonResponse([], {
        url: String(url),
        headers: {
          link:
            '<https://api.github.com/repos/microsoft/other/items?page=2>; rel="next"',
        },
      }),
  });
  await assert.rejects(
    paginationClient.paginate(
      "https://api.github.com/repos/microsoft/example/items?page=1",
      {
        repository: { owner: "microsoft", repository: "example" },
      },
    ),
    /crossed repository boundary/,
  );
});

test("API failures are actionable and redact tokens", async () => {
  const token = "github_pat_fixtureTokenValue123456789";
  const client = createGitHubClient({
    token,
    fetchImpl: async (url) =>
      jsonResponse(
        { message: `bad credential ${token}` },
        {
          status: 401,
          url: String(url),
          headers: { "x-github-request-id": "fixture-request" },
        },
      ),
  });
  const error = await client
    .requestJson("https://api.github.com/repos/microsoft/example/resource", {
      repository: { owner: "microsoft", repository: "example" },
    })
    .catch((value) => value);

  assert.ok(error instanceof GitHubApiError);
  assert.equal(error.status, 401);
  assert.equal(error.requestId, "fixture-request");
  assert.doesNotMatch(error.message, new RegExp(token));
  assert.match(error.message, /\[REDACTED\]/);
});
