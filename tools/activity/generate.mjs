import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { fetchMergedActivity, localMergedPullRequests } from "./lib.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const catalogPath = path.join(
  root,
  "site",
  "src",
  "generated",
  "sample-catalog.json",
);
const outputPath = path.join(
  root,
  "site",
  "src",
  "generated",
  "sample-activity.json",
);
const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
const token = process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;

let source = "offline";
let entries = [];
if (token && repository) {
  source = "github";
  entries = await fetchMergedActivity({ repository, token, catalog });
} else if (process.env.ACTIVITY_GIT_FALLBACK === "1") {
  source = "git";
  const localPullRequests = await localMergedPullRequests({ cwd: root });
  if (localPullRequests.length > 0) {
    console.warn(
      "Local merge history was found, but changed-file provenance is unavailable; emitting an empty activity feed.",
    );
  }
}

await writeFile(
  outputPath,
  `${JSON.stringify({ schemaVersion: 1, source, entries }, null, 2)}\n`,
  "utf8",
);
console.log(`Generated ${outputPath} (${entries.length} activity entries, ${source}).`);

