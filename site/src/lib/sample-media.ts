import { createHash } from "node:crypto";
import { lstat, realpath } from "node:fs/promises";
import { readFile } from "node:fs/promises";
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
  sha256: string;
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

interface LocalHeroSidecar {
  schemaVersion: 1;
  sampleId: string;
  screenshotId: string;
  scenario: string;
  alt: string;
  sourceMetadata: string;
  image: {
    file: "hero.webp" | "hero.png";
    width: number;
    height: number;
    sha256: string;
  };
}

function isMissingPathError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error.code === "ENOENT" || error.code === "ENOTDIR")
  );
}

function parseLocalHeroSidecar(
  sample: CatalogSample,
  source: string,
): LocalHeroSidecar {
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch (error) {
    throw new Error(`${sample.id}: media/hero.json is not valid JSON.`, {
      cause: error,
    });
  }

  const sidecar = value as Partial<LocalHeroSidecar>;
  const image = sidecar.image as Partial<LocalHeroSidecar["image"]> | undefined;
  const expectedMetadata = `${sample.project.repositoryPath}/sample.yml`;
  if (
    sidecar.schemaVersion !== 1 ||
    sidecar.sampleId !== sample.id ||
    typeof sidecar.screenshotId !== "string" ||
    sidecar.screenshotId.trim().length === 0 ||
    typeof sidecar.scenario !== "string" ||
    sidecar.scenario.trim().length === 0 ||
    typeof sidecar.alt !== "string" ||
    sidecar.alt.trim().length === 0 ||
    sidecar.sourceMetadata !== expectedMetadata ||
    !image ||
    !heroCandidates.some((candidate) => candidate.filename === image.file) ||
    !Number.isInteger(image.width) ||
    Number(image.width) <= 0 ||
    !Number.isInteger(image.height) ||
    Number(image.height) <= 0 ||
    typeof image.sha256 !== "string" ||
    !/^[0-9a-f]{64}$/.test(image.sha256)
  ) {
    throw new Error(
      `${sample.id}: media/hero.json does not match the approved screenshot contract.`,
    );
  }

  return sidecar as LocalHeroSidecar;
}

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
      sha256: image.sha256,
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
  let selected:
    | {
        candidate: (typeof heroCandidates)[number];
        sourcePath: string;
      }
    | undefined;

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

      selected = { candidate, sourcePath: realSource };
      break;
    } catch (error) {
      if (isMissingPathError(error)) {
        continue;
      }

      throw error;
    }
  }

  const sidecarPath = path.join(directory, "media", "hero.json");
  let sidecar: LocalHeroSidecar | undefined;
  try {
    const sidecarFile = await lstat(sidecarPath);
    if (!sidecarFile.isFile() || sidecarFile.isSymbolicLink()) {
      throw new Error(`${sample.id}: media/hero.json must be a regular file.`);
    }
    const realSidecar = await realpath(sidecarPath);
    if (!isPathInside(realDirectory, realSidecar)) {
      throw new Error(`${sample.id}: media/hero.json escapes the sample root.`);
    }
    sidecar = parseLocalHeroSidecar(
      sample,
      await readFile(realSidecar, "utf8"),
    );
  } catch (error) {
    if (!isMissingPathError(error)) {
      throw error;
    }
  }

  if (!selected && !sidecar) {
    return undefined;
  }
  if (!selected || !sidecar) {
    throw new Error(
      `${sample.id}: approved hero media requires both an image and media/hero.json.`,
    );
  }
  if (sidecar.image.file !== selected.candidate.filename) {
    throw new Error(
      `${sample.id}: media/hero.json names ${sidecar.image.file}, but ${selected.candidate.filename} has priority.`,
    );
  }

  const imageBytes = await readFile(selected.sourcePath);
  const imageHash = createHash("sha256").update(imageBytes).digest("hex");
  if (imageHash !== sidecar.image.sha256) {
    throw new Error(
      `${sample.id}: ${selected.candidate.filename} does not match the approved SHA-256.`,
    );
  }

  return {
    sampleId: sample.id,
    filename: selected.candidate.filename,
    sourcePath: selected.sourcePath,
    routePath: `/sample-media/${sample.id}/${selected.candidate.filename}`,
    contentType: selected.candidate.contentType,
    alt: sidecar.alt,
    decorative: false,
    width: sidecar.image.width,
    height: sidecar.image.height,
    sha256: sidecar.image.sha256,
  };
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
