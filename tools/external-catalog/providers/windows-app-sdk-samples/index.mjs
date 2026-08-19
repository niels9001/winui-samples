import {
  contentGuards,
  familyManifest,
  licenseDefinitions,
  mediaCandidates,
  providerId,
  reviewedRedirects,
  reviewedRenames,
  reviewedSnapshot,
  reviewedSync,
  reviewedTombstones,
  rootRequirements,
} from "./manifest.mjs";
import { reviewedInventory } from "./inventory.mjs";

const repositoryUrl = "https://github.com/microsoft/WindowsAppSDK-Samples";
const rootIndex = "README.md";

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort((left, right) =>
    left.localeCompare(right, "en-US"),
  );
}

function applyReviewedHistory(record, history) {
  const reviewedRecord = history.records.find(
    (candidate) => candidate.id === record.id,
  );
  if (!reviewedRecord || reviewedRecord.status !== "active") {
    throw new Error(
      `needs-curation: ${record.id} is missing active reviewed lifecycle history`,
    );
  }

  const portalLifecycle =
    reviewedRecord.firstSeenSync === history.latestSyncId
      ? ["new"]
      : reviewedRecord.lastChangedSync === history.latestSyncId
        ? ["updated"]
        : [];
  return {
    ...record,
    lifecycle: {
      firstSeenSync: reviewedRecord.firstSeenSync,
      lastChangedSync: reviewedRecord.lastChangedSync,
      lastReviewedSync: reviewedRecord.lastReviewedSync,
      status: reviewedRecord.status,
      removedAtSync: reviewedRecord.removedAtSync,
    },
    badges: {
      ...record.badges,
      portalLifecycle,
    },
  };
}

export function buildReviewedLifecycleOutput(
  history,
  {
    renameDeclarations = reviewedRenames,
    tombstoneDeclarations = reviewedTombstones,
    redirectDeclarations = reviewedRedirects,
  } = {},
) {
  const renames = new Map(
    renameDeclarations.map((declaration) => [
      declaration.fromId,
      declaration,
    ]),
  );
  const removals = new Map(
    tombstoneDeclarations.map((declaration) => [
      declaration.id,
      declaration,
    ]),
  );
  const tombstones = history.records
    .filter((record) => record.status === "tombstoned")
    .map((record) => {
      const rename = renames.get(record.id);
      const removal = removals.get(record.id);
      const declaration = rename ?? removal;
      if (!declaration) {
        throw new Error(
          `needs-curation: ${record.id} needs a persistent reviewed tombstone or rename declaration`,
        );
      }
      return {
        id: record.id,
        providerId,
        recordKey: record.recordKey,
        routePath: record.routePath,
        removedAtSync: record.removedAtSync,
        reason: declaration.reason,
        redirectToId: rename?.toId ?? null,
      };
    });
  return {
    redirects: redirectDeclarations.map((redirect) => ({ ...redirect })),
    tombstones,
  };
}

function mergeRequirements(base, override = {}) {
  const basePrerequisites = base.prerequisites;
  const overridePrerequisites = override.prerequisites ?? {};
  return {
    minimumWindowsVersion:
      override.minimumWindowsVersion ?? base.minimumWindowsVersion,
    architectures: unique([
      ...base.architectures,
      ...(override.architectures ?? []),
    ]),
    declaredPackageCapabilities:
      override.declaredPackageCapabilities ??
      base.declaredPackageCapabilities,
    prerequisites: {
      hardware: unique([
        ...basePrerequisites.hardware,
        ...(overridePrerequisites.hardware ?? []),
      ]),
      accountsAndServices: unique([
        ...basePrerequisites.accountsAndServices,
        ...(overridePrerequisites.accountsAndServices ?? []),
      ]),
      software: unique([
        ...basePrerequisites.software,
        ...(overridePrerequisites.software ?? []),
      ]),
      notes: unique([
        ...basePrerequisites.notes,
        ...(overridePrerequisites.notes ?? []),
      ]),
    },
  };
}

function encodePath(sourcePath) {
  return sourcePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function sourceUrl(sourcePath, kind = "tree") {
  return `${repositoryUrl}/${kind}/${reviewedSnapshot.commitSha}/${encodePath(sourcePath)}`;
}

function nestedId(prefix, sourcePath) {
  const hint = sourcePath
    .replace(/\.[^.\/]+$/u, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(-160)
    .replace(/^-+/u, "");
  return `${prefix}/${hint || "unit"}`;
}

function languageForPath(sourcePath) {
  const lower = sourcePath.toLowerCase();
  if (lower.endsWith(".csproj") || /\.(?:cs|xaml\.cs)$/u.test(lower)) {
    return "C#";
  }
  if (
    lower.endsWith(".vcxproj") ||
    lower.endsWith(".vcproj") ||
    /\.(?:cpp|cc|c|h|hpp|idl)$/u.test(lower)
  ) {
    return "C++";
  }
  if (lower.endsWith(".py")) {
    return "Python";
  }
  return null;
}

function packagingForPath(sourcePath, family, inventory, kind) {
  const lower = sourcePath.toLowerCase();
  if (kind === "packaging" || lower.endsWith(".wapproj")) {
    const deploymentModes = family.packaging.filter((value) =>
      ["framework-dependent", "self-contained"].includes(value),
    );
    return unique([
      "MSIX",
      ...(deploymentModes.length === 1 ? deploymentModes : []),
    ]);
  }
  const values = [];
  const unpackaged = lower.includes("unpackaged");
  if (unpackaged) {
    values.push("unpackaged");
  } else if (lower.includes("packaged")) {
    values.push("MSIX");
  }
  if (lower.includes("selfcontained") || lower.includes("self-contained")) {
    values.push("self-contained");
  }
  if (lower.includes("frameworkdependent") || lower.includes("framework-dependent")) {
    values.push("framework-dependent");
  }
  if (kind === "solution" && values.length === 0) {
    values.push(...family.packaging);
  }
  if (values.length === 0) {
    const directory = sourcePath.slice(0, sourcePath.lastIndexOf("/"));
    const hasPackageManifest = inventory.packageManifests.some(
      (manifestPath) =>
        manifestPath === `${directory}/Package.appxmanifest` ||
        manifestPath.startsWith(`${directory}/`),
    );
    if (hasPackageManifest) {
      values.push("MSIX");
    }
  }
  const identityModes = family.packaging.filter((value) =>
    ["MSIX", "unpackaged"].includes(value),
  );
  const deploymentModes = family.packaging.filter((value) =>
    ["framework-dependent", "self-contained"].includes(value),
  );
  if (
    !values.some((value) => ["MSIX", "unpackaged"].includes(value)) &&
    identityModes.length === 1
  ) {
    values.push(identityModes[0]);
  }
  if (
    !values.some((value) =>
      ["framework-dependent", "self-contained"].includes(value),
    ) &&
    deploymentModes.length === 1
  ) {
    values.push(deploymentModes[0]);
  }
  return unique(
    values,
  );
}

function projectTypesForPath(sourcePath, family, kind) {
  if (kind === "solution") {
    return ["Visual Studio solution"];
  }
  if (kind === "packaging") {
    return ["MSIX packaging project"];
  }
  const lower = sourcePath.toLowerCase();
  const values = [];
  if (lower.includes("winui")) {
    values.push("WinUI 3");
  }
  if (lower.includes("win32")) {
    values.push("Win32");
  }
  if (lower.includes("console")) {
    values.push("Console");
  }
  if (lower.includes("winforms")) {
    values.push("Windows Forms");
  }
  if (lower.includes("wpf")) {
    values.push("WPF");
  }
  if (lower.includes("component")) {
    values.push("Windows Runtime Component");
  }
  if (
    /(?:classlibrary|samplescommon|shared|widgethelper)/u.test(lower)
  ) {
    values.push("class library");
  }
  return unique(
    values.length > 0
      ? values
      : family.projectTypes.length === 1
        ? family.projectTypes
        : [],
  );
}

function titleFromPath(sourcePath, suffix) {
  const basename = sourcePath.split("/").at(-1);
  return `${basename}${suffix}`;
}

function nestedVariant(sourcePath, position, family, inventory, kind) {
  const language = languageForPath(sourcePath);
  const children = [];
  if (
    family.recordKey === "dynamic-dependencies" &&
    sourcePath.endsWith(".vcxproj")
  ) {
    children.push({
      id: "legacy-project/dynamic-dependencies-vcproj",
      kind: "variant",
      position: 0,
      title: "DynamicDependencies.vcproj legacy project",
      summary: null,
      description: null,
      sourcePaths: [
        "DynamicDependenciesSample/DynamicDependencies/DirectX/D3D9ExSample.vcproj",
      ],
      technologies: {
        languages: ["C++"],
        projectTypes: ["legacy Visual C++ project"],
        packaging: ["unpackaged"],
      },
      apis: [],
      documentation: [],
      children: [],
    });
  }
  const suffix =
    kind === "solution"
      ? " solution"
      : kind === "packaging"
        ? " packaging project"
        : " source project";
  return {
    id: nestedId(kind, sourcePath),
    kind: "variant",
    position,
    title: titleFromPath(sourcePath, suffix),
    summary: null,
    description: null,
    sourcePaths: [sourcePath],
    technologies: {
      languages: language ? [language] : [],
      projectTypes: projectTypesForPath(sourcePath, family, kind),
      packaging: packagingForPath(sourcePath, family, inventory, kind),
    },
    apis: family.apis.map((item) => item.name),
    documentation: [],
    children,
  };
}

function technologiesForPaths(sourcePaths, family, inventory) {
  const languages = unique(sourcePaths.map(languageForPath));
  const projectTypes = unique(
    sourcePaths.flatMap((sourcePath) =>
      projectTypesForPath(sourcePath, family, "scenario"),
    ),
  );
  const packaging = unique(
    sourcePaths.flatMap((sourcePath) =>
      packagingForPath(sourcePath, family, inventory, "scenario"),
    ),
  );
  return {
    languages: languages.length > 0 ? languages : family.languages,
    projectTypes:
      projectTypes.length > 0 ? projectTypes : family.projectTypes,
    packaging: packaging.length > 0 ? packaging : family.packaging,
  };
}

function nestedScenario(value, position, family, inventory) {
  const sourcePaths = value.sourcePaths ?? [value.sourcePath];
  return {
    id: value.id,
    kind: "scenario",
    position,
    title: value.title,
    summary: value.summary ?? null,
    description: null,
    sourcePaths,
    technologies: technologiesForPaths(sourcePaths, family, inventory),
    apis: family.apis.map((item) => item.name),
    documentation: [],
    children: [],
  };
}

function nestedExample(value, position, family, inventory) {
  const sourcePaths = value.sourcePaths ?? [value.sourcePath];
  return {
    id: value.id,
    kind: "example",
    position,
    title: value.title,
    summary: value.summary ?? null,
    description: null,
    sourcePaths,
    technologies: technologiesForPaths(sourcePaths, family, inventory),
    apis: [],
    documentation: [],
    children: [],
  };
}

function selectBalanced(paths) {
  const selected = [];
  const byLanguage = new Map();
  for (const sourcePath of paths) {
    const language = languageForPath(sourcePath) ?? "other";
    const values = byLanguage.get(language) ?? [];
    values.push(sourcePath);
    byLanguage.set(language, values);
  }
  for (const language of ["C#", "C++", "Python", "other"]) {
    const values = byLanguage.get(language);
    if (values?.length) {
      selected.push(values.shift());
    }
  }
  const remaining = [...byLanguage.values()]
    .flat()
    .sort((left, right) => left.localeCompare(right, "en-US"));
  selected.push(...remaining);
  return [...new Set(selected)].slice(
    0,
    contentGuards.maxFeaturedFilesPerRecord,
  );
}

function featuredCandidates(family, inventory) {
  if (family.featuredCandidates.length > 0) {
    return family.featuredCandidates;
  }
  if (inventory.sampleConfigurations.length > 0) {
    return inventory.sampleConfigurations;
  }
  if (inventory.entryPoints.length > 0) {
    return inventory.entryPoints;
  }
  return inventory.sourceProjects;
}

async function createFeaturedFiles(family, inventory, lockArtifacts, readArtifact) {
  const paths = selectBalanced(featuredCandidates(family, inventory));
  const result = [];
  let aggregateBytes = 0;
  for (const sourcePath of paths) {
    const treeEntry = reviewedInventory.treeEntries[sourcePath];
    if (!treeEntry) {
      throw new Error(
        `needs-curation: featured source is absent from the reviewed tree: ${sourcePath}`,
      );
    }
    const artifact = lockArtifacts.get(sourcePath);
    if (artifact) {
      const bytes = await readArtifact(sourcePath);
      if (bytes.byteLength > contentGuards.maxFeaturedFileBytes) {
        throw new Error(
          `needs-curation: featured source exceeds ${contentGuards.maxFeaturedFileBytes} bytes: ${sourcePath}`,
        );
      }
      aggregateBytes += bytes.byteLength;
    }
    result.push({
      path: sourcePath,
      label: titleFromPath(sourcePath, ""),
      description: null,
      language: languageForPath(sourcePath),
      canonicalUrl: sourceUrl(sourcePath, "blob"),
      blobSha: treeEntry.sha,
      sha256: artifact?.sha256 ?? null,
      size: artifact?.size ?? null,
    });
  }
  return { result, aggregateBytes };
}

async function createImages(family, lockArtifacts, readArtifact) {
  const result = [];
  let aggregateBytes = 0;
  for (const candidate of mediaCandidates.filter(
    (item) => item.include && item.familyKey === family.recordKey,
  )) {
    const artifact = lockArtifacts.get(candidate.path);
    if (!artifact) {
      throw new Error(
        `needs-curation: included media is absent from the source lock: ${candidate.path}`,
      );
    }
    const bytes = await readArtifact(candidate.path);
    aggregateBytes += bytes.byteLength;
    result.push({
      id: candidate.id,
      path: candidate.path,
      url: sourceUrl(candidate.path, "blob"),
      mediaType: artifact.mediaType,
      width: null,
      height: null,
      decorative: false,
      alt: candidate.alt,
      provenance: {
        kind: candidate.provenanceKind,
        sourcePath: candidate.sourcePath,
      },
      blobSha: artifact.blobSha,
      sha256: artifact.sha256,
      size: artifact.size,
    });
  }
  return { result, aggregateBytes };
}

function mergeCapabilities(inventory, requirements) {
  return {
    ...requirements,
    declaredPackageCapabilities: inventory.capabilities,
  };
}

function missingFields(family) {
  const missing = ["/description"];
  if (family.summary === null) {
    missing.push("/summary");
  }
  if (family.upstreamTitle === null) {
    missing.push("/title/upstream");
  }
  return missing;
}

function createLicenseManifest(lock) {
  return {
    schemaVersion: 1,
    providerId,
    repository: lock.repository,
    lockedCommitSha: lock.commitSha,
    entries: licenseDefinitions.map((entry) => ({
      ...entry,
      licenseUrl: `${repositoryUrl}/blob/${lock.commitSha}/${encodePath(entry.licensePath)}`,
    })),
  };
}

function assertReviewedInventory() {
  const expectedKeys = familyManifest.map((item) => item.recordKey).sort();
  const actualKeys = Object.keys(reviewedInventory.families).sort();
  if (JSON.stringify(expectedKeys) !== JSON.stringify(actualKeys)) {
    throw new Error(
      "needs-curation: reviewed inventory family keys do not match the grouping manifest",
    );
  }
  for (const [field, expected] of [
    ["treeEntryCount", reviewedSnapshot.treeEntryCount],
    ["blobEntryCount", reviewedSnapshot.blobEntryCount],
    ["solutionCount", reviewedSnapshot.solutionCount],
    ["csharpProjectCount", reviewedSnapshot.csharpProjectCount],
    ["cppProjectCount", reviewedSnapshot.cppProjectCount],
    ["packagingProjectCount", reviewedSnapshot.packagingProjectCount],
  ]) {
    if (reviewedInventory.counts[field] !== expected) {
      throw new Error(
        `needs-curation: reviewed inventory ${field} expected ${expected}, received ${reviewedInventory.counts[field]}`,
      );
    }
  }
  if (
    reviewedInventory.unassigned.length > 0 ||
    reviewedInventory.ambiguous.length > 0
  ) {
    throw new Error(
      "needs-curation: reviewed inventory contains unassigned or ambiguous semantic roots",
    );
  }
}

export async function generate({
  provider,
  lock,
  history,
  readArtifact,
  createRouteSlug,
}) {
  assertReviewedInventory();
  if (
    provider.id !== providerId ||
    lock.providerId !== providerId ||
    lock.commitSha !== reviewedSnapshot.commitSha ||
    lock.treeSha !== reviewedSnapshot.treeSha ||
    lock.commitTime !== reviewedSnapshot.commitTime ||
    lock.ref !== reviewedSnapshot.ref
  ) {
    throw new Error(
      "needs-curation: provider context does not match the reviewed Windows App SDK snapshot",
    );
  }

  const lockArtifacts = new Map(
    lock.artifacts.map((artifact) => [artifact.path, artifact]),
  );
  const records = [];
  for (const family of familyManifest) {
    const inventory = reviewedInventory.families[family.recordKey];
    const { result: featuredSourceFiles, aggregateBytes: featuredBytes } =
      await createFeaturedFiles(
        family,
        inventory,
        lockArtifacts,
        readArtifact,
      );
    const { result: images, aggregateBytes: imageBytes } = await createImages(
      family,
      lockArtifacts,
      readArtifact,
    );
    if (featuredBytes + imageBytes > contentGuards.maxRecordBytes) {
      throw new Error(
        `needs-curation: ${family.recordKey} selected assets exceed ${contentGuards.maxRecordBytes} bytes`,
      );
    }

    const languages = unique([
      ...family.languages,
      ...inventory.sourceProjects.map(languageForPath),
    ]);
    const projectTypes = unique(family.projectTypes);
    const packaging = unique(family.packaging);
    const variants = [
      ...inventory.solutions.map((sourcePath, position) =>
        nestedVariant(sourcePath, position, family, inventory, "solution"),
      ),
      ...inventory.sourceProjects.map((sourcePath, index) =>
        nestedVariant(
          sourcePath,
          inventory.solutions.length + index,
          family,
          inventory,
          "project",
        ),
      ),
      ...inventory.packagingProjects.map((sourcePath, index) =>
        nestedVariant(
          sourcePath,
          inventory.solutions.length +
            inventory.sourceProjects.length +
            index,
          family,
          inventory,
          "packaging",
        ),
      ),
    ];
    const scenarioValues = [...family.scenarios, ...inventory.scenarios];
    const exampleValues = [...family.examples, ...inventory.examples];
    const routeSlug = createRouteSlug(providerId, family.recordKey);
    const canonicalSourceUrl = sourceUrl(family.sourcePath);
    const missing = missingFields(family);
    const requirements = mergeCapabilities(
      inventory,
      mergeRequirements(rootRequirements, family.requirements),
    );

    records.push({
      schemaVersion: 1,
      id: `${providerId}:${family.recordKey}`,
      provider: {
        id: providerId,
        name: provider.name,
        kind: "external",
      },
      recordKey: family.recordKey,
      route: {
        slug: routeSlug,
        path: `samples/${routeSlug}`,
        previousPaths: [],
      },
      source: {
        repository: {
          owner: reviewedSnapshot.repository.owner,
          name: reviewedSnapshot.repository.name,
          url: repositoryUrl,
        },
        ref: lock.ref,
        lockedCommitSha: lock.commitSha,
        treeSha: lock.treeSha,
        commitTime: lock.commitTime,
        path: family.sourcePath,
        canonicalUrl: canonicalSourceUrl,
      },
      title: {
        display: family.title,
        upstream: family.upstreamTitle,
      },
      summary: family.summary,
      description: null,
      technicalAliases: unique([
        ...family.aliases,
        ...inventory.displayNames,
      ]),
      categories: {
        provider: family.providerCategories,
        portal: {
          primary: family.portalCategory,
          secondary: [],
        },
      },
      tags: unique(family.tags),
      technologies: {
        languages,
        projectTypes,
        packaging,
      },
      apis: family.apis,
      documentation: family.documentation,
      requirements,
      links: {
        provider: {
          label: provider.name,
          url: repositoryUrl,
        },
        repository: repositoryUrl,
        source: canonicalSourceUrl,
        commit: `${repositoryUrl}/commit/${lock.commitSha}`,
        tree: `${repositoryUrl}/tree/${lock.commitSha}`,
      },
      content: {
        variants,
        scenarios: scenarioValues.map((value, position) =>
          nestedScenario(value, position, {
            ...family,
            languages,
            projectTypes,
            packaging,
          }, inventory),
        ),
        examples: exampleValues.map((value, position) =>
          nestedExample(value, position, {
            ...family,
            languages,
            projectTypes,
            packaging,
          }, inventory),
        ),
      },
      featuredSourceFiles,
      images,
      relations: [],
      metadata: {
        completeness: family.summary === null ? "minimal" : "partial",
        missingFields: missing,
        warnings: family.warnings,
      },
      attribution: {
        licenseRefs: family.licenseRefs,
        attributionRefs: family.attributionRefs,
      },
      badges: {
        upstreamEditorial: [],
        portalLifecycle: ["new"],
      },
      limitations: family.limitations,
      lifecycle: {
        status: "active",
        firstSeenSync: reviewedSync.id,
        lastReviewedSync: reviewedSync.id,
        lastChangedSync: reviewedSync.id,
        removedAtSync: null,
      },
      fieldProvenance: [
        {
          field: "/title/display",
          ...family.titleProvenance,
        },
        {
          field: "/title/upstream",
          ...family.upstreamTitleProvenance,
        },
        {
          field: "/summary",
          ...family.summaryProvenance,
        },
        {
          field: "/description",
          ...family.descriptionProvenance,
        },
        {
          field: "/categories/provider",
          kind:
            family.providerCategories.length > 0 ? "authored" : "technical",
          sourcePath:
            family.providerCategories.length > 0
              ? rootIndex
              : family.metadataSource,
        },
        {
          field: "/categories/portal",
          kind: "derived",
          sourcePath: family.metadataSource,
        },
        {
          field: "/technologies",
          kind: "derived",
          sourcePath: family.metadataSource,
        },
        {
          field: "/requirements",
          kind: "authored",
          sourcePath:
            Object.keys(family.requirements).length > 0
              ? family.metadataSource
              : rootIndex,
        },
      ],
    });
  }

  const latestReviewedSync = history.syncs.find(
    (sync) => sync.id === history.latestSyncId,
  );
  if (!latestReviewedSync) {
    throw new Error("needs-curation: latest reviewed sync is missing");
  }
  const lifecycleOutput = buildReviewedLifecycleOutput(history);

  return {
    schemaVersion: 1,
    providerId,
    reviewedSync: { ...latestReviewedSync },
    lock,
    records: records.map((record) => applyReviewedHistory(record, history)),
    redirects: lifecycleOutput.redirects,
    tombstones: lifecycleOutput.tombstones,
    licenseManifest: createLicenseManifest(lock),
  };
}
