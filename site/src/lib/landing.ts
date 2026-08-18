import type { CatalogSample, SampleCatalog } from "./catalog";
import {
  createDefaultExplorerState,
  serializeExplorerState,
  type ExplorerFacetKey,
} from "./explorer";

const featuredIds = [
  "camera",
  "file-access",
  "bluetooth",
  "xaml-drag-and-drop",
  "media-transcoding",
  "speech-recognition-and-synthesis",
] as const;

export interface OutcomeLink {
  title: string;
  description: string;
  facet: ExplorerFacetKey;
  value: string;
}

export const outcomeLinks: readonly OutcomeLink[] = [
  {
    title: "Build app foundations",
    description: "Handle lifecycle, activation, settings, and app services.",
    facet: "primaryCategory",
    value: "app-fundamentals",
  },
  {
    title: "Build with controls",
    description: "Compose XAML, input, focus, layout, and interaction patterns.",
    facet: "primaryCategory",
    value: "ui-and-input",
  },
  {
    title: "Work with files",
    description: "Pick, persist, transform, index, and exchange app data.",
    facet: "primaryCategory",
    value: "files-and-data",
  },
  {
    title: "Connect devices",
    description: "Discover, pair, and communicate with nearby hardware.",
    facet: "primaryCategory",
    value: "devices-and-sensors",
  },
  {
    title: "Create media experiences",
    description: "Capture, play, cast, and process audio or video.",
    facet: "primaryCategory",
    value: "media",
  },
] as const;

export function selectFeaturedSamples(
  samples: CatalogSample[],
  limit = 6,
): CatalogSample[] {
  const byId = new Map(samples.map((sample) => [sample.id, sample]));
  const selected = featuredIds.flatMap((id) => {
    const sample = byId.get(id);
    return sample ? [sample] : [];
  });
  for (const sample of samples) {
    if (selected.length >= limit) {
      break;
    }
    if (!selected.some((entry) => entry.id === sample.id)) {
      selected.push(sample);
    }
  }
  return selected.slice(0, limit);
}

export function originalSourceSampleCount(catalog: SampleCatalog): number {
  return new Set(
    catalog.samples.flatMap((sample) =>
      sample.originalSamples.map((original) => original.url),
    ),
  ).size;
}

export function outcomeBrowsePath(outcome: OutcomeLink): string {
  const state = createDefaultExplorerState();
  state.facets[outcome.facet] = [outcome.value];
  const query = serializeExplorerState(state).toString();
  return `/samples/${query ? `?${query}` : ""}`;
}
