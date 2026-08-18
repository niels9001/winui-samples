import assert from "node:assert/strict";
import {
  mkdtemp,
  readFile,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  canonicalStringify,
} from "../lib/canonical.mjs";
import { loadExternalState } from "../lib/config.mjs";
import { generateExternalCatalog } from "../lib/generate.mjs";
import {
  assertSafePosixPath,
} from "../lib/guards.mjs";
import {
  createRouteSlug,
} from "../lib/identity.mjs";
import { reviewedInventory } from "../providers/windows-app-sdk-samples/inventory.mjs";
import {
  contentGuards,
  familyManifest,
  licenseDefinitions,
  mediaCandidates,
  providerId,
  reviewedSnapshot,
  reviewedSync,
} from "../providers/windows-app-sdk-samples/manifest.mjs";

async function enabledState() {
  const state = await loadExternalState();
  const provider = state.providers.get(providerId);
  provider.enabled = true;
  provider.allowedSourceRoots = [
    ...provider.allowedSourceRoots,
    "DynamicDependenciesSample",
  ];
  return state;
}

let catalogPromise;
function generatedCatalog() {
  catalogPromise ??= enabledState().then((state) =>
    generateExternalCatalog({ state }),
  );
  return catalogPromise;
}

function recordByKey(catalog, recordKey) {
  const record = catalog.records.find((item) => item.recordKey === recordKey);
  assert.ok(record, `missing record ${recordKey}`);
  return record;
}

function nestedUnits(record) {
  const result = [];
  function visit(units) {
    for (const unit of units) {
      result.push(unit);
      visit(unit.children);
    }
  }
  visit(record.content.variants);
  visit(record.content.scenarios);
  visit(record.content.examples);
  return result;
}

function warningCodes(record) {
  return new Set(record.metadata.warnings.map((warning) => warning.code));
}

function unitBySource(record, sourceSuffix) {
  const unit = nestedUnits(record).find((item) =>
    item.sourcePaths.some((sourcePath) =>
      sourcePath.endsWith(sourceSuffix),
    ),
  );
  assert.ok(unit, `missing nested source ${sourceSuffix}`);
  return unit;
}

test("reviewed snapshot and explicit family manifest match the pinned inventory", () => {
  assert.equal(familyManifest.length, 42);
  assert.equal(reviewedInventory.counts.treeEntryCount, 3213);
  assert.equal(reviewedInventory.counts.blobEntryCount, 2702);
  assert.equal(reviewedInventory.counts.sampleRootDirectoryCount, 23);
  assert.equal(reviewedInventory.counts.featureDirectoryCount, 22);
  assert.equal(reviewedInventory.counts.readmeCount, 43);
  assert.equal(reviewedInventory.counts.sampleFrontmatterCount, 22);
  assert.equal(reviewedInventory.counts.solutionCount, 86);
  assert.equal(reviewedInventory.counts.csharpProjectCount, 55);
  assert.equal(reviewedInventory.counts.cppProjectCount, 49);
  assert.equal(reviewedInventory.counts.packagingProjectCount, 26);
  assert.equal(reviewedInventory.counts.legacyCppProjectCount, 1);
  assert.equal(reviewedInventory.unassigned.length, 0);
  assert.equal(reviewedInventory.ambiguous.length, 0);
  assert.deepEqual(
    Object.keys(reviewedInventory.families).sort(),
    familyManifest.map((family) => family.recordKey).sort(),
  );
  assert.equal(reviewedInventory.reviewedCommitSha, reviewedSnapshot.commitSha);
  assert.equal(reviewedInventory.reviewedTreeSha, reviewedSnapshot.treeSha);
});

test("all projects and solutions belong to exactly one conceptual family", () => {
  const families = Object.values(reviewedInventory.families);
  const solutions = families.flatMap((family) => family.solutions);
  const sourceProjects = families.flatMap((family) => family.sourceProjects);
  const packagingProjects = families.flatMap(
    (family) => family.packagingProjects,
  );

  assert.equal(solutions.length, 86);
  assert.equal(new Set(solutions).size, 86);
  assert.equal(
    sourceProjects.filter((item) => item.endsWith(".csproj")).length,
    55,
  );
  assert.equal(
    sourceProjects.filter((item) => item.endsWith(".vcxproj")).length,
    49,
  );
  assert.equal(new Set(sourceProjects).size, 104);
  assert.equal(packagingProjects.length, 26);
  assert.equal(new Set(packagingProjects).size, 26);

  const keys = new Set(familyManifest.map((family) => family.recordKey));
  for (const excluded of [
    "Templates/VSIX",
    "Samples/localpackages",
    "WidgetHelper shared project as a standalone record",
    "SceneGraph SamplesCommon as a standalone record",
    "WindowsML Shared, Resources, and capture-logs as standalone records",
  ]) {
    assert.ok(reviewedInventory.exclusions.includes(excluded));
  }
  assert.equal(keys.has("widget-helper"), false);
  assert.equal(keys.has("scene-graph/samples-common"), false);
  assert.equal(keys.has("windows-ml/capture-logs"), false);

  assert.deepEqual(reviewedInventory.legacyProjectAliases, [
    {
      familyKey: "dynamic-dependencies",
      primaryPath:
        "DynamicDependenciesSample/DynamicDependencies/DirectX/D3D9ExSample.vcxproj",
      nestedLegacyPath:
        "DynamicDependenciesSample/DynamicDependencies/DirectX/D3D9ExSample.vcproj",
    },
  ]);
});

test("provider independently emits 42 fully validated normalized records", async () => {
  const catalog = await generatedCatalog();
  assert.equal(catalog.providers.length, 1);
  assert.equal(catalog.providers[0].id, providerId);
  assert.equal(catalog.providers[0].recordCount, 42);
  assert.equal(catalog.records.length, 42);
  assert.equal(catalog.licenses.length, 1);
  assert.equal(catalog.licenses[0].entries.length, 5);

  for (const record of catalog.records) {
    assert.equal(record.provider.id, providerId);
    assert.equal(record.source.lockedCommitSha, reviewedSnapshot.commitSha);
    assert.equal(record.source.treeSha, reviewedSnapshot.treeSha);
    assert.equal(record.lifecycle.firstSeenSync, reviewedSync.id);
    assert.deepEqual(record.badges.portalLifecycle, ["new"]);
    assert.ok(record.attribution.licenseRefs.length >= 1);
    assert.equal(record.route.previousPaths.length, 0);
  }
});

test("Activation, PhotoEditor, and SecureUI match normalized golden fixtures", async () => {
  const catalog = await generatedCatalog();
  for (const [filename, recordKey] of [
    ["activation.json", "app-lifecycle/activation"],
    ["photo-editor.json", "photo-editor"],
    ["secure-ui.json", "secure-ui"],
  ]) {
    const expected = await readFile(
      path.resolve(
        "external",
        "curation",
        providerId,
        "golden",
        filename,
      ),
      "utf8",
    );
    assert.equal(
      canonicalStringify(recordByKey(catalog, recordKey)),
      expected,
    );
  }
});

test("solutions, source projects, and packaging projects remain nested variants", async () => {
  const catalog = await generatedCatalog();
  const variants = catalog.records.flatMap((record) => record.content.variants);
  assert.equal(variants.length, 216);
  assert.equal(
    variants.filter((unit) => unit.sourcePaths[0]?.endsWith(".sln")).length,
    86,
  );
  assert.equal(
    variants.filter((unit) =>
      /\.(?:csproj|vcxproj)$/u.test(unit.sourcePaths[0] ?? ""),
    ).length,
    104,
  );
  assert.equal(
    variants.filter((unit) => unit.sourcePaths[0]?.endsWith(".wapproj")).length,
    26,
  );

  const dynamic = recordByKey(catalog, "dynamic-dependencies");
  const dynamicProject = dynamic.content.variants.find((unit) =>
    unit.sourcePaths[0]?.endsWith("D3D9ExSample.vcxproj"),
  );
  assert.ok(dynamicProject);
  assert.deepEqual(dynamicProject.children.map((unit) => unit.sourcePaths[0]), [
    "DynamicDependenciesSample/DynamicDependencies/DirectX/D3D9ExSample.vcproj",
  ]);
  assert.equal(
    catalog.records.some((record) => record.source.path.endsWith(".wapproj")),
    false,
  );
  for (const variant of variants.filter((unit) =>
    unit.sourcePaths[0]?.toLowerCase().includes("unpackaged"),
  )) {
    assert.ok(variant.technologies.packaging.includes("unpackaged"));
    assert.equal(variant.technologies.packaging.includes("MSIX"), false);
  }
});

test("nested units describe their own language, framework, and deployment", async () => {
  const catalog = await generatedCatalog();
  const activation = recordByKey(catalog, "app-lifecycle/activation");
  assert.deepEqual(
    unitBySource(activation, "CsConsoleActivation.csproj").technologies,
    {
      languages: ["C#"],
      projectTypes: ["Console"],
      packaging: ["unpackaged"],
    },
  );
  assert.deepEqual(
    unitBySource(
      activation,
      "CsWinUiDesktopActivation.csproj",
    ).technologies,
    {
      languages: ["C#"],
      projectTypes: ["WinUI 3"],
      packaging: ["MSIX"],
    },
  );

  const island = recordByKey(catalog, "islands/simple-island-app");
  assert.deepEqual(
    unitBySource(island, "SimpleIslandApp.sln").technologies.packaging,
    ["framework-dependent", "unpackaged"],
  );
  assert.deepEqual(
    unitBySource(island, "SimpleIslandApp.vcxproj").technologies,
    {
      languages: ["C++"],
      projectTypes: ["Win32"],
      packaging: ["framework-dependent", "unpackaged"],
    },
  );

  const windowBasics = recordByKey(
    catalog,
    "windowing",
  ).content.scenarios.find(
    (scenario) => scenario.title === "Window Basics",
  );
  assert.ok(windowBasics);
  assert.deepEqual(windowBasics.technologies, {
    languages: ["C#"],
    projectTypes: ["WinUI 3"],
    packaging: ["MSIX"],
  });

  const restartScenarios = recordByKey(
    catalog,
    "app-lifecycle/restart-registration",
  ).content.scenarios;
  for (const scenario of restartScenarios) {
    assert.equal(scenario.sourcePaths.length, 2);
    assert.deepEqual(scenario.technologies.languages, ["C#", "C++"]);
    assert.deepEqual(scenario.technologies.projectTypes, ["WinUI 3"]);
    assert.deepEqual(scenario.technologies.packaging, ["MSIX"]);
  }

  const windowsMl = recordByKey(
    catalog,
    "windows-ml/console-inference",
  );
  assert.deepEqual(
    unitBySource(
      windowsMl,
      "CppConsoleDesktop.SelfContained.vcxproj",
    ).technologies,
    {
      languages: ["C++"],
      projectTypes: ["Console"],
      packaging: ["self-contained", "unpackaged"],
    },
  );

  const selfContained = recordByKey(
    catalog,
    "self-contained-deployment",
  );
  assert.deepEqual(
    selfContained.featuredSourceFiles
      .slice(0, 2)
      .map((file) => file.path),
    [
      "Samples/SelfContainedDeployment/cs1/cs-winui-packaged-wap/SelfContainedDeployment/SampleConfiguration.cs",
      "Samples/SelfContainedDeployment/cpp/cpp-winui-packaged/SampleConfiguration.cpp",
    ],
  );
});

test("authored language gaps are filled from the project-manifest union", async () => {
  const catalog = await generatedCatalog();
  for (const key of [
    "background-task/in-process",
    "background-task/out-of-process",
    "notifications/app",
  ]) {
    const record = recordByKey(catalog, key);
    assert.deepEqual(record.technologies.languages, ["C#", "C++"]);
    assert.ok(warningCodes(record).has("authored-language-list-incomplete"));
  }
});

test("technical-only families do not receive invented summaries", async () => {
  const catalog = await generatedCatalog();
  const expected = [
    "app-lifecycle/environment-variables",
    "app-lifecycle/restart-registration",
    "insights",
    "scene-graph/depth-demo",
    "scene-graph/effect-editor",
    "scene-graph/material-creator",
    "secure-ui",
    "self-contained-deployment",
  ];
  assert.deepEqual(
    catalog.records
      .filter((record) => record.summary === null)
      .map((record) => record.recordKey)
      .sort(),
    expected.sort(),
  );
  for (const recordKey of expected) {
    const record = recordByKey(catalog, recordKey);
    assert.ok(record.metadata.missingFields.includes("/summary"));
  }
});

test("frontmatter, link, and root-index defects remain actionable warnings", async () => {
  const catalog = await generatedCatalog();
  for (const key of [
    "background-task/in-process",
    "background-task/out-of-process",
    "composition/dynamic-refresh-rate-tool",
  ]) {
    assert.ok(warningCodes(recordByKey(catalog, key)).has("malformed-frontmatter"));
  }
  for (const key of [
    "background-task/in-process",
    "background-task/out-of-process",
  ]) {
    assert.ok(warningCodes(recordByKey(catalog, key)).has("duplicate-url-fragment"));
  }
  assert.ok(
    warningCodes(recordByKey(catalog, "app-lifecycle/share-target")).has(
      "normalized-relative-link",
    ),
  );
  const sceneGraph = recordByKey(catalog, "scene-graph/sample-gallery");
  assert.equal(
    sceneGraph.metadata.warnings.filter(
      (warning) => warning.code === "missing-relative-link",
    ).length,
    2,
  );
  assert.ok(warningCodes(sceneGraph).has("external-media-omitted"));
  for (const key of [
    "composition/dynamic-refresh-rate-tool",
    "input",
    "insights",
    "photo-editor",
    "secure-ui",
    "self-contained-deployment",
  ]) {
    assert.ok(warningCodes(recordByKey(catalog, key)).has("root-index-omission"));
  }
  for (const key of [
    "windows-ml/console-inference",
    "windows-ml/genai",
    "windows-ml/desktop-image-classification",
  ]) {
    assert.ok(warningCodes(recordByKey(catalog, key)).has("shallow-solution-link"));
  }
});

test("PhotoEditor link repairs are explicit, unique, and bounded for display", async () => {
  const repairs = reviewedInventory.sourceLinkRepairs;
  assert.equal(repairs.occurrences.length, 16);
  assert.equal(repairs.reviewedTargets.length, 13);
  assert.equal(new Set(repairs.reviewedTargets).size, 13);
  for (const target of repairs.reviewedTargets) {
    assert.ok(reviewedInventory.treeEntries[target], target);
  }

  const photoEditor = recordByKey(await generatedCatalog(), "photo-editor");
  assert.equal(photoEditor.featuredSourceFiles.length, 6);
  assert.ok(warningCodes(photoEditor).has("repaired-source-links"));
  assert.equal(photoEditor.images.length, 0);
});

test("scenario and example extraction preserves authored subordinate structure", async () => {
  const catalog = await generatedCatalog();
  assert.equal(reviewedInventory.counts.sceneGraphGalleryScenarioCount, 52);
  assert.equal(reviewedInventory.counts.windowsAiMarkdownExampleCount, 20);
  assert.equal(
    recordByKey(catalog, "scene-graph/sample-gallery").content.scenarios.length,
    52,
  );
  assert.equal(
    recordByKey(catalog, "windows-ai").content.examples.length,
    20,
  );
  assert.deepEqual(
    recordByKey(catalog, "windowing").content.scenarios.map(
      (scenario) => scenario.title,
    ),
    ["Window Basics", "Title Bar", "Presenters", "Z-Order"],
  );
  assert.deepEqual(
    recordByKey(
      catalog,
      "app-lifecycle/restart-registration",
    ).content.scenarios.map((scenario) => scenario.title),
    [
      "Update reboot registration",
      "Crash recovery registration",
      "Reboot type detection",
    ],
  );
});

test("root requirements are inherited and authored sample overrides remain distinct", async () => {
  const catalog = await generatedCatalog();
  const activation = recordByKey(catalog, "app-lifecycle/activation");
  assert.equal(
    activation.requirements.minimumWindowsVersion,
    "Windows 10, version 1809 (build 17763) or later",
  );
  assert.ok(
    activation.requirements.prerequisites.software.some((item) =>
      item.includes("Visual Studio"),
    ),
  );

  const windowsAi = recordByKey(catalog, "windows-ai");
  assert.deepEqual(windowsAi.requirements.architectures, ["arm64"]);
  assert.deepEqual(windowsAi.requirements.prerequisites.hardware, ["Copilot+ PC"]);
  assert.ok(
    windowsAi.limitations.some((item) => item.includes("package identity")),
  );

  const windowsMl = recordByKey(
    catalog,
    "windows-ml/desktop-image-classification",
  );
  assert.equal(
    windowsMl.requirements.minimumWindowsVersion,
    "Windows 11, version 24H2 (build 26100) or later",
  );

  const push = recordByKey(catalog, "notifications/push");
  assert.ok(
    push.requirements.prerequisites.accountsAndServices.includes(
      "An Azure AppId for the sample application",
    ),
  );
  assert.ok(
    push.requirements.prerequisites.software.some((item) =>
      item.includes("Postman"),
    ),
  );

  const installer = recordByKey(catalog, "installer");
  assert.ok(installer.limitations[0].includes("trusted test installer"));
  const python = recordByKey(catalog, "windows-ml/python-squeezenet");
  assert.ok(
    python.requirements.prerequisites.notes.some((item) =>
      item.includes(".dev"),
    ),
  );
});

test("source categories stay separate from derived portal taxonomy", async () => {
  const catalog = await generatedCatalog();
  const resource = recordByKey(catalog, "resource-management");
  assert.deepEqual(resource.categories.provider, [
    "App Lifecycle and System Services",
    "Data and Files",
  ]);
  assert.equal(resource.categories.portal.primary, "data-and-files");
  const windowsMl = recordByKey(catalog, "windows-ml/console-inference");
  assert.deepEqual(windowsMl.categories.provider, ["Artificial Intelligence"]);
  assert.equal(
    windowsMl.categories.portal.primary,
    "artificial-intelligence",
  );
});

test("five license associations and media allowlist remain pinned and scoped", async () => {
  const catalog = await generatedCatalog();
  assert.equal(licenseDefinitions.length, 5);
  assert.deepEqual(
    catalog.licenses[0].entries.map((entry) => entry.id).sort(),
    licenseDefinitions.map((entry) => entry.id).sort(),
  );
  assert.equal(mediaCandidates.length, 5);
  assert.equal(mediaCandidates.filter((item) => item.include).length, 2);
  assert.equal(
    mediaCandidates.filter((item) => !item.include).length,
    3,
  );
  assert.equal(
    catalog.records.flatMap((record) => record.images).length,
    2,
  );
  const allImagePaths = new Set(
    catalog.records.flatMap((record) =>
      record.images.map((image) => image.path),
    ),
  );
  assert.deepEqual([...allImagePaths].sort(), [
    "Samples/Islands/img/designer.png",
    "Samples/Islands/img/screenshot.png",
  ]);
  assert.equal(
    [...allImagePaths].some((item) => item.includes("PhotoEditor/images")),
    false,
  );
  assert.equal(
    JSON.stringify(catalog.records).includes("media.giphy.com"),
    false,
  );
});

test("featured code and cached content obey provider security budgets", async () => {
  const catalog = await generatedCatalog();
  const artifactByPath = new Map(
    reviewedInventory.selectedArtifacts.map((item) => [item.path, item]),
  );
  const forbidden = /\.(?:onnx|pfx|p12|pem|key|zip|7z|nupkg)$/iu;
  for (const artifact of reviewedInventory.selectedArtifacts) {
    assert.doesNotMatch(artifact.path, forbidden);
    assert.ok(artifact.path.startsWith("Samples/"));
  }

  for (const record of catalog.records) {
    assert.ok(
      record.featuredSourceFiles.length <=
        contentGuards.maxFeaturedFilesPerRecord,
    );
    let total = record.images.reduce((sum, image) => sum + image.size, 0);
    for (const file of record.featuredSourceFiles) {
      assertSafePosixPath(file.path);
      if (file.size !== null) {
        assert.ok(file.size <= contentGuards.maxFeaturedFileBytes);
        assert.equal(file.size, artifactByPath.get(file.path).size);
        total += file.size;
      }
    }
    assert.ok(total <= contentGuards.maxRecordBytes);
    assertSafePosixPath(record.source.path);
    for (const unit of nestedUnits(record)) {
      for (const sourcePath of unit.sourcePaths) {
        assertSafePosixPath(sourcePath);
      }
    }
  }
});

test("record keys and routes are immutable across editorial changes", async () => {
  const catalog = await generatedCatalog();
  for (const record of catalog.records) {
    assert.equal(
      record.route.slug,
      createRouteSlug(providerId, record.recordKey),
    );
    assert.equal(record.route.path, `samples/${record.route.slug}`);
    assert.deepEqual(record.route.previousPaths, []);
  }
  const activation = recordByKey(catalog, "app-lifecycle/activation");
  const editedTitle = {
    ...activation,
    title: {
      ...activation.title,
      display: "Editorial title does not define identity",
    },
  };
  assert.equal(
    createRouteSlug(providerId, activation.recordKey),
    createRouteSlug(providerId, editedTitle.recordKey),
  );
});

test("offline generation is cache-backed, deterministic, and network-free", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => {
    throw new Error("normal generation cannot use the network");
  };
  try {
    const first = await generateExternalCatalog({
      state: await enabledState(),
    });
    const second = await generateExternalCatalog({
      state: await enabledState(),
    });
    assert.equal(canonicalStringify(first), canonicalStringify(second));
    assert.equal(first.contentHash, second.contentHash);
  } finally {
    globalThis.fetch = originalFetch;
  }

  const coldRoot = await mkdtemp(
    path.join(tmpdir(), "windows-app-sdk-samples-cold-"),
  );
  try {
    await assert.rejects(
      generateExternalCatalog({
        state: await enabledState(),
        repoRoot: coldRoot,
      }),
      /unavailable offline/,
    );
  } finally {
    await rm(coldRoot, { recursive: true, force: true });
  }
});

test("migration notes are absent and no family is marked archived or deprecated", async () => {
  const catalog = await generatedCatalog();
  for (const record of catalog.records) {
    assert.equal(record.lifecycle.status, "active");
    assert.deepEqual(record.badges.upstreamEditorial, []);
    assert.equal(record.tags.includes("deprecated"), false);
    assert.equal(record.tags.includes("archived"), false);
  }
  assert.doesNotMatch(JSON.stringify(catalog.records), /migration notes?/iu);
});
