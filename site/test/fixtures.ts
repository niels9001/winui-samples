import type {
  CatalogCategory,
  CatalogSample,
  SampleCatalog,
} from "../src/lib/catalog";

export const testCategories: CatalogCategory[] = [
  {
    id: "app-fundamentals",
    label: "App fundamentals",
    description: "Core app behavior.",
    icon: "AppsRegular",
  },
  {
    id: "files-and-data",
    label: "Files and data",
    description: "Local files and app data.",
    icon: "DocumentRegular",
  },
  {
    id: "media",
    label: "Media",
    description: "Audio, video, and images.",
    icon: "VideoRegular",
  },
];

type SampleOverrides = Omit<
  Partial<CatalogSample>,
  "project" | "categories" | "requirements"
> & {
  project?: Partial<CatalogSample["project"]>;
  categories?: Partial<CatalogSample["categories"]>;
  requirements?: Partial<CatalogSample["requirements"]>;
};

export function makeSample(
  id: string,
  title: string,
  overrides: SampleOverrides = {},
): CatalogSample {
  const projectName = id
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
  const base: CatalogSample = {
    schemaVersion: 1,
    id,
    project: {
      folder: projectName,
      name: projectName,
      repositoryPath: `Samples/${projectName}`,
    },
    title,
    summary: `Explore the ${title.toLocaleLowerCase("en-US")} experience.`,
    aliases: [projectName],
    icon: "AppsRegular",
    categories: {
      primary: "app-fundamentals",
      secondary: [],
    },
    tags: ["windows"],
    originalSamples: [
      {
        name: projectName,
        url: `https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/${projectName}`,
      },
    ],
    scenarios: [
      {
        id: "main-scenario",
        title: "Run the primary scenario",
        apis: ["Windows.Example.Api"],
        sourceFiles: ["MainPage.xaml.cs"],
      },
    ],
    apis: [
      {
        name: "Windows.Example.Api",
        description: "Represents the primary test API.",
        url: "https://learn.microsoft.com/uwp/api/windows.example.api",
      },
    ],
    documentation: [
      {
        title: "Test documentation",
        url: "https://learn.microsoft.com/windows/apps/",
        kind: "learn",
      },
    ],
    requirements: {
      minimumWindowsVersion: "10.0.17763.0",
      supportedArchitectures: ["x64"],
      capabilities: [],
      hardware: [],
      accountServices: [],
      architectureNotes: "No architecture-specific behavior is required.",
    },
    featuredFiles: [
      {
        path: "MainPage.xaml.cs",
        label: "Primary implementation",
      },
    ],
    relatedSamples: [],
    screenshots: [],
  };

  return {
    ...base,
    ...overrides,
    project: {
      ...base.project,
      ...overrides.project,
    },
    categories: {
      ...base.categories,
      ...overrides.categories,
    },
    requirements: {
      ...base.requirements,
      ...overrides.requirements,
    },
  };
}

export function makeCatalog(samples: CatalogSample[]): SampleCatalog {
  return {
    catalogVersion: 1,
    sampleSchemaVersion: 1,
    taxonomyVersion: 1,
    coverage: {
      totalProjects: samples.length,
      metadataFiles: samples.length,
      validSamples: samples.length,
      coveragePercent: samples.length === 0 ? 100 : 100,
      missingProjects: [],
    },
    categories: testCategories,
    samples,
  };
}
