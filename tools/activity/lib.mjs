import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const IMPLEMENTATION_EXTENSIONS = new Set([
  ".c",
  ".cc",
  ".cpp",
  ".cs",
  ".h",
  ".hpp",
  ".idl",
  ".props",
  ".targets",
  ".xaml",
]);
const PROJECT_EXTENSIONS = new Set([".csproj", ".sln", ".vcxproj"]);
const MANIFEST_NAMES = new Set(["appxmanifest.xml", "package.appxmanifest"]);
const MEDIA_EXTENSIONS = new Set([
  ".gif",
  ".jpeg",
  ".jpg",
  ".png",
  ".svg",
  ".webp",
]);

function extension(filePath) {
  const dot = filePath.lastIndexOf(".");
  return dot < 0 ? "" : filePath.slice(dot).toLocaleLowerCase("en-US");
}

function basename(filePath) {
  return filePath.split("/").at(-1)?.toLocaleLowerCase("en-US") ?? "";
}

function isMetadataOnlyPath(filePath, sampleRoot) {
  const relative = filePath.slice(sampleRoot.length + 1);
  const name = basename(relative);
  return (
    name === "readme.md" ||
    name === "sample.yml" ||
    relative.startsWith("media/") ||
    MEDIA_EXTENSIONS.has(extension(relative))
  );
}

function isFunctionalPath(filePath, sampleRoot) {
  const relative = filePath.slice(sampleRoot.length + 1);
  const name = basename(relative);
  return (
    IMPLEMENTATION_EXTENSIONS.has(extension(relative)) ||
    PROJECT_EXTENSIONS.has(extension(relative)) ||
    MANIFEST_NAMES.has(name) ||
    relative.toLocaleLowerCase("en-US").startsWith("assets/")
  );
}

function relevantPaths(file) {
  return [file.filename, file.previous_filename].filter(
    (value) => typeof value === "string" && value.length > 0,
  );
}

export function classifySampleChange(sample, files) {
  const root = sample.project.repositoryPath.replaceAll("\\", "/");
  const matched = files.filter((file) =>
    relevantPaths(file).some(
      (filePath) => filePath === root || filePath.startsWith(`${root}/`),
    ),
  );
  if (matched.length === 0) {
    return undefined;
  }

  const addedProject = matched.some(
    (file) =>
      file.status === "added" &&
      relevantPaths(file).some(
        (filePath) =>
          filePath.startsWith(`${root}/`) &&
          PROJECT_EXTENSIONS.has(extension(filePath)),
      ),
  );
  if (addedProject) {
    return "new";
  }

  const functional = matched.some((file) =>
    relevantPaths(file).some((filePath) => isFunctionalPath(filePath, root)),
  );
  if (functional) {
    return "updated";
  }

  const metadataOnly = matched.every((file) =>
    relevantPaths(file).every((filePath) => isMetadataOnlyPath(filePath, root)),
  );
  return metadataOnly ? "refreshed" : undefined;
}

function assertPullRequest(value) {
  if (
    !value ||
    typeof value !== "object" ||
    !Number.isInteger(value.number) ||
    typeof value.title !== "string" ||
    typeof value.html_url !== "string" ||
    typeof value.merged_at !== "string"
  ) {
    throw new Error("GitHub returned a malformed merged pull request.");
  }
}

function assertFile(value) {
  if (
    !value ||
    typeof value !== "object" ||
    typeof value.filename !== "string" ||
    typeof value.status !== "string"
  ) {
    throw new Error("GitHub returned a malformed pull request file.");
  }
}

export async function fetchGitHubPage(fetchImpl, url, token) {
  const response = await fetchImpl(url, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!response.ok) {
    const remaining = response.headers.get("x-ratelimit-remaining");
    if (response.status === 403 && remaining === "0") {
      throw new Error("GitHub API rate limit exhausted while generating activity.");
    }
    throw new Error(
      `GitHub activity request failed with ${response.status} ${response.statusText}.`,
    );
  }

  const value = await response.json();
  if (!Array.isArray(value)) {
    throw new Error("GitHub activity response must be an array.");
  }
  return value;
}

export async function fetchPaginated(
  fetchImpl,
  firstUrl,
  token,
  { maxPages = 4, perPage = 100 } = {},
) {
  const items = [];
  for (let page = 1; page <= maxPages; page += 1) {
    const separator = firstUrl.includes("?") ? "&" : "?";
    const pageItems = await fetchGitHubPage(
      fetchImpl,
      `${firstUrl}${separator}per_page=${perPage}&page=${page}`,
      token,
    );
    items.push(...pageItems);
    if (pageItems.length < perPage) {
      break;
    }
  }
  return items;
}

export function mapPullRequestsToActivity(pullRequests, filesByPull, catalog) {
  const entries = [];
  for (const pullRequest of pullRequests) {
    assertPullRequest(pullRequest);
    const files = filesByPull.get(pullRequest.number);
    if (!Array.isArray(files)) {
      throw new Error(`Missing files for pull request #${pullRequest.number}.`);
    }
    files.forEach(assertFile);

    for (const sample of catalog.samples) {
      const kind = classifySampleChange(sample, files);
      if (kind) {
        entries.push({
          sampleId: sample.id,
          kind,
          mergedAt: pullRequest.merged_at,
          pullRequest: {
            number: pullRequest.number,
            title: pullRequest.title,
            url: pullRequest.html_url,
          },
        });
      }
    }
  }

  const bySample = new Map();
  for (const entry of entries.sort((left, right) =>
    right.mergedAt.localeCompare(left.mergedAt),
  )) {
    const current = bySample.get(entry.sampleId);
    if (!current) {
      bySample.set(entry.sampleId, {
        ...entry,
        provenance: [entry.pullRequest],
      });
      continue;
    }
    if (
      !current.provenance.some(
        (pullRequest) => pullRequest.number === entry.pullRequest.number,
      )
    ) {
      current.provenance.push(entry.pullRequest);
    }
  }

  return [...bySample.values()]
    .sort(
      (left, right) =>
        right.mergedAt.localeCompare(left.mergedAt) ||
        left.sampleId.localeCompare(right.sampleId, "en-US"),
    )
    .slice(0, 12);
}

export async function fetchMergedActivity({
  fetchImpl = fetch,
  repository,
  token,
  catalog,
  maxPullRequests = 30,
}) {
  const baseUrl = `https://api.github.com/repos/${repository}`;
  const closed = await fetchPaginated(
    fetchImpl,
    `${baseUrl}/pulls?state=closed&sort=updated&direction=desc`,
    token,
  );
  const merged = closed
    .filter((pullRequest) => pullRequest?.merged_at)
    .sort((left, right) => right.merged_at.localeCompare(left.merged_at))
    .slice(0, maxPullRequests);
  const filesByPull = new Map();
  for (const pullRequest of merged) {
    assertPullRequest(pullRequest);
    filesByPull.set(
      pullRequest.number,
      await fetchPaginated(
        fetchImpl,
        `${baseUrl}/pulls/${pullRequest.number}/files`,
        token,
        { maxPages: 3 },
      ),
    );
  }
  return mapPullRequestsToActivity(merged, filesByPull, catalog);
}

export async function localMergedPullRequests({
  cwd,
  baseRef = "origin/main",
  exec = execFileAsync,
}) {
  try {
    const { stdout } = await exec(
      "git",
      [
        "log",
        "--merges",
        "--format=%H%x09%aI%x09%s",
        `${baseRef}..HEAD`,
      ],
      { cwd, windowsHide: true },
    );
    return stdout
      .trim()
      .split(/\r?\n/)
      .filter(Boolean)
      .flatMap((line) => {
        const [sha, mergedAt, ...subjectParts] = line.split("\t");
        const title = subjectParts.join("\t");
        const match = /^Merge pull request #(\d+)\b/.exec(title);
        return match
          ? [
              {
                sha,
                mergedAt,
                number: Number(match[1]),
                title,
              },
            ]
          : [];
      });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to inspect local merge history: ${message}`);
  }
}
