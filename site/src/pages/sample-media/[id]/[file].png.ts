import { createMediaEndpoint } from "../../../lib/media-endpoint";

const endpoint = createMediaEndpoint("png");

export const getStaticPaths = endpoint.getStaticPaths;
export const GET = endpoint.GET;
