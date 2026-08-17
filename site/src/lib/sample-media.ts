import { lstat, realpath } from "node:fs/promises";
import path from "node:path";

import type { CatalogSample } from "./catalog";
import {
  isPathInside,
  repositoryRoot,
  sampleDirectory,
} from "./repository-files";

export interface HeroMedia {
  sampleId: string;
  filename: "hero.webp" | "hero.png";
  sourcePath: string;
  routePath: string;
  contentType: "image/webp" | "image/png";
}

const heroCandidates = [
  {
    filename: "hero.webp",
    contentType: "image/webp",
  },
  {
    filename: "hero.png",
    contentType: "image/png",
  },
] as const;

export async function resolveHeroMedia(
  sample: CatalogSample,
  root = repositoryRoot,
): Promise<HeroMedia | undefined> {
  const directory = sampleDirectory(sample, root);
  const realDirectory = await realpath(directory);

  for (const candidate of heroCandidates) {
    const sourcePath = path.join(directory, "media", candidate.filename);

    try {
      const file = await lstat(sourcePath);
      if (!file.isFile() || file.isSymbolicLink()) {
        continue;
      }

      const realSource = await realpath(sourcePath);
      if (!isPathInside(realDirectory, realSource)) {
        continue;
      }

      return {
        sampleId: sample.id,
        filename: candidate.filename,
        sourcePath: realSource,
        routePath: `/sample-media/${sample.id}/${candidate.filename}`,
        contentType: candidate.contentType,
      };
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error.code === "ENOENT" || error.code === "ENOTDIR")
      ) {
        continue;
      }
      throw error;
    }
  }

  return undefined;
}

export async function resolveAllHeroMedia(
  samples: CatalogSample[],
  root = repositoryRoot,
): Promise<HeroMedia[]> {
  const media = await Promise.all(
    samples.map((sample) => resolveHeroMedia(sample, root)),
  );
  return media.filter((entry): entry is HeroMedia => entry !== undefined);
}
