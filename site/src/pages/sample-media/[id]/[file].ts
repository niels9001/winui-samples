import { readFile } from "node:fs/promises";

import type {
  APIRoute,
  GetStaticPaths,
} from "astro";

import { catalog } from "../../../lib/catalog-data";
import type { HeroMedia } from "../../../lib/sample-media";
import { resolveAllHeroMedia } from "../../../lib/sample-media";

interface Props {
  media: HeroMedia;
}

export const getStaticPaths = (async () => {
  const media = await resolveAllHeroMedia(catalog.samples);
  return media.map((entry) => ({
    params: {
      id: entry.sampleId,
      file: entry.filename,
    },
    props: { media: entry },
  }));
}) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => {
  const { media } = props as Props;
  const bytes = await readFile(media.sourcePath);

  return new Response(bytes, {
    headers: {
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Type": media.contentType,
    },
  });
};
