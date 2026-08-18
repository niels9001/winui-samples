import {
  AUXILIARY_SOURCES,
  CATALOG_PATH,
  DYNAMIC_LEGACY_OVERRIDES,
  EXPECTED,
  PINNED_SNAPSHOT,
  PROVIDER_ID,
  REVIEWED_SYNC,
  UPSTREAM_SCHEMA_PATH,
  mediaTypeForPath,
  pagePaths,
  pinnedBlobUrl,
  repositoryUrl,
} from "./constants.mjs";
import {
  assertDefinitionCombinationCounts,
  parsePinnedUpstreamSchema,
  validateAndFlattenCatalog,
  validateUpstreamSchema,
} from "./catalog.mjs";
import {
  decodeUtf8,
  parseControlExamples,
  parseSampleDefinition,
} from "./parser.mjs";

const baseTechnologies = Object.freeze({
  languages: Object.freeze(["C#", "XAML"]),
  projectTypes: Object.freeze(["WinUI 3"]),
  packaging: Object.freeze(["MSIX"]),
});

function fail(message) {
  throw new Error(`${PROVIDER_ID}: ${message}`);
}

function cloneTechnologies(languages = baseTechnologies.languages) {
  return {
    languages: [...languages],
    projectTypes: [...baseTechnologies.projectTypes],
    packaging: [...baseTechnologies.packaging],
  };
}

function unique(values) {
  return [...new Set(values)];
}

function parseJson(bytes, sourcePath) {
  const source = decodeUtf8(bytes, sourcePath);
  try {
    return JSON.parse(source);
  } catch (error) {
    fail(`${sourcePath}: invalid JSON: ${error.message}`);
  }
}

function assertPinnedContext(provider, lock) {
  if (
    provider.id !== PROVIDER_ID ||
    provider.name !== "WinUI Gallery" ||
    provider.repository.owner !== PINNED_SNAPSHOT.owner ||
    provider.repository.name !== PINNED_SNAPSHOT.repository
  ) {
    fail("provider registry identity drifted");
  }
  for (const [field, expected] of [
    ["ref", PINNED_SNAPSHOT.ref],
    ["commitSha", PINNED_SNAPSHOT.commitSha],
    ["treeSha", PINNED_SNAPSHOT.treeSha],
    ["commitTime", PINNED_SNAPSHOT.commitTime],
  ]) {
    if (lock[field] !== expected) {
      fail(`source lock ${field} must be ${expected}`);
    }
  }
  if (
    lock.providerId !== PROVIDER_ID ||
    lock.repository.owner !== PINNED_SNAPSHOT.owner ||
    lock.repository.name !== PINNED_SNAPSHOT.repository
  ) {
    fail("source lock repository identity drifted");
  }
}

function indexArtifacts(lock) {
  const artifacts = new Map();
  for (const artifact of lock.artifacts) {
    if (artifacts.has(artifact.path)) {
      fail(`duplicate locked artifact ${artifact.path}`);
    }
    artifacts.set(artifact.path, artifact);
  }
  for (const [sourcePath, expectedBlobSha, expectedSize] of [
    [
      CATALOG_PATH,
      PINNED_SNAPSHOT.catalogBlobSha,
      PINNED_SNAPSHOT.catalogSize,
    ],
    [
      UPSTREAM_SCHEMA_PATH,
      PINNED_SNAPSHOT.schemaBlobSha,
      PINNED_SNAPSHOT.schemaSize,
    ],
  ]) {
    const artifact = artifacts.get(sourcePath);
    if (
      !artifact ||
      artifact.blobSha !== expectedBlobSha ||
      artifact.size !== expectedSize
    ) {
      fail(`${sourcePath} does not match its pinned blob identity`);
    }
  }
  return artifacts;
}

async function readLockedArtifacts(lock, readArtifact) {
  const result = new Map();
  const batchSize = 32;
  for (let start = 0; start < lock.artifacts.length; start += batchSize) {
    const batch = lock.artifacts.slice(start, start + batchSize);
    const values = await Promise.all(
      batch.map(async (artifact) => [
        artifact.path,
        await readArtifact(artifact.path),
      ]),
    );
    values.forEach(([sourcePath, bytes]) => result.set(sourcePath, bytes));
  }
  return result;
}

function assertExactLockedInventory(expectedPaths, artifacts) {
  const expected = new Set(expectedPaths);
  const missing = [...expected].filter((sourcePath) => !artifacts.has(sourcePath));
  const extra = [...artifacts.keys()].filter((sourcePath) => !expected.has(sourcePath));
  if (missing.length > 0 || extra.length > 0) {
    fail(
      `locked inventory drifted; missing=[${missing.sort().join(", ")}], extra=[${extra.sort().join(", ")}]`,
    );
  }
  if (expected.size !== EXPECTED.lockedArtifacts) {
    fail(
      `expected ${EXPECTED.lockedArtifacts} locked artifacts, selected ${expected.size}`,
    );
  }
  const totalBytes = [...artifacts.values()].reduce(
    (total, artifact) => total + artifact.size,
    0,
  );
  if (totalBytes !== EXPECTED.lockedArtifactBytes) {
    fail(
      `locked artifact bytes drifted: expected ${EXPECTED.lockedArtifactBytes}, received ${totalBytes}`,
    );
  }
  for (const sourcePath of expected) {
    const artifact = artifacts.get(sourcePath);
    const expectedMediaType = mediaTypeForPath(sourcePath);
    if (artifact.mediaType !== expectedMediaType) {
      fail(
        `${sourcePath}: expected media type ${expectedMediaType}, received ${artifact.mediaType}`,
      );
    }
  }
}

function definitionPath(reference) {
  return `WinUIGallery/Samples/${reference}`;
}

function languageForFeaturedFile(sourcePath, dynamicOverrides) {
  const dynamic = dynamicOverrides.find((item) => item.path === sourcePath);
  if (dynamic) {
    return dynamic.language;
  }
  if (sourcePath.endsWith(".xaml")) {
    return "XAML";
  }
  if (sourcePath.endsWith(".cs")) {
    return "C#";
  }
  return null;
}

function filename(sourcePath) {
  return sourcePath.slice(sourcePath.lastIndexOf("/") + 1);
}

function nestedUnit({
  id,
  position,
  title,
  sourcePaths,
  languages,
  apis,
  children = [],
}) {
  return {
    id,
    kind: "example",
    position,
    title,
    summary: null,
    description: null,
    sourcePaths,
    technologies: cloneTechnologies(languages),
    apis,
    documentation: [],
    children,
  };
}

function buildExamples(page, parsedExamples, definitions, dynamicOverrides) {
  return parsedExamples.map((example) => {
    const sourcePaths = [pagePaths(page.UniqueId)[0]];
    const children = [];
    let title = `Inline example ${example.position}`;
    let childPosition = 0;

    if (example.sampleDefinition) {
      const sourcePath = definitionPath(example.sampleDefinition);
      const definition = definitions.get(sourcePath);
      if (!definition) {
        fail(`${page.UniqueId}: missing parsed definition ${sourcePath}`);
      }
      sourcePaths.push(sourcePath);
      title = definition.header;
      if (definition.xaml !== null) {
        children.push(
          nestedUnit({
            id: `example-${example.position}-xaml`,
            position: childPosition,
            title: `${definition.header} (XAML)`,
            sourcePaths: [sourcePath],
            languages: ["XAML"],
            apis: [],
          }),
        );
        childPosition += 1;
      }
      if (definition.csharp !== null) {
        children.push(
          nestedUnit({
            id: `example-${example.position}-csharp`,
            position: childPosition,
            title: `${definition.header} (C#)`,
            sourcePaths: [sourcePath],
            languages: ["C#"],
            apis: [],
          }),
        );
        childPosition += 1;
      }
    }

    for (const dynamic of dynamicOverrides.filter(
      (item) => item.examplePosition === example.position,
    )) {
      sourcePaths.push(dynamic.path);
      children.push(
        nestedUnit({
          id: `example-${example.position}-dynamic-${childPosition}`,
          position: childPosition,
          title: filename(dynamic.path),
          sourcePaths: [dynamic.path],
          languages: [dynamic.language],
          apis: [],
        }),
      );
      childPosition += 1;
    }

    return nestedUnit({
      id: `example-${example.position}`,
      position: example.position - 1,
      title,
      sourcePaths: unique(sourcePaths),
      languages: baseTechnologies.languages,
      apis: page.ApiNamespace ? [page.ApiNamespace] : [],
      children,
    });
  });
}

function classifyDocumentation(document) {
  if (
    document.Title.toLowerCase().includes("api") ||
    document.Uri.includes("/api/")
  ) {
    return "api-reference";
  }
  if (new URL(document.Uri).hostname === "learn.microsoft.com") {
    return "learn";
  }
  if (new URL(document.Uri).hostname === "github.com") {
    return "repository";
  }
  return "other";
}

function pngDimensions(bytes, sourcePath) {
  if (
    bytes.byteLength < 24 ||
    bytes[0] !== 0x89 ||
    bytes[1] !== 0x50 ||
    bytes[2] !== 0x4e ||
    bytes[3] !== 0x47
  ) {
    fail(`${sourcePath}: invalid PNG header`);
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return {
    width: view.getUint32(16),
    height: view.getUint32(20),
  };
}

function buildApis(page) {
  const apis = [];
  if (page.ApiNamespace) {
    apis.push({
      name: page.ApiNamespace,
      description: "Upstream API namespace",
      url: null,
    });
  }
  for (const baseClass of page.BaseClasses ?? []) {
    apis.push({
      name: baseClass,
      description: "Upstream base class",
      url: null,
    });
  }
  return apis;
}

function buildWarnings(page) {
  const warnings = [
    {
      code: "decorative-icon-alt-contract",
      message:
        "The upstream image is a decorative control icon shown beside the title; the current shared contract requires a non-empty alt fallback until integration can render alt=\"\".",
      field: "/images/0/alt",
      sourcePath: CATALOG_PATH,
    },
  ];
  if (!Object.hasOwn(page, "Description")) {
    warnings.push({
      code: "upstream-description-absent",
      message:
        "The upstream Description field is absent; the authored Subtitle is used as the only fallback.",
      field: "/description",
      sourcePath: CATALOG_PATH,
    });
  }
  if (page.SourcePath) {
    warnings.push({
      code: "external-implementation-pointer",
      message:
        `Upstream SourcePath ${page.SourcePath} points into microsoft/microsoft-ui-xaml and is not combined with the WinUI Gallery commit or cache.`,
      field: "/metadata/warnings",
      sourcePath: CATALOG_PATH,
    });
  }
  const storeDocument = page.Docs.find((document) =>
    document.Uri.startsWith("ms-windows-store:"),
  );
  if (storeDocument) {
    warnings.push({
      code: "non-web-documentation-uri",
      message:
        `Upstream documentation entry "${storeDocument.Title}" uses the non-web URI ${storeDocument.Uri} and is not emitted as an HTTPS link.`,
      field: "/documentation",
      sourcePath: CATALOG_PATH,
    });
  }
  if (page.image.caseCorrected) {
    warnings.push({
      code: "reviewed-image-path-case",
      message:
        `Upstream ImagePath resolves through a reviewed case correction from ${page.image.authoredPath} to ${page.image.resolvedPath}.`,
      field: "/images/0/path",
      sourcePath: CATALOG_PATH,
    });
  }
  return warnings;
}

function buildRecord({
  page,
  provider,
  lock,
  createRouteSlug,
  artifacts,
  artifactBytes,
  parsedExamples,
  definitions,
}) {
  const recordKey = page.UniqueId;
  const id = `${PROVIDER_ID}:${recordKey}`;
  const slug = createRouteSlug(PROVIDER_ID, recordKey);
  const [pageXaml, pageCodeBehind] = pagePaths(recordKey);
  const dynamicOverrides = DYNAMIC_LEGACY_OVERRIDES.filter(
    (item) => item.recordKey === recordKey,
  );
  const definitionPaths = parsedExamples
    .filter((example) => example.sampleDefinition)
    .map((example) => definitionPath(example.sampleDefinition));
  const featuredPaths = unique([
    pageXaml,
    pageCodeBehind,
    ...(AUXILIARY_SOURCES[recordKey] ?? []),
    ...definitionPaths,
    ...dynamicOverrides.map((item) => item.path),
  ]).sort((left, right) => left.localeCompare(right, "en-US"));
  const featuredSourceFiles = featuredPaths.map((sourcePath) => {
    const artifact = artifacts.get(sourcePath);
    if (!artifact) {
      fail(`${recordKey}: featured file is not locked: ${sourcePath}`);
    }
    return {
      path: sourcePath,
      label: filename(sourcePath),
      description: null,
      language: languageForFeaturedFile(sourcePath, dynamicOverrides),
      canonicalUrl: pinnedBlobUrl(sourcePath),
      blobSha: artifact.blobSha,
      sha256: artifact.sha256,
      size: artifact.size,
    };
  });
  const imageArtifact = artifacts.get(page.image.resolvedPath);
  if (!imageArtifact) {
    fail(`${recordKey}: image is not locked: ${page.image.resolvedPath}`);
  }
  const dimensions = pngDimensions(
    artifactBytes.get(page.image.resolvedPath),
    page.image.resolvedPath,
  );
  const warnings = buildWarnings(page);
  const missingFields = ["/requirements/minimumWindowsVersion"];
  if (!Object.hasOwn(page, "Description")) {
    missingFields.push("/description");
  }
  const sourceRepository = {
    owner: PINNED_SNAPSHOT.owner,
    name: PINNED_SNAPSHOT.repository,
    url: repositoryUrl(),
  };
  const sourceUrl = pinnedBlobUrl(pageXaml);

  return {
    schemaVersion: 1,
    id,
    provider: {
      id: PROVIDER_ID,
      name: provider.name,
      kind: "external",
    },
    recordKey,
    route: {
      slug,
      path: `samples/${slug}`,
      previousPaths: [],
    },
    source: {
      repository: sourceRepository,
      ref: lock.ref,
      lockedCommitSha: lock.commitSha,
      treeSha: lock.treeSha,
      commitTime: lock.commitTime,
      path: pageXaml,
      canonicalUrl: sourceUrl,
    },
    title: {
      display: page.Title,
      upstream: page.Title,
    },
    summary: page.Subtitle,
    description: page.Description ?? page.Subtitle,
    technicalAliases: [recordKey],
    categories: {
      provider: unique([
        page.group.Title,
        page.group.UniqueId,
        ...(page.group.IsSpecialSection ? ["Upstream special section"] : []),
      ]),
      portal: {
        primary: null,
        secondary: [],
      },
    },
    tags: [...page.Tags],
    technologies: cloneTechnologies(),
    apis: buildApis(page),
    documentation: page.Docs
      .filter((document) => document.Uri.startsWith("https:"))
      .map((document) => ({
        title: document.Title,
        url: document.Uri,
        kind: classifyDocumentation(document),
      })),
    requirements: {
      minimumWindowsVersion: null,
      architectures: [],
      declaredPackageCapabilities: [],
      prerequisites: {
        hardware: [],
        accountsAndServices: [],
        software: ["Windows App SDK"],
        notes: [],
      },
    },
    links: {
      provider: {
        label: provider.name,
        url: repositoryUrl(),
      },
      repository: repositoryUrl(),
      source: sourceUrl,
      commit: `${repositoryUrl()}/commit/${lock.commitSha}`,
      tree: `${repositoryUrl()}/tree/${lock.commitSha}`,
    },
    content: {
      variants: [],
      scenarios: [],
      examples: buildExamples(
        page,
        parsedExamples,
        definitions,
        dynamicOverrides,
      ),
    },
    featuredSourceFiles,
    images: [
      {
        id: "control-icon",
        path: page.image.resolvedPath,
        url: pinnedBlobUrl(page.image.resolvedPath),
        mediaType: "image/png",
        width: dimensions.width,
        height: dimensions.height,
        alt: page.Title,
        provenance: {
          kind: "authored",
          sourcePath: CATALOG_PATH,
        },
        blobSha: imageArtifact.blobSha,
        sha256: imageArtifact.sha256,
        size: imageArtifact.size,
      },
    ],
    relations: page.RelatedControls.map((target) => ({
      type: "related",
      targetId: `${PROVIDER_ID}:${target}`,
      providerId: PROVIDER_ID,
    })),
    metadata: {
      completeness: "partial",
      missingFields,
      warnings,
    },
    attribution: {
      licenseRefs: [`${PROVIDER_ID}:root`],
      attributionRefs: [],
    },
    badges: {
      upstreamEditorial: [
        ...(page.IsNew
          ? [
              {
                id: "upstream-new",
                label: "Upstream editorial: New",
                sourcePath: CATALOG_PATH,
              },
            ]
          : []),
        ...(page.IsUpdated
          ? [
              {
                id: "upstream-updated",
                label: "Upstream editorial: Updated",
                sourcePath: CATALOG_PATH,
              },
            ]
          : []),
      ],
      portalLifecycle: ["new"],
    },
    limitations: [],
    lifecycle: {
      status: "active",
      firstSeenSync: REVIEWED_SYNC.id,
      lastReviewedSync: REVIEWED_SYNC.id,
      lastChangedSync: REVIEWED_SYNC.id,
      removedAtSync: null,
    },
    fieldProvenance: [
      {
        field: "/title/display",
        kind: "authored",
        sourcePath: CATALOG_PATH,
      },
      {
        field: "/title/upstream",
        kind: "authored",
        sourcePath: CATALOG_PATH,
      },
      {
        field: "/summary",
        kind: "authored",
        sourcePath: CATALOG_PATH,
      },
      {
        field: "/description",
        kind: "authored",
        sourcePath: CATALOG_PATH,
      },
    ],
  };
}

function buildLicenseManifest(lock) {
  return {
    schemaVersion: 1,
    providerId: PROVIDER_ID,
    repository: {
      owner: PINNED_SNAPSHOT.owner,
      name: PINNED_SNAPSHOT.repository,
    },
    lockedCommitSha: lock.commitSha,
    entries: [
      {
        id: `${PROVIDER_ID}:root`,
        scopePath: "",
        spdxId: "MIT",
        licensePath: "LICENSE",
        licenseUrl: pinnedBlobUrl("LICENSE"),
        attributionText: null,
      },
    ],
  };
}

export async function generate({
  provider,
  lock,
  readArtifact,
  createRouteSlug,
}) {
  assertPinnedContext(provider, lock);
  const artifacts = indexArtifacts(lock);
  const artifactBytes = await readLockedArtifacts(lock, readArtifact);
  const catalog = parseJson(artifactBytes.get(CATALOG_PATH), CATALOG_PATH);
  const upstreamSchema = parsePinnedUpstreamSchema(
    decodeUtf8(
      artifactBytes.get(UPSTREAM_SCHEMA_PATH),
      UPSTREAM_SCHEMA_PATH,
    ),
  );
  validateUpstreamSchema(upstreamSchema);
  const pages = validateAndFlattenCatalog(catalog);

  const pageExamples = new Map();
  const definitions = new Map();
  const definitionCombinations = new Map();
  const referencedDefinitions = new Set();
  let controlExampleCount = 0;
  let controlExamplePages = 0;

  for (const page of pages) {
    const [pageXaml, pageCodeBehind] = pagePaths(page.UniqueId);
    const source = decodeUtf8(artifactBytes.get(pageXaml), pageXaml);
    const examples = parseControlExamples(source, pageXaml);
    pageExamples.set(page.UniqueId, examples);
    controlExampleCount += examples.length;
    if (examples.length > 0) {
      controlExamplePages += 1;
    }
    for (const example of examples) {
      if (!example.sampleDefinition) {
        continue;
      }
      const sourcePath = definitionPath(example.sampleDefinition);
      if (!sourcePath.startsWith(`WinUIGallery/Samples/${page.UniqueId}/`)) {
        fail(
          `${page.UniqueId}: sample definition crosses its page directory: ${sourcePath}`,
        );
      }
      if (referencedDefinitions.has(sourcePath)) {
        fail(`duplicate live SampleDefinition reference ${sourcePath}`);
      }
      referencedDefinitions.add(sourcePath);
      const parsed = parseSampleDefinition(
        decodeUtf8(artifactBytes.get(sourcePath), sourcePath),
        sourcePath,
      );
      definitions.set(sourcePath, parsed);
      definitionCombinations.set(
        parsed.combination,
        (definitionCombinations.get(parsed.combination) ?? 0) + 1,
      );
    }

    const sourcePair = [
      source,
      decodeUtf8(artifactBytes.get(pageCodeBehind), pageCodeBehind),
    ].join("\n");
    for (const dynamic of DYNAMIC_LEGACY_OVERRIDES.filter(
      (item) => item.recordKey === page.UniqueId,
    )) {
      if (!sourcePair.includes(filename(dynamic.path).replace(/\.txt$/, ""))) {
        fail(`${page.UniqueId}: dynamic override is not referenced: ${dynamic.path}`);
      }
      if (!examples.some((item) => item.position === dynamic.examplePosition)) {
        fail(
          `${page.UniqueId}: dynamic override targets absent example ${dynamic.examplePosition}`,
        );
      }
    }
  }

  if (
    controlExampleCount !== EXPECTED.controlExamples ||
    controlExamplePages !== EXPECTED.controlExamplePages ||
    referencedDefinitions.size !== EXPECTED.sampleDefinitions
  ) {
    fail(
      `example invariants drifted: ${controlExampleCount} blocks across ${controlExamplePages} pages and ${referencedDefinitions.size} definitions`,
    );
  }
  assertDefinitionCombinationCounts(definitionCombinations);

  const selectedSourcePaths = unique([
    ...pages.flatMap((page) => pagePaths(page.UniqueId)),
    ...Object.values(AUXILIARY_SOURCES).flat(),
    ...referencedDefinitions,
    ...DYNAMIC_LEGACY_OVERRIDES.map((item) => item.path),
  ]);
  const selectedSourceBytes = selectedSourcePaths.reduce(
    (total, sourcePath) => total + artifacts.get(sourcePath).size,
    0,
  );
  if (
    selectedSourcePaths.length !== EXPECTED.selectedSourceFiles ||
    selectedSourceBytes !== EXPECTED.selectedSourceBytes
  ) {
    fail(
      `selected source inventory drifted: ${selectedSourcePaths.length} files / ${selectedSourceBytes} bytes`,
    );
  }

  const expectedArtifacts = unique([
    CATALOG_PATH,
    UPSTREAM_SCHEMA_PATH,
    ...selectedSourcePaths,
    ...pages.map((page) => page.image.resolvedPath),
  ]);
  assertExactLockedInventory(expectedArtifacts, artifacts);

  const records = pages
    .map((page) =>
      buildRecord({
        page,
        provider,
        lock,
        createRouteSlug,
        artifacts,
        artifactBytes,
        parsedExamples: pageExamples.get(page.UniqueId),
        definitions,
      }),
    )
    .sort((left, right) => left.id.localeCompare(right.id, "en-US"));

  const relatedEdges = records.reduce(
    (total, record) => total + record.relations.length,
    0,
  );
  const nestedCodeUnits = records.reduce(
    (total, record) =>
      total +
      record.content.examples.reduce(
        (exampleTotal, example) => exampleTotal + example.children.length,
        0,
      ),
    0,
  );
  if (
    records.length !== EXPECTED.records ||
    relatedEdges !== EXPECTED.relatedEdges ||
    nestedCodeUnits !== EXPECTED.nestedCodeUnits
  ) {
    fail("normalized record or nested-content counts drifted");
  }

  return {
    schemaVersion: 1,
    providerId: PROVIDER_ID,
    reviewedSync: { ...REVIEWED_SYNC },
    lock,
    records,
    redirects: [],
    tombstones: [],
    licenseManifest: buildLicenseManifest(lock),
  };
}
