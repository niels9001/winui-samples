const defaultApiVersion = "2022-11-28";
const defaultUserAgent = "winui-samples-external-catalog/1.0";

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function redactSecrets(value, secrets = []) {
  let result = String(value)
    .replace(/\bgithub_pat_[A-Za-z0-9_]+\b/g, "[REDACTED]")
    .replace(/\bgh[opsu]_[A-Za-z0-9]+\b/g, "[REDACTED]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+\b/gi, "Bearer [REDACTED]");
  for (const secret of secrets.filter(Boolean)) {
    result = result.replace(
      new RegExp(escapeRegExp(String(secret)), "g"),
      "[REDACTED]",
    );
  }
  return result;
}

function assertRepositoryName(value, label) {
  if (!/^[A-Za-z0-9_.-]+$/.test(value)) {
    throw new Error(`invalid GitHub ${label}: ${value}`);
  }
}

function parseRepositoryApiUrl(value) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.hostname !== "api.github.com") {
    throw new Error(`GitHub API URL must use https://api.github.com: ${value}`);
  }
  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length < 3 || segments[0] !== "repos") {
    throw new Error(`GitHub API URL is not repository-scoped: ${value}`);
  }
  return {
    url,
    owner: decodeURIComponent(segments[1]),
    repository: decodeURIComponent(segments[2]),
  };
}

function assertSameRepositoryUrl(value, expected) {
  const actual = parseRepositoryApiUrl(value);
  if (
    actual.owner.toLowerCase() !== expected.owner.toLowerCase() ||
    actual.repository.toLowerCase() !== expected.repository.toLowerCase()
  ) {
    throw new Error(
      `GitHub response crossed repository boundary: expected ${expected.owner}/${expected.repository}, received ${actual.owner}/${actual.repository}`,
    );
  }
  return actual.url;
}

function parseLinkHeader(value) {
  const links = new Map();
  for (const part of (value ?? "").split(",")) {
    const match = part.match(/^\s*<([^>]+)>\s*;\s*rel="([^"]+)"\s*$/);
    if (match) {
      links.set(match[2], match[1]);
    }
  }
  return links;
}

async function responseErrorMessage(response) {
  let body = "";
  try {
    body = await response.text();
  } catch {
    // The status and request id remain actionable without a response body.
  }
  if (body.length > 4000) {
    body = `${body.slice(0, 4000)}...`;
  }
  try {
    const parsed = JSON.parse(body);
    if (typeof parsed.message === "string") {
      return parsed.message;
    }
  } catch {
    // Plain-text GitHub Enterprise/proxy errors are preserved below.
  }
  return body || response.statusText || "GitHub API request failed";
}

export class GitHubApiError extends Error {
  constructor(message, { status, url, requestId } = {}) {
    super(message);
    this.name = "GitHubApiError";
    this.status = status;
    this.url = url;
    this.requestId = requestId;
  }
}

export function createGitHubClient({
  fetchImpl = globalThis.fetch,
  token = process.env.GITHUB_TOKEN,
  apiVersion = defaultApiVersion,
  userAgent = defaultUserAgent,
  etagCache = new Map(),
} = {}) {
  if (typeof fetchImpl !== "function") {
    throw new Error("a fetch implementation is required");
  }
  const secrets = [token].filter(Boolean);

  async function requestJson(
    urlValue,
    {
      repository,
      etagKey = urlValue,
      cachedValue,
    } = {},
  ) {
    const requestedUrl = repository
      ? assertSameRepositoryUrl(urlValue, repository)
      : parseRepositoryApiUrl(urlValue).url;
    const cached = etagCache.get(etagKey);
    const headers = {
      Accept: "application/vnd.github+json",
      "User-Agent": userAgent,
      "X-GitHub-Api-Version": apiVersion,
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    if (cached?.etag) {
      headers["If-None-Match"] = cached.etag;
    }

    let response;
    try {
      response = await fetchImpl(requestedUrl, {
        method: "GET",
        headers,
        redirect: "error",
      });
    } catch (error) {
      throw new GitHubApiError(
        redactSecrets(`GitHub API request failed: ${error.message}`, secrets),
        { url: requestedUrl.toString() },
      );
    }

    if (repository && response.url) {
      assertSameRepositoryUrl(response.url, repository);
    }
    if (response.status === 304) {
      const value = cached?.value ?? cachedValue;
      if (value === undefined) {
        throw new GitHubApiError(
          "GitHub returned 304 but no cached representation is available",
          {
            status: response.status,
            url: requestedUrl.toString(),
            requestId: response.headers.get("x-github-request-id") ?? undefined,
          },
        );
      }
      return {
        value,
        etag: cached?.etag,
        notModified: true,
        link: response.headers.get("link") ?? cached?.link ?? null,
      };
    }
    if (!response.ok) {
      const detail = await responseErrorMessage(response);
      throw new GitHubApiError(
        redactSecrets(
          `GitHub API ${response.status} for ${requestedUrl}: ${detail}`,
          secrets,
        ),
        {
          status: response.status,
          url: requestedUrl.toString(),
          requestId: response.headers.get("x-github-request-id") ?? undefined,
        },
      );
    }

    let value;
    try {
      value = await response.json();
    } catch (error) {
      throw new GitHubApiError(
        redactSecrets(
          `GitHub API returned invalid JSON for ${requestedUrl}: ${error.message}`,
          secrets,
        ),
        {
          status: response.status,
          url: requestedUrl.toString(),
          requestId: response.headers.get("x-github-request-id") ?? undefined,
        },
      );
    }

    const etag = response.headers.get("etag") ?? undefined;
    const link = response.headers.get("link");
    if (etag) {
      etagCache.set(etagKey, { etag, value, link });
    }
    return {
      value,
      etag,
      notModified: false,
      link,
    };
  }

  async function paginate(urlValue, { repository, select = (value) => value } = {}) {
    if (!repository) {
      throw new Error("pagination requires an expected repository");
    }
    const values = [];
    const seen = new Set();
    let next = urlValue;

    while (next) {
      const nextUrl = assertSameRepositoryUrl(next, repository).toString();
      if (seen.has(nextUrl)) {
        throw new Error(`GitHub pagination loop detected: ${nextUrl}`);
      }
      seen.add(nextUrl);
      const response = await requestJson(nextUrl, { repository });
      const page = select(response.value);
      if (!Array.isArray(page)) {
        throw new Error(`GitHub paginated response is not an array: ${nextUrl}`);
      }
      values.push(...page);
      next = parseLinkHeader(response.link).get("next");
      if (next) {
        assertSameRepositoryUrl(next, repository);
      }
    }
    return values;
  }

  function repositoryUrl(owner, repository, apiPath, search = {}) {
    assertRepositoryName(owner, "owner");
    assertRepositoryName(repository, "repository");
    const url = new URL(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/${apiPath.replace(/^\/+/, "")}`,
      "https://api.github.com",
    );
    for (const [key, value] of Object.entries(search)) {
      url.searchParams.set(key, String(value));
    }
    return url.toString();
  }

  async function fetchTree(owner, repository, treeSha) {
    const expected = { owner, repository };
    function assertTreeIdentity(value, expectedSha) {
      if (value.sha !== expectedSha) {
        throw new Error(
          `Git tree response SHA mismatch: expected ${expectedSha}, received ${value.sha ?? "(missing)"}`,
        );
      }
      if (!Array.isArray(value.tree)) {
        throw new Error(`Git tree response is missing tree entries for ${expectedSha}`);
      }
    }

    const recursiveUrl = repositoryUrl(
      owner,
      repository,
      `git/trees/${treeSha}`,
      { recursive: 1 },
    );
    const recursive = await requestJson(recursiveUrl, {
      repository: expected,
    });
    assertTreeIdentity(recursive.value, treeSha);
    if (!recursive.value.truncated) {
      return recursive.value.tree;
    }

    const visitedTrees = new Set();
    async function visit(sha, prefix) {
      if (visitedTrees.has(sha)) {
        throw new Error(`Git tree cycle detected at ${sha}`);
      }
      visitedTrees.add(sha);
      const response = await requestJson(
        repositoryUrl(owner, repository, `git/trees/${sha}`),
        { repository: expected },
      );
      if (response.value.truncated) {
        throw new Error(
          `Git tree ${sha} remains truncated during explicit recursive fallback`,
        );
      }
      assertTreeIdentity(response.value, sha);

      const entries = [];
      for (const entry of response.value.tree) {
        const entryPath = prefix ? `${prefix}/${entry.path}` : entry.path;
        entries.push({ ...entry, path: entryPath });
        if (entry.type === "tree") {
          entries.push(...(await visit(entry.sha, entryPath)));
        }
      }
      visitedTrees.delete(sha);
      return entries;
    }

    return visit(treeSha, "");
  }

  return Object.freeze({
    requestJson,
    paginate,
    repositoryUrl,
    fetchTree,
  });
}
