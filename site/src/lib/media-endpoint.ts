import { readFile } from "node:fs/promises";

import type {
  APIRoute,
  GetStaticPaths,
} from "astro";

import { catalog } from "./catalog-data";
import type { HeroMedia } from "./sample-media";
import { resolveAllCatalogMedia } from "./sample-media";

interface Props {
  media: HeroMedia;
}

type MediaExtension = "jpg" | "png" | "webp";

export function createMediaEndpoint(extension: MediaExtension) {
  const suffix = `.${extension}`;
  const getStaticPaths = (async () => {
    const media = await resolveAllCatalogMedia(catalog.samples);
    return media
      .filter((entry) => entry.filename.endsWith(suffix))
      .map((entry) => ({
        params: {
          id: entry.sampleId,
          file: entry.filename.slice(0, -suffix.length),
        },
        props: { media: entry },
      }));
  }) satisfies GetStaticPaths;

  const GET: APIRoute = async ({ props }) => {
    const { media } = props as Props;
    const bytes = await readFile(media.sourcePath);

    return new Response(bytes, {
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Type": media.contentType,
      },
    });
  };

  return { GET, getStaticPaths };
}
