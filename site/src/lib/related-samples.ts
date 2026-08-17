import type {
  CatalogSample,
  SampleCatalog,
} from "./catalog";

export interface RelatedSampleResult {
  sample: CatalogSample;
  explicit: boolean;
  score: number;
  sharedTopics: string[];
}

function compareText(left: string, right: string): number {
  const normalizedLeft = left.toLocaleLowerCase("en-US");
  const normalizedRight = right.toLocaleLowerCase("en-US");
  if (normalizedLeft !== normalizedRight) {
    return normalizedLeft < normalizedRight ? -1 : 1;
  }
  return left === right ? 0 : left < right ? -1 : 1;
}

function intersection(left: string[], right: string[]): string[] {
  const rightValues = new Set(right);
  return [...new Set(left.filter((value) => rightValues.has(value)))].sort(
    compareText,
  );
}

function shortApiName(apiName: string): string {
  return apiName.split(".").at(-1) ?? apiName;
}

function scoreCandidate(
  source: CatalogSample,
  candidate: CatalogSample,
  categoryLabels: ReadonlyMap<string, string>,
): Omit<RelatedSampleResult, "sample" | "explicit"> {
  let score = 0;
  const sharedTopics: string[] = [];
  const sourceSecondary = new Set(source.categories.secondary);
  const candidateSecondary = new Set(candidate.categories.secondary);

  if (source.categories.primary === candidate.categories.primary) {
    score += 12;
    sharedTopics.push(
      categoryLabels.get(source.categories.primary) ??
        source.categories.primary,
    );
  } else {
    if (candidateSecondary.has(source.categories.primary)) {
      score += 6;
      sharedTopics.push(
        categoryLabels.get(source.categories.primary) ??
          source.categories.primary,
      );
    }
    if (sourceSecondary.has(candidate.categories.primary)) {
      score += 6;
      sharedTopics.push(
        categoryLabels.get(candidate.categories.primary) ??
          candidate.categories.primary,
      );
    }
  }

  const sharedSecondary = intersection(
    source.categories.secondary,
    candidate.categories.secondary,
  );
  score += sharedSecondary.length * 4;
  sharedTopics.push(
    ...sharedSecondary.map(
      (category) => categoryLabels.get(category) ?? category,
    ),
  );

  const sharedTags = intersection(source.tags, candidate.tags);
  score += sharedTags.length * 3;
  sharedTopics.push(...sharedTags);

  const sharedApis = intersection(
    source.apis.map((api) => api.name),
    candidate.apis.map((api) => api.name),
  );
  score += sharedApis.length * 5;
  sharedTopics.push(
    ...sharedApis.map((api) => `API: ${shortApiName(api)}`),
  );

  return {
    score,
    sharedTopics: [...new Set(sharedTopics)].slice(0, 3),
  };
}

export function getRelatedSamples(
  source: CatalogSample,
  catalog: SampleCatalog,
  limit = 4,
): RelatedSampleResult[] {
  if (limit <= 0) {
    return [];
  }

  const samplesById = new Map(
    catalog.samples.map((sample) => [sample.id, sample]),
  );
  const categoryLabels = new Map(
    catalog.categories.map((category) => [category.id, category.label]),
  );
  const selected = new Set<string>([source.id]);
  const results: RelatedSampleResult[] = [];

  for (const relatedId of source.relatedSamples) {
    const sample = samplesById.get(relatedId);
    if (!sample || selected.has(sample.id)) {
      continue;
    }

    const relation = scoreCandidate(source, sample, categoryLabels);
    results.push({
      sample,
      explicit: true,
      score: relation.score,
      sharedTopics:
        relation.sharedTopics.length > 0
          ? relation.sharedTopics
          : ["Curated relation"],
    });
    selected.add(sample.id);
    if (results.length === limit) {
      return results;
    }
  }

  const derived = catalog.samples
    .filter((candidate) => !selected.has(candidate.id))
    .map((candidate) => ({
      sample: candidate,
      explicit: false,
      ...scoreCandidate(source, candidate, categoryLabels),
    }))
    .filter((candidate) => candidate.score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        compareText(left.sample.title, right.sample.title) ||
        compareText(left.sample.id, right.sample.id),
    );

  return [...results, ...derived].slice(0, limit);
}
