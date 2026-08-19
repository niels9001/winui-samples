import type {
  CatalogCategory,
  CatalogSample,
  FederatedContentUnit,
  PortalSearchRecord,
} from "./catalog";
import { getSampleProvider } from "./source-provenance";

export const explorerFacetKeys = [
  "provider",
  "primaryCategory",
  "secondaryCategory",
  "tag",
  "capability",
  "hardware",
  "accountService",
  "architecture",
  "language",
  "capture",
] as const;

export type ExplorerFacetKey = (typeof explorerFacetKeys)[number];
export const visibleExplorerFacetKeys = explorerFacetKeys.filter(
  (key) => key !== "capture",
);
export type ExplorerSort = "recommended" | "title" | "project";

export interface ExplorerState {
  query: string;
  sort: ExplorerSort;
  facets: Record<ExplorerFacetKey, string[]>;
}

export interface ExplorerFacetOption {
  value: string;
  label: string;
}

export interface ExplorerSampleSummary {
  id: string;
  title: string;
  summary: string;
  project: {
    name: string;
  };
  categories: {
    primary: string;
  };
  contentCount: number;
  contentLabel: string;
  minimumWindowsVersion: string;
  supportedArchitectures: string[];
  languages: string[];
  source: {
    id: string;
    label: string;
  };
}

export interface IndexedSample
  extends Omit<PortalSearchRecord, "sample" | "facets" | "facetLabels"> {
  sample: ExplorerSampleSummary;
  facets: Record<ExplorerFacetKey, string[]>;
  facetLabels: Record<ExplorerFacetKey, Record<string, string>>;
}

const queryParameterByFacet: Record<ExplorerFacetKey, string> = {
  provider: "provider",
  primaryCategory: "primary",
  secondaryCategory: "secondary",
  tag: "tag",
  capability: "capability",
  hardware: "hardware",
  accountService: "service",
  architecture: "arch",
  language: "language",
  capture: "capture",
};

const captureLabels = new Map([
  ["automatic", "Automated preview"],
  ["manual", "Manual preview"],
  ["none", "No preview recipe"],
]);

function compareText(left: string, right: string): number {
  const normalizedLeft = left.toLocaleLowerCase("en-US");
  const normalizedRight = right.toLocaleLowerCase("en-US");

  if (normalizedLeft !== normalizedRight) {
    return normalizedLeft < normalizedRight ? -1 : 1;
  }

  return left === right ? 0 : left < right ? -1 : 1;
}

export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/C\+\+/giu, " cplusplus ")
    .replace(/C#/giu, " csharp ")
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function joinSearchValues(values: Array<string | undefined>): string {
  return normalizeSearchText(values.filter(Boolean).join(" "));
}

function createFacetLabelMap(
  values: string[],
  labels = values,
): Record<string, string> {
  const result: Record<string, string> = {};
  values.forEach((value, index) => {
    const label = labels[index] ?? value;
    const current = result[value];
    if (!current || compareText(label, current) < 0) {
      result[value] = label;
    }
  });
  return result;
}

function captureModes(sample: CatalogSample): string[] {
  if (sample.screenshots.length === 0) {
    return ["none"];
  }

  return sortedUnique(
    sample.screenshots.map((screenshot) => screenshot.capture.mode),
  );
}

function flattenUnits(units: FederatedContentUnit[]): FederatedContentUnit[] {
  return units.flatMap((unit) => [
    unit,
    ...flattenUnits(unit.children),
  ]);
}

function contentDescriptor(sample: CatalogSample) {
  if (!sample.federated) {
    return {
      count: sample.scenarios.length,
      label: sample.scenarios.length === 1 ? "scenario" : "scenarios",
    };
  }

  const counts = {
    examples: sample.federated.record.content.examples.length,
    scenarios: sample.federated.record.content.scenarios.length,
    variants: sample.federated.record.content.variants.length,
  };
  const groups = Object.entries(counts).filter(([, count]) => count > 0);
  const count = groups.reduce((total, [, groupCount]) => total + groupCount, 0);
  const label =
    groups.length === 1 ? (groups[0]?.[0] ?? "nested items") : "nested items";
  return {
    count,
    label:
      groups.length === 1 && count === 1
        ? label.slice(0, -1)
        : label,
  };
}

function canonicalFacetValue(
  key: ExplorerFacetKey,
  value: string,
): string {
  if (
    key === "tag" ||
    key === "capability" ||
    key === "hardware" ||
    key === "accountService"
  ) {
    return normalizeSearchText(value);
  }

  return value;
}

export function createExplorerIndex(
  samples: CatalogSample[],
  categories: CatalogCategory[],
): IndexedSample[] {
  const categoryLabels = new Map(
    categories.map((category) => [category.id, category.label]),
  );

  return samples.map((sample, order) => {
    const source = getSampleProvider(sample);
    const languages = sample.languages ?? [];
    const units = sample.federated
      ? flattenUnits([
          ...sample.federated.record.content.variants,
          ...sample.federated.record.content.scenarios,
          ...sample.federated.record.content.examples,
        ])
      : [];
    const content = contentDescriptor(sample);
    const primaryCategoryLabel =
      categoryLabels.get(sample.categories.primary) ??
      sample.categories.primary;
    const secondaryCategoryLabels = sample.categories.secondary.map(
      (id) => categoryLabels.get(id) ?? id,
    );
    const searchGroups = {
      title: normalizeSearchText(sample.title),
      summary: normalizeSearchText(sample.summary ?? ""),
      project: joinSearchValues([
        sample.project.name,
      ]),
      aliases: joinSearchValues(sample.aliases),
      tags: joinSearchValues(sample.tags),
      scenarios: joinSearchValues(
        sample.scenarios.flatMap((scenario) => [
          scenario.title,
          scenario.summary,
          ...(scenario.apis ?? []),
          ...(scenario.sourceFiles ?? []),
        ]),
      ),
      apis: joinSearchValues(
        sample.apis.flatMap((api) => [api.name, api.description]),
      ),
      originals: joinSearchValues(
        sample.originalSamples.map((original) => original.name),
      ),
      provider: normalizeSearchText(source.label),
      category: joinSearchValues([
        primaryCategoryLabel,
        ...secondaryCategoryLabels,
        ...(sample.federated?.record.categories.provider ?? []),
      ]),
      technical: joinSearchValues([
        sample.federated?.record.recordKey,
        ...(sample.federated?.record.technicalAliases ?? []),
        ...sample.featuredFiles.map((file) => file.path),
        ...units.flatMap((unit) => [
          unit.title,
          unit.summary ?? undefined,
          unit.description ?? undefined,
          ...unit.apis,
          ...unit.sourcePaths,
          ...unit.technologies.languages,
          ...unit.technologies.projectTypes,
          ...unit.technologies.packaging,
        ]),
      ]),
      languages: joinSearchValues(languages),
    };
    const facets = {
      provider: [source.id],
      primaryCategory: [sample.categories.primary],
      secondaryCategory: sample.categories.secondary,
      tag: sample.tags.map((value) =>
        canonicalFacetValue("tag", value),
      ),
      capability: sample.requirements.capabilities.map(
        (capability) =>
          canonicalFacetValue("capability", capability.name),
      ),
      hardware: sample.requirements.hardware.map((value) =>
        canonicalFacetValue("hardware", value),
      ),
      accountService: sample.requirements.accountServices.map((value) =>
        canonicalFacetValue("accountService", value),
      ),
      architecture: sample.requirements.supportedArchitectures,
      language: languages,
      capture: captureModes(sample),
    };

    return {
      sample: {
        id: sample.id,
        title: sample.title,
        summary: sample.summary ?? "",
        project: {
          name: sample.project.name,
        },
        categories: {
          primary: sample.categories.primary,
        },
        contentCount: content.count,
        contentLabel: content.label,
        minimumWindowsVersion:
          sample.requirements.minimumWindowsVersion ?? "",
        supportedArchitectures:
          sample.requirements.supportedArchitectures,
        languages,
        source: {
          id: source.id,
          label: source.label,
        },
      },
      order,
      searchGroups,
      facets,
      facetLabels: {
        provider: createFacetLabelMap(facets.provider, [source.label]),
        primaryCategory: createFacetLabelMap(facets.primaryCategory, [
          primaryCategoryLabel,
        ]),
        secondaryCategory: createFacetLabelMap(
          facets.secondaryCategory,
          secondaryCategoryLabels,
        ),
        tag: createFacetLabelMap(facets.tag, sample.tags),
        capability: createFacetLabelMap(
          facets.capability,
          sample.requirements.capabilities.map(
            (capability) => capability.name,
          ),
        ),
        hardware: createFacetLabelMap(
          facets.hardware,
          sample.requirements.hardware,
        ),
        accountService: createFacetLabelMap(
          facets.accountService,
          sample.requirements.accountServices,
        ),
        architecture: createFacetLabelMap(
          facets.architecture,
          sample.requirements.supportedArchitectures,
        ),
        language: createFacetLabelMap(facets.language, languages),
        capture: createFacetLabelMap(
          facets.capture,
          captureModes(sample).map(
            (value) => captureLabels.get(value) ?? value,
          ),
        ),
      },
    };
  });
}

export function createDefaultExplorerState(): ExplorerState {
  return {
    query: "",
    sort: "recommended",
    facets: {
      provider: [],
      primaryCategory: [],
      secondaryCategory: [],
      tag: [],
      capability: [],
      hardware: [],
      accountService: [],
      architecture: [],
      language: [],
      capture: [],
    },
  };
}

function isExplorerSort(value: string | null): value is ExplorerSort {
  return value === "recommended" || value === "title" || value === "project";
}

function sortedUnique(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.length > 0))].sort(
    compareText,
  );
}

export function parseExplorerState(
  input: string | URLSearchParams,
): ExplorerState {
  const parameters =
    typeof input === "string"
      ? new URLSearchParams(input.startsWith("?") ? input.slice(1) : input)
      : input;
  const state = createDefaultExplorerState();

  state.query = parameters.get("q")?.trim() ?? "";
  const sort = parameters.get("sort");
  state.sort = isExplorerSort(sort) ? sort : "recommended";

  for (const key of explorerFacetKeys) {
    state.facets[key] = sortedUnique(
      parameters.getAll(queryParameterByFacet[key]),
    );
  }
  if (
    state.facets.provider.length === 0 &&
    parameters.has("source")
  ) {
    state.facets.provider = sortedUnique(parameters.getAll("source"));
  }

  return state;
}

export function serializeExplorerState(
  state: ExplorerState,
): URLSearchParams {
  const parameters = new URLSearchParams();
  const query = state.query.trim();

  if (query.length > 0) {
    parameters.set("q", query);
  }
  if (state.sort !== "recommended") {
    parameters.set("sort", state.sort);
  }

  for (const key of explorerFacetKeys) {
    for (const value of sortedUnique(state.facets[key])) {
      parameters.append(queryParameterByFacet[key], value);
    }
  }

  return parameters;
}

export function getFacetOptions(
  index: IndexedSample[],
): Record<ExplorerFacetKey, ExplorerFacetOption[]> {
  const authoredLabels = new Map<ExplorerFacetKey, Map<string, string>>(
    explorerFacetKeys.map((key) => [key, new Map()]),
  );

  function rememberLabel(
    key: ExplorerFacetKey,
    value: string,
    label = value,
  ) {
    const labels = authoredLabels.get(key);
    if (!labels) {
      return;
    }

    const canonical = canonicalFacetValue(key, value);
    const current = labels.get(canonical);
    if (!current || compareText(label, current) < 0) {
      labels.set(canonical, label);
    }
  }

  for (const entry of index) {
    for (const key of explorerFacetKeys) {
      entry.facets[key].forEach((value) => {
        const canonical = canonicalFacetValue(key, value);
        rememberLabel(key, value, entry.facetLabels[key][canonical]);
      });
    }
  }

  function optionsFor(key: ExplorerFacetKey): ExplorerFacetOption[] {
    const values = sortedUnique(
      index.flatMap((entry) => entry.facets[key]),
    );

    return values.map((value) => {
      return {
        value,
        label: authoredLabels.get(key)?.get(value) ?? value,
      };
    });
  }

  return Object.fromEntries(
    explorerFacetKeys.map((key) => [key, optionsFor(key)]),
  ) as Record<ExplorerFacetKey, ExplorerFacetOption[]>;
}

function matchesFacets(
  entry: IndexedSample,
  state: ExplorerState,
  ignoredFacet?: ExplorerFacetKey,
): boolean {
  return explorerFacetKeys.every((key) => {
    if (key === ignoredFacet || state.facets[key].length === 0) {
      return true;
    }

    return state.facets[key].some((value) =>
      entry.facets[key].includes(value),
    );
  });
}

function searchScore(entry: IndexedSample, normalizedQuery: string): number {
  if (normalizedQuery.length === 0) {
    return 0;
  }

  const terms = normalizedQuery.split(" ");
  const searchText = Object.values(entry.searchGroups)
    .filter(Boolean)
    .join(" ");
  if (!terms.every((term) => searchText.includes(term))) {
    return -1;
  }

  let score = 0;
  if (entry.searchGroups.title === normalizedQuery) {
    score += 500;
  } else if (entry.searchGroups.title.startsWith(normalizedQuery)) {
    score += 250;
  } else if (entry.searchGroups.title.includes(normalizedQuery)) {
    score += 150;
  }

  const weights: Array<[keyof IndexedSample["searchGroups"], number]> = [
    ["title", 45],
    ["project", 32],
    ["aliases", 28],
    ["tags", 22],
    ["apis", 20],
    ["scenarios", 18],
    ["technical", 18],
    ["languages", 14],
    ["originals", 12],
    ["summary", 8],
    ["category", 6],
    ["provider", 4],
  ];

  for (const term of terms) {
    for (const [group, weight] of weights) {
      if (entry.searchGroups[group].includes(term)) {
        score += weight;
      }
    }
  }

  return score;
}

export function filterAndSortSamples(
  index: IndexedSample[],
  state: ExplorerState,
): IndexedSample[] {
  const normalizedQuery = normalizeSearchText(state.query);
  const scored = index
    .filter((entry) => matchesFacets(entry, state))
    .map((entry) => ({
      entry,
      score: searchScore(entry, normalizedQuery),
    }))
    .filter(({ score }) => score >= 0);

  scored.sort((left, right) => {
    if (state.sort === "title") {
      return (
        compareText(left.entry.sample.title, right.entry.sample.title) ||
        compareText(left.entry.sample.id, right.entry.sample.id)
      );
    }
    if (state.sort === "project") {
      return (
        compareText(
          left.entry.sample.project.name,
          right.entry.sample.project.name,
        ) || compareText(left.entry.sample.id, right.entry.sample.id)
      );
    }
    if (normalizedQuery.length > 0 && left.score !== right.score) {
      return right.score - left.score;
    }

    return (
      left.entry.order - right.entry.order ||
      compareText(left.entry.sample.id, right.entry.sample.id)
    );
  });

  return scored.map(({ entry }) => entry);
}

export function getFacetCounts(
  index: IndexedSample[],
  state: ExplorerState,
  facet: ExplorerFacetKey,
  options: ExplorerFacetOption[],
): ReadonlyMap<string, number> {
  const normalizedQuery = normalizeSearchText(state.query);
  const eligible = index.filter(
    (entry) =>
      matchesFacets(entry, state, facet) &&
      searchScore(entry, normalizedQuery) >= 0,
  );

  return new Map(
    options.map((option) => [
      option.value,
      eligible.filter((entry) =>
        entry.facets[facet].includes(option.value),
      ).length,
    ]),
  );
}

export function selectedFilterCount(state: ExplorerState): number {
  return explorerFacetKeys.reduce(
    (count, key) => count + state.facets[key].length,
    0,
  );
}

export function clearExplorerFilters(state: ExplorerState): ExplorerState {
  return {
    ...createDefaultExplorerState(),
    sort: state.sort,
  };
}
