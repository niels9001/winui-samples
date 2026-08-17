import { existsSync } from "node:fs";
import path from "node:path";

import type { CatalogSample } from "./catalog";

function findRepositoryRoot(start: string): string {
  let current = path.resolve(start);

  for (let depth = 0; depth < 5; depth += 1) {
    if (
      existsSync(path.join(current, "Samples")) &&
      existsSync(path.join(current, "site", "package.json"))
    ) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  throw new Error(
    `Could not locate the repository root from ${path.resolve(start)}`,
  );
}

export const repositoryRoot = findRepositoryRoot(process.cwd());

export function isPathInside(parent: string, candidate: string): boolean {
  const relative = path.relative(parent, candidate);
  return (
    relative.length > 0 &&
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}

export function sampleDirectory(
  sample: CatalogSample,
  root = repositoryRoot,
): string {
  const segments = sample.project.repositoryPath.split("/");
  if (
    segments.length === 0 ||
    segments.some(
      (segment) =>
        segment.length === 0 || segment === "." || segment === "..",
    )
  ) {
    throw new Error(
      `Invalid sample repository path: ${sample.project.repositoryPath}`,
    );
  }

  const directory = path.resolve(root, ...segments);
  if (!isPathInside(path.resolve(root), directory)) {
    throw new Error(
      `Sample repository path escapes the repository: ${sample.project.repositoryPath}`,
    );
  }

  return directory;
}
