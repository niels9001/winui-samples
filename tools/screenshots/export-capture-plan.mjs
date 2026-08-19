#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  formatDiagnostic,
  repositoryRoot,
  validateCatalog,
} from "../catalog/lib/catalog.mjs";

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));

export function buildCapturePlan(validation, repoRoot = repositoryRoot) {
  return {
    planVersion: 1,
    sampleSchemaVersion: 1,
    repositoryRoot: path.resolve(repoRoot),
    coverage: validation.coverage,
    samples: validation.samples
      .filter((sample) => sample.valid)
      .map((sample) => {
        const entry = sample.data;
        return {
          id: entry.id,
          project: {
            folder: entry.project.folder,
            name: entry.project.name,
          },
          requirements: {
            minimumWindowsVersion: entry.requirements.minimumWindowsVersion,
            supportedArchitectures: entry.requirements.supportedArchitectures,
            hardware: entry.requirements.hardware,
            accountServices: entry.requirements.accountServices,
          },
          scenarios: entry.scenarios.map((scenario) => ({
            id: scenario.id,
            title: scenario.title,
          })),
          screenshots: entry.screenshots.map((screenshot) => ({
            id: screenshot.id,
            alt: screenshot.alt,
            scenario: screenshot.scenario,
            capture: {
              mode: screenshot.capture.mode,
              readinessSelector: screenshot.capture.readinessSelector,
              ...(screenshot.capture.actions === undefined
                ? {}
                : { actions: screenshot.capture.actions }),
              ...(screenshot.capture.notes === undefined
                ? {}
                : { notes: screenshot.capture.notes }),
            },
          })),
        };
      }),
  };
}

export async function discoverCapturePlan(repoRoot = repositoryRoot) {
  const validation = await validateCatalog({ repoRoot });
  if (validation.errors.length > 0) {
    const details = validation.errors.map(formatDiagnostic).join("\n");
    throw new Error(`sample metadata validation failed:\n${details}`);
  }

  return buildCapturePlan(validation, repoRoot);
}

function parseArguments(arguments_) {
  let output;
  let repoRoot = repositoryRoot;

  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === "--output") {
      output = arguments_[index + 1];
      if (!output) {
        throw new Error("--output requires a path");
      }
      index += 1;
    } else if (argument === "--repo-root") {
      repoRoot = arguments_[index + 1];
      if (!repoRoot) {
        throw new Error("--repo-root requires a path");
      }
      index += 1;
    } else if (argument === "--help" || argument === "-h") {
      console.log(
        "Usage: node tools/screenshots/export-capture-plan.mjs " +
          "--output <path> [--repo-root <path>]",
      );
      process.exit(0);
    } else {
      throw new Error(`unknown argument: ${argument}`);
    }
  }

  if (!output) {
    throw new Error("--output is required");
  }

  return {
    output: path.resolve(output),
    repoRoot: path.resolve(repoRoot),
  };
}

if (path.resolve(process.argv[1] ?? "") === path.resolve(fileURLToPath(import.meta.url))) {
  try {
    const options = parseArguments(process.argv.slice(2));
    const plan = await discoverCapturePlan(options.repoRoot);
    await mkdir(path.dirname(options.output), { recursive: true });
    await writeFile(options.output, `${JSON.stringify(plan, null, 2)}\n`, "utf8");
  } catch (error) {
    console.error(`error: ${error.message}`);
    process.exitCode = 1;
  }
}
