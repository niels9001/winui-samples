import type {
  CatalogSample,
  SampleCatalog,
} from "./catalog";

export type DetailRouteDefinition =
  | {
      kind: "sample";
      id: string;
      sample: CatalogSample;
    }
  | {
      kind: "redirect";
      id: string;
      redirectTo: string;
    };

export function getDetailRouteDefinitions(
  catalog: SampleCatalog,
): DetailRouteDefinition[] {
  const routes: DetailRouteDefinition[] = catalog.samples.map((sample) => ({
    kind: "sample",
    id: sample.id,
    sample,
  }));
  const claimedIds = new Set(routes.map((route) => route.id));
  const sampleByGlobalId = new Map(
    catalog.samples
      .filter((sample) => sample.globalId)
      .map((sample) => [sample.globalId as string, sample]),
  );

  for (const redirect of catalog.routes?.redirects ?? []) {
    const match = /^samples\/([^/]+)$/.exec(redirect.fromPath);
    if (!match?.[1]) {
      throw new Error(
        `Redirect path cannot be represented by the static detail route: ${redirect.fromPath}`,
      );
    }
    const target = sampleByGlobalId.get(redirect.toId);
    if (!target) {
      throw new Error(`Redirect target is absent: ${redirect.toId}`);
    }
    const id = match[1];
    if (claimedIds.has(id)) {
      throw new Error(`Redirect route collides with an existing detail route: ${id}`);
    }
    claimedIds.add(id);
    routes.push({
      kind: "redirect",
      id,
      redirectTo: target.id,
    });
  }

  return routes;
}
