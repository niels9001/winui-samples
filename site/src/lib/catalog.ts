export interface CatalogCoverage {
  totalProjects: number;
  metadataFiles: number;
  validSamples: number;
  coveragePercent: number;
  missingProjects: string[];
}

export interface CatalogCategory {
  id: string;
  label: string;
  description: string;
  icon: string;
}

export interface SampleScenario {
  id: string;
  title: string;
  summary?: string;
  apis?: string[];
  sourceFiles?: string[];
}

export interface SampleApi {
  name: string;
  description?: string;
  url?: string;
}

export interface SampleDocument {
  title: string;
  url: string;
  kind: "learn" | "api-reference" | "concept" | "migration" | "other";
}

export interface SampleCapability {
  name: string;
  kind: "general" | "device" | "restricted";
  description: string;
}

export interface SampleRequirement {
  minimumWindowsVersion: string;
  supportedArchitectures: Array<"x86" | "x64" | "arm64">;
  capabilities: SampleCapability[];
  hardware: string[];
  accountServices: string[];
  architectureNotes: string;
}

export interface FeaturedFile {
  path: string;
  label: string;
  description?: string;
}

export interface SampleScreenshot {
  id: string;
  alt: string;
  scenario: string;
  capture: {
    mode: "automatic" | "manual";
    readinessSelector: string;
    actions?: Array<Record<string, string | number>>;
    notes?: string;
  };
}

export interface CatalogSample {
  schemaVersion: number;
  id: string;
  project: {
    folder: string;
    name: string;
    repositoryPath: string;
  };
  source?: {
    id: string;
    label: string;
    canonicalUrl: string;
  };
  title: string;
  summary: string;
  aliases: string[];
  icon: string;
  categories: {
    primary: string;
    secondary: string[];
  };
  tags: string[];
  originalSamples: Array<{
    name: string;
    url: string;
  }>;
  scenarios: SampleScenario[];
  apis: SampleApi[];
  documentation: SampleDocument[];
  requirements: SampleRequirement;
  featuredFiles: FeaturedFile[];
  relatedSamples: string[];
  screenshots: SampleScreenshot[];
}

export interface SampleCatalog {
  catalogVersion: number;
  sampleSchemaVersion: number;
  taxonomyVersion: number;
  coverage: CatalogCoverage;
  categories: CatalogCategory[];
  samples: CatalogSample[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assert(
  condition: boolean,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(`Invalid generated sample catalog: ${message}`);
  }
}

function hasString(record: Record<string, unknown>, key: string): boolean {
  return typeof record[key] === "string" && record[key].length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function assertCatalog(value: unknown): asserts value is SampleCatalog {
  assert(isRecord(value), "root must be an object");
  assert(value.catalogVersion === 1, "catalogVersion must be 1");
  assert(value.sampleSchemaVersion === 1, "sampleSchemaVersion must be 1");
  assert(value.taxonomyVersion === 1, "taxonomyVersion must be 1");

  const coverage = value.coverage;
  assert(isRecord(coverage), "coverage must be an object");
  for (const field of [
    "totalProjects",
    "metadataFiles",
    "validSamples",
    "coveragePercent",
  ]) {
    assert(
      typeof coverage[field] === "number" && Number.isFinite(coverage[field]),
      `coverage.${field} must be a finite number`,
    );
  }
  assert(
    isStringArray(coverage.missingProjects),
    "coverage.missingProjects must be a string array",
  );

  assert(Array.isArray(value.categories), "categories must be an array");
  for (const [index, category] of value.categories.entries()) {
    assert(isRecord(category), `categories[${index}] must be an object`);
    for (const field of ["id", "label", "description", "icon"]) {
      assert(
        hasString(category, field),
        `categories[${index}].${field} must be a non-empty string`,
      );
    }
  }

  assert(Array.isArray(value.samples), "samples must be an array");
  const sampleIds = new Set<string>();
  for (const [index, sample] of value.samples.entries()) {
    assert(isRecord(sample), `samples[${index}] must be an object`);
    for (const field of ["id", "title", "summary", "icon"]) {
      assert(
        hasString(sample, field),
        `samples[${index}].${field} must be a non-empty string`,
      );
    }

    const id = sample.id;
    assert(typeof id === "string", `samples[${index}].id must be a string`);
    assert(!sampleIds.has(id), `duplicate sample id ${id}`);
    sampleIds.add(id);

    const project = sample.project;
    assert(isRecord(project), `samples[${index}].project must be an object`);
    for (const field of ["folder", "name", "repositoryPath"]) {
      assert(
        hasString(project, field),
        `samples[${index}].project.${field} must be a non-empty string`,
      );
    }

    if (sample.source !== undefined) {
      assert(isRecord(sample.source), `samples[${index}].source must be an object`);
      for (const field of ["id", "label", "canonicalUrl"]) {
        assert(
          hasString(sample.source, field),
          `samples[${index}].source.${field} must be a non-empty string`,
        );
      }
    }

    const categories = sample.categories;
    assert(
      isRecord(categories),
      `samples[${index}].categories must be an object`,
    );
    assert(
      hasString(categories, "primary"),
      `samples[${index}].categories.primary must be a non-empty string`,
    );
    assert(
      isStringArray(categories.secondary),
      `samples[${index}].categories.secondary must be a string array`,
    );

    for (const field of [
      "aliases",
      "tags",
      "originalSamples",
      "scenarios",
      "apis",
      "documentation",
      "featuredFiles",
      "relatedSamples",
      "screenshots",
    ]) {
      assert(
        Array.isArray(sample[field]),
        `samples[${index}].${field} must be an array`,
      );
    }
    assert(
      isStringArray(sample.aliases),
      `samples[${index}].aliases must be a string array`,
    );
    assert(
      isStringArray(sample.tags),
      `samples[${index}].tags must be a string array`,
    );
    assert(
      isStringArray(sample.relatedSamples),
      `samples[${index}].relatedSamples must be a string array`,
    );

    const requirements = sample.requirements;
    assert(
      isRecord(requirements),
      `samples[${index}].requirements must be an object`,
    );
    assert(
      hasString(requirements, "minimumWindowsVersion"),
      `samples[${index}].requirements.minimumWindowsVersion must be a non-empty string`,
    );
    assert(
      isStringArray(requirements.supportedArchitectures),
      `samples[${index}].requirements.supportedArchitectures must be a string array`,
    );
    assert(
      Array.isArray(requirements.capabilities),
      `samples[${index}].requirements.capabilities must be an array`,
    );
    assert(
      isStringArray(requirements.hardware),
      `samples[${index}].requirements.hardware must be a string array`,
    );
    assert(
      isStringArray(requirements.accountServices),
      `samples[${index}].requirements.accountServices must be a string array`,
    );
    assert(
      hasString(requirements, "architectureNotes"),
      `samples[${index}].requirements.architectureNotes must be a non-empty string`,
    );
  }
}

export function parseCatalog(value: unknown): SampleCatalog {
  assertCatalog(value);
  return value;
}

export function categoryById(
  catalog: SampleCatalog,
): ReadonlyMap<string, CatalogCategory> {
  return new Map(catalog.categories.map((category) => [category.id, category]));
}
