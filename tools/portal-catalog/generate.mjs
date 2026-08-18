#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  atomicWriteFile,
  canonicalStringify,
  hashCanonicalJson,
} from "../external-catalog/lib/canonical.mjs";

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(moduleDirectory, "..", "..");

const defaultPaths = {
  local: path.join(
    repositoryRoot,
    "site",
    "src",
    "generated",
    "local-sample-catalog.json",
  ),
  external: path.join(
    repositoryRoot,
    "external",
    "generated",
    "catalog.json",
  ),
  output: path.join(
    repositoryRoot,
    "site",
    "src",
    "generated",
    "sample-catalog.json",
  ),
};

const providerDefinitions = [
  {
    id: "winui-samples",
    label: "WinUI samples",
    kind: "local",
  },
  {
    id: "winui-gallery",
    label: "WinUI Gallery",
    kind: "external",
  },
  {
    id: "windows-app-sdk-samples",
    label: "Windows App SDK samples",
    kind: "external",
  },
];

const additionalCategories = [
  {
    id: "artificial-intelligence",
    label: "Artificial intelligence",
    description:
      "Build Windows experiences with local models, Windows ML, and Windows AI APIs.",
    icon: "AppsRegular",
  },
  {
    id: "deployment",
    label: "Deployment",
    description:
      "Package, deploy, service, and resolve dependencies for Windows applications.",
    icon: "ToolboxRegular",
  },
];

const portalCategoryMap = new Map([
  ["app-fundamentals", "app-fundamentals"],
  ["artificial-intelligence", "artificial-intelligence"],
  ["data-and-files", "files-and-data"],
  ["deployment", "deployment"],
  ["graphics-and-ui", "ui-and-input"],
  ["notifications", "app-fundamentals"],
  ["security", "security-and-identity"],
  ["user-interface", "ui-and-input"],
]);

const categoryIcons = new Map([
  ["app-fundamentals", "AppsRegular"],
  ["artificial-intelligence", "AppsRegular"],
  ["deployment", "ToolboxRegular"],
  ["files-and-data", "DocumentRegular"],
  ["media", "VideoRegular"],
  ["security-and-identity", "ShieldRegular"],
  ["ui-and-input", "WindowRegular"],
]);

function parseArguments(arguments_) {
  const result = { ...defaultPaths };
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    const match = /^--(local|external|output)(?:=(.*))?$/.exec(argument);
    if (!match) {
      if (argument === "--help" || argument === "-h") {
        console.log(
          "Usage: node tools/portal-catalog/generate.mjs [--local <path>] [--external <path>] [--output <path>]",
        );
        process.exit(0);
      }
      throw new Error(`unknown argument: ${argument}`);
    }
    const [, key, inlineValue] = match;
    const value = inlineValue || arguments_[index + 1];
    if (!value) {
      throw new Error(`--${key} requires a path`);
    }
    result[key] = path.resolve(value);
    if (!inlineValue) {
      index += 1;
    }
  }
  return result;
}

function compareText(left, right) {
  return left.localeCompare(right, "en-US", { sensitivity: "base" });
}

function createFacetLabelMap(values, labels = values) {
  const result = {};
  values.forEach((value, index) => {
    const label = labels[index] ?? value;
    const current = result[value];
    if (!current || compareText(label, current) < 0) {
      result[value] = label;
    }
  });
  return result;
}

function sortedUnique(values) {
  return [...new Set(values.filter((value) => typeof value === "string" && value.length > 0))]
    .sort(compareText);
}

export function normalizeSearchText(value) {
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

function joinSearchValues(values) {
  return normalizeSearchText(values.filter(Boolean).join(" "));
}

function galleryCategory(record) {
  const values = new Set(record.categories.provider);
  if (values.has("Media")) {
    return "media";
  }
  if (
    values.has("System") ||
    values.has("MultipleWindows") ||
    values.has("Windowing")
  ) {
    return "app-fundamentals";
  }
  return "ui-and-input";
}

function categoryForExternalRecord(record) {
  if (record.provider.id === "winui-gallery") {
    return galleryCategory(record);
  }
  return (
    portalCategoryMap.get(record.categories.portal.primary) ??
    "app-fundamentals"
  );
}

function sourceLabel(providerId) {
  const provider = providerDefinitions.find((item) => item.id === providerId);
  if (!provider) {
    throw new Error(`unknown portal provider ${providerId}`);
  }
  return provider.label;
}

function localLanguages(sample) {
  const paths = [
    ...sample.featuredFiles.map((file) => file.path),
    ...sample.scenarios.flatMap((scenario) => scenario.sourceFiles ?? []),
  ];
  const languages = [];
  if (paths.some((value) => /\.(?:cs|csproj)$/iu.test(value))) {
    languages.push("C#");
  }
  if (paths.some((value) => /\.xaml(?:\.cs)?$/iu.test(value))) {
    languages.push("XAML");
  }
  return sortedUnique(languages.length > 0 ? languages : ["C#", "XAML"]);
}

function localSample(sample) {
  return {
    ...sample,
    globalId: `local:${sample.id}`,
    routePath: `samples/${sample.id}`,
    provider: {
      id: "winui-samples",
      label: "WinUI samples",
      kind: "local",
    },
    languages: localLanguages(sample),
  };
}

function nestedScenario(unit) {
  return {
    id: unit.id,
    title: unit.title,
    ...(unit.summary ? { summary: unit.summary } : {}),
    ...(unit.apis.length > 0 ? { apis: unit.apis } : {}),
    ...(unit.sourcePaths.length > 0 ? { sourceFiles: unit.sourcePaths } : {}),
  };
}

function licenseEntries(externalCatalog) {
  return new Map(
    externalCatalog.licenses.flatMap((manifest) =>
      manifest.entries.map((entry) => [entry.id, entry]),
    ),
  );
}

function externalSample(record, licenses) {
  const primaryCategory = categoryForExternalRecord(record);
  const referencedLicenses = record.attribution.licenseRefs.map((id) => {
    const entry = licenses.get(id);
    if (!entry) {
      throw new Error(`${record.id}: unresolved license reference ${id}`);
    }
    return entry;
  });

  return {
    schemaVersion: 1,
    id: record.route.slug,
    globalId: record.id,
    routePath: record.route.path,
    provider: {
      id: record.provider.id,
      label: sourceLabel(record.provider.id),
      kind: "external",
    },
    project: {
      folder: record.recordKey,
      name: record.technicalAliases[0] ?? record.recordKey,
      repositoryPath: record.source.path,
    },
    source: {
      id: record.provider.id,
      label: sourceLabel(record.provider.id),
      canonicalUrl: record.links.source,
    },
    title: record.title.display,
    summary: record.summary,
    aliases: sortedUnique([
      ...record.technicalAliases,
      record.recordKey,
      record.title.upstream,
    ]),
    icon: categoryIcons.get(primaryCategory) ?? "AppsRegular",
    categories: {
      primary: primaryCategory,
      secondary: [],
    },
    tags: record.tags,
    originalSamples: [],
    scenarios: record.content.scenarios.map(nestedScenario),
    apis: record.apis.map((api) => ({
      name: api.name,
      ...(api.description ? { description: api.description } : {}),
      ...(api.url ? { url: api.url } : {}),
    })),
    documentation: record.documentation,
    requirements: {
      minimumWindowsVersion: record.requirements.minimumWindowsVersion,
      supportedArchitectures: record.requirements.architectures,
      capabilities: record.requirements.declaredPackageCapabilities.map(
        (capability) => ({
          name: capability.name,
          kind: capability.kind,
          description: capability.description ?? "",
        }),
      ),
      hardware: record.requirements.prerequisites.hardware,
      accountServices: record.requirements.prerequisites.accountsAndServices,
      software: record.requirements.prerequisites.software,
      notes: record.requirements.prerequisites.notes,
      architectureNotes: "",
    },
    featuredFiles: record.featuredSourceFiles.map((file) => ({
      path: file.path,
      label: file.label,
      ...(file.description ? { description: file.description } : {}),
      canonicalUrl: file.canonicalUrl,
      language: file.language,
      blobSha: file.blobSha,
      sha256: file.sha256,
      size: file.size,
    })),
    relatedSamples: record.relations.map((relation) => relation.targetId),
    screenshots: [],
    languages: record.technologies.languages,
    federated: {
      record,
      licenses: referencedLicenses,
      ...(record.provider.id === "winui-gallery"
        ? { appDeepLink: `winui3gallery://item/${encodeURIComponent(record.recordKey)}` }
        : {}),
    },
  };
}

function remapRelations(samples) {
  const byGlobalId = new Map(samples.map((sample) => [sample.globalId, sample.id]));
  for (const sample of samples) {
    sample.relatedSamples = sortedUnique(
      sample.relatedSamples.map((id) => byGlobalId.get(id) ?? id),
    );
  }
}

function nestedUnits(units) {
  return units.flatMap((unit) => [unit, ...nestedUnits(unit.children)]);
}

function contentDescriptor(sample) {
  if (!sample.federated) {
    return {
      count: sample.scenarios.length,
      label: sample.scenarios.length === 1 ? "scenario" : "scenarios",
    };
  }
  const record = sample.federated.record;
  const counts = {
    examples: record.content.examples.length,
    scenarios: record.content.scenarios.length,
    variants: record.content.variants.length,
  };
  const groups = Object.entries(counts).filter(([, count]) => count > 0);
  const count = groups.reduce((total, [, groupCount]) => total + groupCount, 0);
  const kind = groups.length === 1 ? groups[0][0] : "nested items";
  return {
    count,
    label:
      groups.length === 1 && count === 1
        ? kind.slice(0, -1)
        : kind,
  };
}

function searchEntry(sample, categoryLabels, order) {
  const source = sample.provider;
  const primaryCategoryLabel =
    categoryLabels.get(sample.categories.primary) ?? sample.categories.primary;
  const secondaryCategoryLabels = sample.categories.secondary.map(
    (id) => categoryLabels.get(id) ?? id,
  );
  const record = sample.federated?.record;
  const units = record
    ? nestedUnits([
        ...record.content.variants,
        ...record.content.scenarios,
        ...record.content.examples,
      ])
    : [];
  const content = contentDescriptor(sample);
  const searchGroups = {
    title: normalizeSearchText(sample.title),
    summary: normalizeSearchText(sample.summary ?? ""),
    project: joinSearchValues([sample.project.name, record?.recordKey]),
    aliases: joinSearchValues(sample.aliases),
    tags: joinSearchValues(sample.tags),
    scenarios: joinSearchValues([
      ...sample.scenarios.flatMap((scenario) => [
        scenario.title,
        scenario.summary,
        ...(scenario.apis ?? []),
        ...(scenario.sourceFiles ?? []),
      ]),
      ...units.flatMap((unit) => [
        unit.title,
        unit.summary,
        unit.description,
        ...unit.apis,
        ...unit.sourcePaths,
        ...unit.technologies.languages,
        ...unit.technologies.projectTypes,
        ...unit.technologies.packaging,
      ]),
    ]),
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
      ...(record?.categories.provider ?? []),
    ]),
    technical: joinSearchValues([
      record?.recordKey,
      ...(record?.technicalAliases ?? []),
      ...sample.featuredFiles.map((file) => file.path),
    ]),
    languages: joinSearchValues(sample.languages),
  };
  const captureModes =
    sample.screenshots.length === 0
      ? ["none"]
      : sortedUnique(
          sample.screenshots.map((screenshot) => screenshot.capture.mode),
        );
  const facets = {
    provider: [source.id],
    primaryCategory: [sample.categories.primary],
    secondaryCategory: sample.categories.secondary,
    tag: sample.tags.map(normalizeSearchText),
    capability: sample.requirements.capabilities.map((capability) =>
      normalizeSearchText(capability.name),
    ),
    hardware: sample.requirements.hardware.map(normalizeSearchText),
    accountService:
      sample.requirements.accountServices.map(normalizeSearchText),
    architecture: sample.requirements.supportedArchitectures,
    language: sample.languages,
    capture: captureModes,
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
      minimumWindowsVersion: sample.requirements.minimumWindowsVersion ?? "",
      supportedArchitectures: sample.requirements.supportedArchitectures,
      languages: sample.languages,
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
      language: createFacetLabelMap(facets.language, sample.languages),
      capture: createFacetLabelMap(
        facets.capture,
        captureModes.map((value) => {
          if (value === "automatic") return "Automated preview";
          if (value === "manual") return "Manual preview";
          return "No preview recipe";
        }),
      ),
    },
  };
}

function interleavedSearchOrder(samples) {
  const buckets = providerDefinitions.map((provider) =>
    samples
      .filter((sample) => sample.provider.id === provider.id)
      .sort(
        (left, right) =>
          compareText(left.title, right.title) || compareText(left.id, right.id),
      ),
  );
  const result = [];
  while (buckets.some((bucket) => bucket.length > 0)) {
    for (const bucket of buckets) {
      const sample = bucket.shift();
      if (sample) {
        result.push(sample);
      }
    }
  }
  return result;
}

function assertUnique(samples, field) {
  const seen = new Set();
  for (const sample of samples) {
    const value = sample[field];
    if (seen.has(value)) {
      throw new Error(`duplicate portal ${field} ${value}`);
    }
    seen.add(value);
  }
}

function assertCounts(samples) {
  const expected = new Map([
    ["winui-samples", 71],
    ["winui-gallery", 120],
    ["windows-app-sdk-samples", 42],
  ]);
  if (samples.length !== 233) {
    throw new Error(`expected 233 portal records, received ${samples.length}`);
  }
  for (const [providerId, count] of expected) {
    const actual = samples.filter(
      (sample) => sample.provider.id === providerId,
    ).length;
    if (actual !== count) {
      throw new Error(
        `${providerId}: expected ${count} portal records, received ${actual}`,
      );
    }
  }
}

export async function generatePortalCatalog({
  localPath = defaultPaths.local,
  externalPath = defaultPaths.external,
} = {}) {
  const [localCatalog, externalCatalog] = await Promise.all([
    readFile(localPath, "utf8").then(JSON.parse),
    readFile(externalPath, "utf8").then(JSON.parse),
  ]);
  const licenses = licenseEntries(externalCatalog);
  const samples = [
    ...localCatalog.samples.map(localSample),
    ...externalCatalog.records.map((record) =>
      externalSample(record, licenses),
    ),
  ];
  remapRelations(samples);
  assertCounts(samples);
  assertUnique(samples, "id");
  assertUnique(samples, "globalId");
  assertUnique(samples, "routePath");

  const categories = [
    ...localCatalog.categories,
    ...additionalCategories.filter(
      (category) =>
        !localCatalog.categories.some((item) => item.id === category.id),
    ),
  ];
  const categoryLabels = new Map(
    categories.map((category) => [category.id, category.label]),
  );
  const searchCore = {
    schemaVersion: 1,
    records: interleavedSearchOrder(samples).map((sample, order) =>
      searchEntry(sample, categoryLabels, order),
    ),
  };
  const searchIndex = {
    ...searchCore,
    contentHash: hashCanonicalJson(searchCore),
  };
  const providers = providerDefinitions.map((provider) => ({
    ...provider,
    recordCount: samples.filter((sample) => sample.provider.id === provider.id)
      .length,
  }));
  const redirects = [
    ...externalCatalog.redirects,
    ...externalCatalog.tombstones
      .filter((tombstone) => tombstone.redirectToId !== null)
      .map((tombstone) => ({
        fromPath: tombstone.routePath,
        toId: tombstone.redirectToId,
        declaredAtSync: tombstone.removedAtSync,
        reason: tombstone.reason,
      })),
  ].sort((left, right) =>
    left.fromPath.localeCompare(right.fromPath, "en-US"),
  );
  const core = {
    catalogVersion: 1,
    sampleSchemaVersion: 1,
    taxonomyVersion: 1,
    coverage: localCatalog.coverage,
    categories,
    providers,
    routes: {
      detailCount: samples.length,
      redirects,
    },
    external: {
      contentHash: externalCatalog.contentHash,
      generatedFrom: externalCatalog.generatedFrom,
    },
    samples,
    searchIndex,
  };

  return {
    ...core,
    contentHash: hashCanonicalJson(core),
  };
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))
) {
  try {
    const options = parseArguments(process.argv.slice(2));
    const catalog = await generatePortalCatalog({
      localPath: options.local,
      externalPath: options.external,
    });
    const bytes = canonicalStringify(catalog);
    await atomicWriteFile(options.output, bytes);
    console.log(
      `Generated ${options.output}: ${catalog.samples.length} records, ${catalog.contentHash}.`,
    );
  } catch (error) {
    console.error(`error: ${error.message}`);
    process.exitCode = 1;
  }
}
