import type {
  CatalogCategory,
  CatalogSample,
} from "./catalog";

export const explorerFacetKeys = [
  "primaryCategory",
  "secondaryCategory",
  "tag",
  "capability",
  "hardware",
  "accountService",
  "architecture",
  "capture",
] as const;

export type ExplorerFacetKey = (typeof explorerFacetKeys)[number];
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

export interface IndexedSample {
  sample: CatalogSample;
  order: number;
  searchText: string;
  searchGroups: {
    title: string;
    summary: string;
    project: string;
    aliases: string;
    tags: string;
    scenarios: string;
    apis: string;
    originals: string;
  };
  facets: Record<ExplorerFacetKey, string[]>;
}

const queryParameterByFacet: Record<ExplorerFacetKey, string> = {
  primaryCategory: "primary",
  secondaryCategory: "secondary",
  tag: "tag",
  capability: "capability",
  hardware: "hardware",
  accountService: "service",
  architecture: "arch",
  capture: "capture",
};

const captureLabels = new Map([
  ["automatic", "Automatic capture"],
  ["manual", "Manual capture"],
  ["none", "No capture recipe"],
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
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function joinSearchValues(values: Array<string | undefined>): string {
  return normalizeSearchText(values.filter(Boolean).join(" "));
}

function captureModes(sample: CatalogSample): string[] {
  if (sample.screenshots.length === 0) {
    return ["none"];
  }

  return [
    ...new Set(sample.screenshots.map((screenshot) => screenshot.capture.mode)),
  ].sort(compareText);
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
    const searchGroups = {
      title: normalizeSearchText(sample.title),
      summary: normalizeSearchText(sample.summary),
      project: joinSearchValues([
        sample.project.name,
        sample.project.folder,
        sample.project.repositoryPath,
      ]),
      aliases: joinSearchValues(sample.aliases),
      tags: joinSearchValues(sample.tags),
      scenarios: joinSearchValues(
        sample.scenarios.flatMap((scenario) => [
          scenario.id,
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
    };
    const categorySearch = joinSearchValues([
      categoryLabels.get(sample.categories.primary),
      ...sample.categories.secondary.map((id) => categoryLabels.get(id)),
    ]);

    return {
      sample,
      order,
      searchGroups,
      searchText: [
        ...Object.values(searchGroups),
        categorySearch,
      ]
        .filter(Boolean)
        .join(" "),
      facets: {
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
        capture: captureModes(sample),
      },
    };
  });
}

export function createDefaultExplorerState(): ExplorerState {
  return {
    query: "",
    sort: "recommended",
    facets: {
      primaryCategory: [],
      secondaryCategory: [],
      tag: [],
      capability: [],
      hardware: [],
      accountService: [],
      architecture: [],
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
  categories: CatalogCategory[],
): Record<ExplorerFacetKey, ExplorerFacetOption[]> {
  const categoryById = new Map(
    categories.map((category) => [category.id, category]),
  );
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
    rememberLabel(
      "primaryCategory",
      entry.sample.categories.primary,
      categoryById.get(entry.sample.categories.primary)?.label,
    );
    for (const value of entry.sample.categories.secondary) {
      rememberLabel(
        "secondaryCategory",
        value,
        categoryById.get(value)?.label,
      );
    }
    for (const value of entry.sample.tags) {
      rememberLabel("tag", value);
    }
    for (const capability of entry.sample.requirements.capabilities) {
      rememberLabel("capability", capability.name);
    }
    for (const value of entry.sample.requirements.hardware) {
      rememberLabel("hardware", value);
    }
    for (const value of entry.sample.requirements.accountServices) {
      rememberLabel("accountService", value);
    }
    for (const value of entry.sample.requirements.supportedArchitectures) {
      rememberLabel("architecture", value);
    }
    for (const value of captureModes(entry.sample)) {
      rememberLabel("capture", value, captureLabels.get(value));
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
  if (!terms.every((term) => entry.searchText.includes(term))) {
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
    ["originals", 12],
    ["summary", 8],
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
