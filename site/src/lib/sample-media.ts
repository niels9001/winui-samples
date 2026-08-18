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
  filename: string;
  sourcePath: string;
  routePath: string;
  contentType: "image/webp" | "image/png" | "image/jpeg";
  alt: string;
  decorative: boolean;
  width?: number;
  height?: number;
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

const imageExtension = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
]);

async function resolveFederatedMedia(
  sample: CatalogSample,
  root: string,
): Promise<HeroMedia[]> {
  if (!sample.federated) {
    return [];
  }

  const result: HeroMedia[] = [];
  for (const image of sample.federated.record.images) {
    const extension = imageExtension.get(image.mediaType);
    if (!extension) {
      continue;
    }
    const sourcePath = path.join(
      root,
      "external",
      "cache",
      "blobs",
      "sha256",
      image.sha256.slice(0, 2),
      image.sha256,
    );
    const entry = await lstat(sourcePath);
    if (
      !entry.isFile() ||
      entry.isSymbolicLink() ||
      entry.size !== image.size
    ) {
      throw new Error(
        `${sample.globalId ?? sample.id}: cached media ${image.path} is unavailable or mismatched.`,
      );
    }
    const filename = `${image.id}.${extension}`;
    result.push({
      sampleId: sample.id,
      filename,
      sourcePath,
      routePath: `/sample-media/${sample.id}/${filename}`,
      contentType: image.mediaType,
      alt: image.alt,
      decorative: image.decorative,
      ...(image.width ? { width: image.width } : {}),
      ...(image.height ? { height: image.height } : {}),
    });
  }
  return result;
}

export async function resolveHeroMedia(
  sample: CatalogSample,
  root = repositoryRoot,
): Promise<HeroMedia | undefined> {
  if (sample.federated) {
    return (await resolveFederatedMedia(sample, root)).find(
      (media) => !media.decorative,
    );
  }

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
        alt: sample.screenshots[0]?.alt ?? "",
        decorative: false,
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

export async function resolvePrimaryIconMedia(
  sample: CatalogSample,
  root = repositoryRoot,
): Promise<HeroMedia | undefined> {
  return (await resolveFederatedMedia(sample, root)).find(
    (media) => media.decorative,
  );
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

export async function resolveAllCatalogMedia(
  samples: CatalogSample[],
  root = repositoryRoot,
): Promise<HeroMedia[]> {
  const media = await Promise.all(
    samples.map(async (sample) => {
      if (sample.federated) {
        return resolveFederatedMedia(sample, root);
      }
      const hero = await resolveHeroMedia(sample, root);
      return hero ? [hero] : [];
    }),
  );
  return media.flat().filter((entry): entry is HeroMedia => Boolean(entry));
}
