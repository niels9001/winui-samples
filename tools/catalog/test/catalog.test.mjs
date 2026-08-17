import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { stringify as stringifyYaml } from "yaml";

import {
  buildCatalog,
  serializeCatalog,
  validateCatalog,
  writeCatalog,
} from "../lib/catalog.mjs";

async function createFixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), "winui-sample-catalog-"));
  await mkdir(path.join(root, "Samples"), { recursive: true });
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

function validMetadata(folder, id = folder.toLowerCase()) {
  return {
    $schema: "../../metadata/schema/v1/sample.schema.json",
    schemaVersion: 1,
    id,
    project: {
      folder,
      name: folder,
    },
    title: "Building a focused Windows experience",
    summary:
      "Build a focused Windows experience with one representative implementation.",
    aliases: [folder, "Windows.Example.Api"],
    icon: "AppsRegular",
    categories: {
      primary: "app-fundamentals",
      secondary: ["files-and-data"],
    },
    tags: ["example", "Windows"],
    originalSamples: [
      {
        name: folder,
        url: `https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/${folder}`,
      },
    ],
    scenarios: [
      {
        id: "show-result",
        title: "Show the result",
        apis: ["Windows.Example.Api"],
        sourceFiles: ["Scenarios/Scenario1.xaml.cs"],
      },
    ],
    apis: [
      {
        name: "Windows.Example.Api",
        url: "https://learn.microsoft.com/uwp/api/windows.example.api",
      },
    ],
    documentation: [
      {
        title: "Build Windows apps",
        url: "https://learn.microsoft.com/windows/apps/",
        kind: "learn",
      },
    ],
    requirements: {
      minimumWindowsVersion: "10.0.17763.0",
      supportedArchitectures: ["arm64", "x64", "x86"],
      capabilities: [],
      hardware: [],
      accountServices: [],
      architectureNotes: "The fixture has no architecture-specific behavior.",
    },
    featuredFiles: [
      {
        path: "Scenarios/Scenario1.xaml.cs",
        label: "Representative implementation",
      },
    ],
    relatedSamples: [],
    screenshots: [
      {
        id: "result",
        alt: "The fixture app displaying its representative result.",
        scenario: "show-result",
        capture: {
          mode: "automatic",
          readinessSelector: "AutomationId=Result",
        },
      },
    ],
  };
}

async function addProject(root, folder, metadata = validMetadata(folder)) {
  const projectDirectory = path.join(root, "Samples", folder);
  await mkdir(path.join(projectDirectory, "Scenarios"), { recursive: true });
  await writeFile(
    path.join(projectDirectory, `${folder}.csproj`),
    "<Project />\n",
    "utf8",
  );
  await writeFile(
    path.join(projectDirectory, "Scenarios", "Scenario1.xaml.cs"),
    "namespace Fixture;\n",
    "utf8",
  );
  if (metadata !== null) {
    await writeFile(
      path.join(projectDirectory, "sample.yml"),
      stringifyYaml(metadata),
      "utf8",
    );
  }
}

test("accepts valid metadata", async (t) => {
  const root = await createFixture(t);
  await addProject(root, "Alpha");

  const result = await validateCatalog({ repoRoot: root });

  assert.deepEqual(result.errors, []);
  assert.equal(result.coverage.totalProjects, 1);
  assert.equal(result.coverage.validSamples, 1);
});

test("reports malformed metadata", async (t) => {
  const root = await createFixture(t);
  const metadata = validMetadata("Alpha");
  delete metadata.title;
  await addProject(root, "Alpha", metadata);

  const result = await validateCatalog({ repoRoot: root });

  assert.ok(
    result.errors.some((error) =>
      error.message.includes("must have required property 'title'"),
    ),
  );
});

test("rejects duplicate sample ids", async (t) => {
  const root = await createFixture(t);
  await addProject(root, "Alpha", validMetadata("Alpha", "shared-id"));
  await addProject(root, "Beta", validMetadata("Beta", "shared-id"));

  const result = await validateCatalog({ repoRoot: root });

  assert.ok(
    result.errors.some((error) =>
      error.message.includes("duplicate sample id shared-id"),
    ),
  );
  assert.equal(result.coverage.validSamples, 0);
});

test("rejects missing referenced files", async (t) => {
  const root = await createFixture(t);
  const metadata = validMetadata("Alpha");
  metadata.featuredFiles[0].path = "Scenarios/Missing.xaml.cs";
  await addProject(root, "Alpha", metadata);

  const result = await validateCatalog({ repoRoot: root });

  assert.ok(
    result.errors.some((error) =>
      error.message.includes("Scenarios/Missing.xaml.cs"),
    ),
  );
  assert.equal(result.coverage.validSamples, 0);
});

test("rejects project names that do not exactly match their folder", async (t) => {
  const root = await createFixture(t);
  const metadata = validMetadata("Alpha");
  metadata.project.name = "alpha";
  await addProject(root, "Alpha", metadata);

  const result = await validateCatalog({ repoRoot: root });

  assert.ok(
    result.errors.some((error) =>
      error.message.includes("project.name must exactly match Alpha"),
    ),
  );
});

test("rejects sample folders without their exact project file", async (t) => {
  const root = await createFixture(t);
  await addProject(root, "Alpha");
  await mkdir(path.join(root, "Samples", "MissingProject"));

  const result = await validateCatalog({ repoRoot: root });

  assert.ok(
    result.errors.some(
      (error) =>
        error.file === "Samples/MissingProject" &&
        error.message.includes("expected exactly MissingProject.csproj"),
    ),
  );
});

test("rejects non-HTTPS documentation URLs", async (t) => {
  const root = await createFixture(t);
  const metadata = validMetadata("Alpha");
  metadata.documentation[0].url = "http://learn.microsoft.com/windows/apps/";
  await addProject(root, "Alpha", metadata);

  const result = await validateCatalog({ repoRoot: root });

  assert.ok(
    result.errors.some(
      (error) =>
        error.message.includes("/documentation/0/url") ||
        error.message.includes("documentation[0].url"),
    ),
  );
});

test("enforces the Fluent icon export naming convention", async (t) => {
  const root = await createFixture(t);
  const metadata = validMetadata("Alpha");
  metadata.icon = "apps-regular";
  await addProject(root, "Alpha", metadata);

  const result = await validateCatalog({ repoRoot: root });

  assert.ok(
    result.errors.some(
      (error) =>
        error.message.includes("/icon") &&
        error.message.includes("must match pattern"),
    ),
  );
});

test("requires full inventory only in complete mode", async (t) => {
  const root = await createFixture(t);
  await addProject(root, "Alpha");
  await addProject(root, "Beta", null);

  const staged = await validateCatalog({ repoRoot: root });
  const complete = await validateCatalog({
    repoRoot: root,
    requireComplete: true,
  });

  assert.deepEqual(staged.errors, []);
  assert.ok(
    complete.errors.some((error) =>
      error.message.includes("missing 1: Beta"),
    ),
  );
});

test("generates byte-identical, deterministically ordered JSON", async (t) => {
  const root = await createFixture(t);
  await addProject(root, "Zulu", validMetadata("Zulu", "zulu"));
  await addProject(root, "Alpha", validMetadata("Alpha", "alpha"));

  const validation = await validateCatalog({ repoRoot: root });
  assert.deepEqual(validation.errors, []);

  const first = serializeCatalog(buildCatalog(validation));
  validation.samples.reverse();
  validation.taxonomy.categories.reverse();
  const second = serializeCatalog(buildCatalog(validation));
  assert.equal(second, first);

  const firstOutput = path.join(root, "first.json");
  const secondOutput = path.join(root, "second.json");
  await writeCatalog(firstOutput, buildCatalog(validation));
  await writeCatalog(secondOutput, buildCatalog(validation));
  assert.equal(
    await readFile(secondOutput, "utf8"),
    await readFile(firstOutput, "utf8"),
  );

  const parsed = JSON.parse(first);
  assert.deepEqual(
    parsed.samples.map((sample) => sample.id),
    ["alpha", "zulu"],
  );
});
