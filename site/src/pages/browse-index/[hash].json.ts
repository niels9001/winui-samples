import type {
  APIRoute,
  GetStaticPaths,
} from "astro";

import { getBrowseIndexArtifact } from "../../lib/browse-index";

interface Props {
  body: string;
  integrity: string;
}

export const getStaticPaths = (async () => {
  const artifact = await getBrowseIndexArtifact();
  return [
    {
      params: {
        hash: artifact.filename.slice(0, -".json".length),
      },
      props: {
        body: artifact.body,
        integrity: artifact.integrity,
      },
    },
  ];
}) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => {
  const { body, integrity } = props as Props;
  return new Response(body, {
    headers: {
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Type": "application/json; charset=utf-8",
      Digest: integrity,
    },
  });
};
