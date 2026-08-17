import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";
import { parse as parseYaml } from "yaml";

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));

export const repositoryRoot = path.resolve(moduleDirectory, "..", "..", "..");
export const defaultCatalogOutput = path.join(
  repositoryRoot,
  "site",
  "src",
  "generated",
  "sample-catalog.json",
);

export const fluentIconPattern = /^[A-Z][A-Za-z0-9]*(Regular|Filled)$/;

function compareText(left, right) {
  const normalizedLeft = left.toLowerCase();
  const normalizedRight = right.toLowerCase();

  if (normalizedLeft !== normalizedRight) {
    return normalizedLeft < normalizedRight ? -1 : 1;
  }

  return left === right ? 0 : left < right ? -1 : 1;
}

function toRepositoryPath(value) {
  return value.split(path.sep).join("/");
}

function diagnostic(file, message) {
  return { file: toRepositoryPath(file), message };
}

async function readYaml(filePath) {
  const source = await readFile(filePath, "utf8");
  return parseYaml(source, { prettyErrors: true, uniqueKeys: true });
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function discoverSampleFolders(repoRoot) {
  const samplesRoot = path.join(repoRoot, "Samples");
  const entries = await readdir(samplesRoot, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      folder: entry.name,
      directory: path.join(samplesRoot, entry.name),
    }))
    .sort((left, right) => compareText(left.folder, right.folder));
}

export async function discoverProjects(repoRoot = repositoryRoot) {
  const folders = await discoverSampleFolders(repoRoot);
  const projects = [];
  const errors = [];

  for (const folder of folders) {
    const entries = await readdir(folder.directory, { withFileTypes: true });
    const projectFiles = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".csproj"))
      .map((entry) => entry.name)
      .sort(compareText);

    const expectedProjectFile = `${folder.folder}.csproj`;
    if (projectFiles.length !== 1 || projectFiles[0] !== expectedProjectFile) {
      errors.push(
        diagnostic(
          path.relative(repoRoot, folder.directory),
          `expected exactly ${expectedProjectFile}; found ${projectFiles.join(", ") || "no project file"}`,
        ),
      );
      continue;
    }

    projects.push({
      ...folder,
      projectName: folder.folder,
      projectFile: projectFiles[0],
      metadataFile: path.join(folder.directory, "sample.yml"),
    });
  }

  return { projects, errors };
}

function validateTaxonomy(taxonomy, taxonomyFile, errors) {
  if (
    taxonomy === null ||
    typeof taxonomy !== "object" ||
    Array.isArray(taxonomy)
  ) {
    errors.push(diagnostic(taxonomyFile, "taxonomy must be an object"));
    return new Map();
  }

  if (taxonomy.schemaVersion !== 1) {
    errors.push(diagnostic(taxonomyFile, "schemaVersion must be 1"));
  }

  if (!Array.isArray(taxonomy.categories) || taxonomy.categories.length === 0) {
    errors.push(diagnostic(taxonomyFile, "categories must be a non-empty array"));
    return new Map();
  }

  const categories = new Map();
  for (const [index, category] of taxonomy.categories.entries()) {
    const location = `categories[${index}]`;
    if (
      category === null ||
      typeof category !== "object" ||
      Array.isArray(category)
    ) {
      errors.push(diagnostic(taxonomyFile, `${location} must be an object`));
      continue;
    }

    const allowedKeys = new Set(["id", "label", "description", "icon"]);
    for (const key of Object.keys(category)) {
      if (!allowedKeys.has(key)) {
        errors.push(
          diagnostic(taxonomyFile, `${location} has unknown property ${key}`),
        );
      }
    }

    if (
      typeof category.id !== "string" ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(category.id)
    ) {
      errors.push(diagnostic(taxonomyFile, `${location}.id must be a slug`));
      continue;
    }

    if (categories.has(category.id)) {
      errors.push(
        diagnostic(taxonomyFile, `duplicate category id ${category.id}`),
      );
    }

    for (const key of ["label", "description"]) {
      if (typeof category[key] !== "string" || category[key].trim() === "") {
        errors.push(
          diagnostic(taxonomyFile, `${location}.${key} must be non-empty`),
        );
      }
    }

    if (
      typeof category.icon !== "string" ||
      !fluentIconPattern.test(category.icon)
    ) {
      errors.push(
        diagnostic(
          taxonomyFile,
          `${location}.icon must be a PascalCase Fluent export ending in Regular or Filled`,
        ),
      );
    }

    categories.set(category.id, category);
  }

  return categories;
}

function isValidHttpsUrl(value) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname.length > 0 &&
      url.username === "" &&
      url.password === ""
    );
  } catch {
    return false;
  }
}

function validateUrl(value, file, field, errors) {
  if (!isValidHttpsUrl(value)) {
    errors.push(diagnostic(file, `${field} must be a valid HTTPS URL`));
  }
}

async function validateExactFile(sampleDirectory, relativePath) {
  if (
    typeof relativePath !== "string" ||
    relativePath.includes("\\") ||
    path.posix.isAbsolute(relativePath) ||
    /^[A-Za-z]:/.test(relativePath)
  ) {
    return false;
  }

  const segments = relativePath.split("/");
  if (
    segments.length === 0 ||
    segments.some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    return false;
  }

  let current = sampleDirectory;
  for (const [index, segment] of segments.entries()) {
    const entries = await readdir(current, { withFileTypes: true });
    const exactEntry = entries.find((entry) => entry.name === segment);
    if (!exactEntry) {
      return false;
    }

    const isLast = index === segments.length - 1;
    if (isLast) {
      return exactEntry.isFile();
    }

    if (!exactEntry.isDirectory()) {
      return false;
    }

    current = path.join(current, segment);
  }

  return false;
}

async function validateSourcePath(
  sampleDirectory,
  relativePath,
  metadataFile,
  field,
  errors,
) {
  if (!(await validateExactFile(sampleDirectory, relativePath))) {
    errors.push(
      diagnostic(
        metadataFile,
        `${field} must reference an existing, case-exact file relative to the sample folder: ${relativePath}`,
      ),
    );
  }
}

function duplicateValues(values) {
  const seen = new Set();
  const duplicates = new Set();

  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
    }
    seen.add(value);
  }

  return [...duplicates].sort(compareText);
}

async function validateSampleDetails(
  entry,
  project,
  categoryMap,
  metadataFile,
  errors,
  warnings,
) {
  if (entry.project.folder !== project.folder) {
    errors.push(
      diagnostic(
        metadataFile,
        `project.folder must exactly match ${project.folder}`,
      ),
    );
  }

  if (entry.project.name !== project.projectName) {
    errors.push(
      diagnostic(
        metadataFile,
        `project.name must exactly match ${project.projectName}`,
      ),
    );
  }

  const titleWords = entry.title.trim().split(/\s+/);
  if (titleWords.length < 4 || titleWords.length > 12) {
    warnings.push(
      diagnostic(metadataFile, "title should usually contain 4-12 words"),
    );
  }
  if (entry.title.endsWith(".")) {
    errors.push(diagnostic(metadataFile, "title must not end with a period"));
  }
  if (!/^[A-Z0-9]/.test(entry.title)) {
    errors.push(diagnostic(metadataFile, "title must use sentence case"));
  }
  if (/\bsample\b/i.test(entry.title)) {
    errors.push(
      diagnostic(metadataFile, "title must not use generic 'sample' wording"),
    );
  }

  const categoryIds = [
    entry.categories.primary,
    ...entry.categories.secondary,
  ];
  for (const categoryId of categoryIds) {
    if (!categoryMap.has(categoryId)) {
      errors.push(
        diagnostic(metadataFile, `unknown category id ${categoryId}`),
      );
    }
  }
  if (entry.categories.secondary.includes(entry.categories.primary)) {
    errors.push(
      diagnostic(
        metadataFile,
        "primary category must not also appear in secondary categories",
      ),
    );
  }

  for (const [index, original] of entry.originalSamples.entries()) {
    validateUrl(
      original.url,
      metadataFile,
      `originalSamples[${index}].url`,
      errors,
    );
  }
  for (const [index, api] of entry.apis.entries()) {
    if (api.url !== undefined) {
      validateUrl(api.url, metadataFile, `apis[${index}].url`, errors);
    }
  }
  for (const [index, document] of entry.documentation.entries()) {
    validateUrl(
      document.url,
      metadataFile,
      `documentation[${index}].url`,
      errors,
    );
  }

  const scenarioIds = entry.scenarios.map((scenario) => scenario.id);
  for (const duplicate of duplicateValues(scenarioIds)) {
    errors.push(diagnostic(metadataFile, `duplicate scenario id ${duplicate}`));
  }

  for (const [scenarioIndex, scenario] of entry.scenarios.entries()) {
    for (const [fileIndex, sourceFile] of (
      scenario.sourceFiles ?? []
    ).entries()) {
      await validateSourcePath(
        project.directory,
        sourceFile,
        metadataFile,
        `scenarios[${scenarioIndex}].sourceFiles[${fileIndex}]`,
        errors,
      );
    }
  }

  for (const [index, featuredFile] of entry.featuredFiles.entries()) {
    await validateSourcePath(
      project.directory,
      featuredFile.path,
      metadataFile,
      `featuredFiles[${index}].path`,
      errors,
    );
  }

  const screenshotIds = entry.screenshots.map((screenshot) => screenshot.id);
  for (const duplicate of duplicateValues(screenshotIds)) {
    errors.push(
      diagnostic(metadataFile, `duplicate screenshot id ${duplicate}`),
    );
  }

  const scenarioIdSet = new Set(scenarioIds);
  for (const [index, screenshot] of entry.screenshots.entries()) {
    if (!scenarioIdSet.has(screenshot.scenario)) {
      errors.push(
        diagnostic(
          metadataFile,
          `screenshots[${index}].scenario references unknown scenario ${screenshot.scenario}`,
        ),
      );
    }

    if (/^screenshot\b/i.test(screenshot.alt.trim())) {
      warnings.push(
        diagnostic(
          metadataFile,
          `screenshots[${index}].alt should describe the UI rather than start with "screenshot"`,
        ),
      );
    }
  }
}

export async function validateCatalog({
  repoRoot = repositoryRoot,
  requireComplete = false,
  schemaFile = path.join(
    repositoryRoot,
    "metadata",
    "schema",
    "v1",
    "sample.schema.json",
  ),
  taxonomyFile = path.join(repositoryRoot, "metadata", "taxonomy.yml"),
} = {}) {
  const errors = [];
  const warnings = [];

  const { projects, errors: inventoryErrors } = await discoverProjects(repoRoot);
  errors.push(...inventoryErrors);
  const projectFolders = new Set(projects.map((project) => project.folder));
  for (const folder of await discoverSampleFolders(repoRoot)) {
    const metadataFile = path.join(folder.directory, "sample.yml");
    if (
      !projectFolders.has(folder.folder) &&
      (await fileExists(metadataFile))
    ) {
      errors.push(
        diagnostic(
          path.relative(repoRoot, metadataFile),
          "metadata must belong to a top-level project whose file exactly matches its folder name",
        ),
      );
    }
  }

  let schema;
  let taxonomy;
  try {
    schema = JSON.parse(await readFile(schemaFile, "utf8"));
  } catch (error) {
    errors.push(diagnostic(schemaFile, `cannot load schema: ${error.message}`));
  }
  try {
    taxonomy = await readYaml(taxonomyFile);
  } catch (error) {
    errors.push(
      diagnostic(taxonomyFile, `cannot load taxonomy: ${error.message}`),
    );
  }

  const categoryMap = validateTaxonomy(taxonomy, taxonomyFile, errors);
  let validateSchema;
  if (schema) {
    try {
      const ajv = new Ajv2020({
        allErrors: true,
        strict: true,
      });
      validateSchema = ajv.compile(schema);
    } catch (error) {
      errors.push(diagnostic(schemaFile, `cannot compile schema: ${error.message}`));
    }
  }

  const samples = [];
  const metadataProjects = [];

  for (const project of projects) {
    if (!(await fileExists(project.metadataFile))) {
      continue;
    }

    metadataProjects.push(project.folder);
    let entry;
    try {
      entry = await readYaml(project.metadataFile);
    } catch (error) {
      errors.push(
        diagnostic(
          path.relative(repoRoot, project.metadataFile),
          `cannot parse YAML: ${error.message}`,
        ),
      );
      continue;
    }

    const metadataFile = path.relative(repoRoot, project.metadataFile);
    if (!validateSchema || !validateSchema(entry)) {
      for (const schemaError of validateSchema?.errors ?? []) {
        const location = schemaError.instancePath || "/";
        errors.push(
          diagnostic(
            metadataFile,
            `${location} ${schemaError.message}`.trim(),
          ),
        );
      }
      continue;
    }

    const sampleErrorCount = errors.length;
    await validateSampleDetails(
      entry,
      project,
      categoryMap,
      metadataFile,
      errors,
      warnings,
    );

    samples.push({
      data: entry,
      directory: project.directory,
      metadataFile,
      valid: errors.length === sampleErrorCount,
    });
  }

  const allIds = samples.map((sample) => sample.data.id);
  for (const duplicate of duplicateValues(allIds)) {
    const duplicateSamples = samples.filter(
      (sample) => sample.data.id === duplicate,
    );
    for (const sample of duplicateSamples) {
      sample.valid = false;
    }
    const owners = duplicateSamples
      .map((sample) => sample.metadataFile)
      .join(", ");
    errors.push(
      diagnostic("Samples", `duplicate sample id ${duplicate}: ${owners}`),
    );
  }

  const knownIds = new Set(allIds);
  for (const sample of samples) {
    for (const relatedId of sample.data.relatedSamples ?? []) {
      if (relatedId === sample.data.id) {
        sample.valid = false;
        errors.push(
          diagnostic(
            sample.metadataFile,
            `relatedSamples must not reference its own id ${relatedId}`,
          ),
        );
      } else if (!knownIds.has(relatedId)) {
        const unresolved = diagnostic(
          sample.metadataFile,
          `related sample id ${relatedId} is not present in current metadata`,
        );
        if (requireComplete) {
          sample.valid = false;
          errors.push(unresolved);
        } else {
          warnings.push(unresolved);
        }
      }
    }
  }

  const metadataProjectSet = new Set(metadataProjects);
  const missingProjects = projects
    .filter((project) => !metadataProjectSet.has(project.folder))
    .map((project) => project.folder)
    .sort(compareText);

  if (requireComplete && missingProjects.length > 0) {
    errors.push(
      diagnostic(
        "Samples",
        `metadata is required for every project; missing ${missingProjects.length}: ${missingProjects.join(", ")}`,
      ),
    );
  }

  const totalProjects = projects.length;
  const metadataFiles = metadataProjects.length;
  const coveragePercent =
    totalProjects === 0
      ? 100
      : Number(((metadataFiles / totalProjects) * 100).toFixed(2));

  return {
    errors,
    warnings,
    samples,
    taxonomy,
    coverage: {
      totalProjects,
      metadataFiles,
      validSamples: samples.filter((sample) => sample.valid).length,
      coveragePercent,
      missingProjects,
    },
  };
}

function sortedStrings(values) {
  return [...values].sort(compareText);
}

function normalizeSample(sample) {
  const entry = sample.data;
  const architectureOrder = new Map([
    ["x86", 0],
    ["x64", 1],
    ["arm64", 2],
  ]);

  return {
    schemaVersion: entry.schemaVersion,
    id: entry.id,
    project: {
      folder: entry.project.folder,
      name: entry.project.name,
      repositoryPath: `Samples/${entry.project.folder}`,
    },
    title: entry.title,
    summary: entry.summary,
    aliases: sortedStrings(entry.aliases),
    icon: entry.icon,
    categories: {
      primary: entry.categories.primary,
      secondary: sortedStrings(entry.categories.secondary),
    },
    tags: sortedStrings(entry.tags),
    originalSamples: [...entry.originalSamples]
      .sort((left, right) => compareText(left.url, right.url))
      .map((original) => ({
        name: original.name,
        url: original.url,
      })),
    scenarios: entry.scenarios.map((scenario) => ({
      id: scenario.id,
      title: scenario.title,
      ...(scenario.summary === undefined
        ? {}
        : { summary: scenario.summary }),
      ...(scenario.apis === undefined
        ? {}
        : { apis: sortedStrings(scenario.apis) }),
      ...(scenario.sourceFiles === undefined
        ? {}
        : { sourceFiles: sortedStrings(scenario.sourceFiles) }),
    })),
    apis: [...entry.apis]
      .sort((left, right) => compareText(left.name, right.name))
      .map((api) => ({
        name: api.name,
        ...(api.description === undefined
          ? {}
          : { description: api.description }),
        ...(api.url === undefined ? {} : { url: api.url }),
      })),
    documentation: [...entry.documentation]
      .sort((left, right) => compareText(left.url, right.url))
      .map((document) => ({
        title: document.title,
        url: document.url,
        kind: document.kind,
      })),
    requirements: {
      minimumWindowsVersion: entry.requirements.minimumWindowsVersion,
      supportedArchitectures: [...entry.requirements.supportedArchitectures].sort(
        (left, right) =>
          architectureOrder.get(left) - architectureOrder.get(right),
      ),
      capabilities: [...entry.requirements.capabilities]
        .sort((left, right) => compareText(left.name, right.name))
        .map((capability) => ({
          name: capability.name,
          kind: capability.kind,
          description: capability.description,
        })),
      hardware: sortedStrings(entry.requirements.hardware),
      accountServices: sortedStrings(entry.requirements.accountServices),
      architectureNotes: entry.requirements.architectureNotes,
    },
    featuredFiles: [...entry.featuredFiles]
      .sort((left, right) => compareText(left.path, right.path))
      .map((file) => ({
        path: file.path,
        label: file.label,
        ...(file.description === undefined
          ? {}
          : { description: file.description }),
      })),
    relatedSamples: sortedStrings(entry.relatedSamples ?? []),
    screenshots: [...entry.screenshots]
      .sort((left, right) => compareText(left.id, right.id))
      .map((screenshot) => ({
        id: screenshot.id,
        alt: screenshot.alt,
        scenario: screenshot.scenario,
        capture: {
          mode: screenshot.capture.mode,
          readinessSelector: screenshot.capture.readinessSelector,
          ...(screenshot.capture.actions === undefined
            ? {}
            : {
                actions: screenshot.capture.actions.map((action) => ({
                  ...action,
                })),
              }),
          ...(screenshot.capture.notes === undefined
            ? {}
            : { notes: screenshot.capture.notes }),
        },
      })),
  };
}

export function buildCatalog(validation) {
  return {
    catalogVersion: 1,
    sampleSchemaVersion: 1,
    taxonomyVersion: validation.taxonomy.schemaVersion,
    coverage: {
      totalProjects: validation.coverage.totalProjects,
      metadataFiles: validation.coverage.metadataFiles,
      validSamples: validation.coverage.validSamples,
      coveragePercent: validation.coverage.coveragePercent,
      missingProjects: sortedStrings(validation.coverage.missingProjects),
    },
    categories: [...validation.taxonomy.categories]
      .sort((left, right) => compareText(left.id, right.id))
      .map((category) => ({
        id: category.id,
        label: category.label,
        description: category.description,
        icon: category.icon,
      })),
    samples: [...validation.samples]
      .sort((left, right) => compareText(left.data.id, right.data.id))
      .map(normalizeSample),
  };
}

export function serializeCatalog(catalog) {
  return `${JSON.stringify(catalog, null, 2)}\n`;
}

export async function writeCatalog(outputPath, catalog) {
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, serializeCatalog(catalog), "utf8");
}

export function formatCoverage(coverage) {
  return `${coverage.metadataFiles}/${coverage.totalProjects} projects (${coverage.coveragePercent}%), ${coverage.validSamples} valid`;
}

export function formatDiagnostic(entry) {
  return `${entry.file}: ${entry.message}`;
}
