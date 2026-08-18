import { createMediaEndpoint } from "../../../lib/media-endpoint";

const endpoint = createMediaEndpoint("webp");

export const getStaticPaths = endpoint.getStaticPaths;
export const GET = endpoint.GET;
