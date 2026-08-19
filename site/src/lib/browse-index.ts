import { createHash } from "node:crypto";

import { catalog } from "./catalog-data";
import type {
  CatalogCategory,
  PortalSearchRecord,
} from "./catalog";
import { resolveHeroMedia } from "./sample-media";
import { sitePath } from "./urls";

export interface BrowseIndexMedia {
  url: string;
  alt: string;
}

export interface BrowseIndexPayload {
  schemaVersion: 1;
  catalogHash: string;
  searchHash: string;
  recordCount: number;
  categories: CatalogCategory[];
  records: PortalSearchRecord[];
  media: Record<string, BrowseIndexMedia>;
}

export interface BrowseIndexArtifact {
  body: string;
  filename: string;
  integrity: string;
  payload: BrowseIndexPayload;
}

let artifactPromise: Promise<BrowseIndexArtifact> | undefined;

export function getBrowseIndexArtifact(): Promise<BrowseIndexArtifact> {
  artifactPromise ??= createBrowseIndexArtifact();
  return artifactPromise;
}

async function createBrowseIndexArtifact(): Promise<BrowseIndexArtifact> {
  if (!catalog.contentHash || !catalog.searchIndex) {
    throw new Error(
      "The generated catalog is missing Browse index integrity metadata.",
    );
  }

  const mediaEntries = await Promise.all(
    catalog.samples.map(async (sample) => {
      const media = await resolveHeroMedia(sample);
      if (!media) {
        return undefined;
      }
      return [
        sample.id,
        {
          url: sitePath(media.routePath),
          alt: media.alt,
        },
      ] as const;
    }),
  );
  const payload: BrowseIndexPayload = {
    schemaVersion: 1,
    catalogHash: catalog.contentHash,
    searchHash: catalog.searchIndex.contentHash,
    recordCount: catalog.searchIndex.records.length,
    categories: catalog.categories,
    records: catalog.searchIndex.records,
    media: Object.fromEntries(
      mediaEntries.filter(
        (entry): entry is NonNullable<typeof entry> => entry !== undefined,
      ),
    ),
  };
  const body = JSON.stringify(payload);
  const digest = createHash("sha256").update(body, "utf8").digest();
  const hash = digest.toString("hex");

  return {
    body,
    filename: `${hash}.json`,
    integrity: `sha256-${digest.toString("base64")}`,
    payload,
  };
}
