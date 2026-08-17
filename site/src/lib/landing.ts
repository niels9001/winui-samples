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
    title: "Connect hardware",
    description: "Pair, discover, and communicate with nearby devices.",
    facet: "primaryCategory",
    value: "devices-and-sensors",
  },
  {
    title: "Work with files and data",
    description: "Persist, transform, index, and exchange app data.",
    facet: "primaryCategory",
    value: "files-and-data",
  },
  {
    title: "Create media experiences",
    description: "Capture, play, cast, and process audio or video.",
    facet: "primaryCategory",
    value: "media",
  },
  {
    title: "Build responsive UI",
    description: "Explore input, focus, layout, and XAML interaction patterns.",
    facet: "primaryCategory",
    value: "ui-and-input",
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

