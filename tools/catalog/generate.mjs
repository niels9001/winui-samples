#!/usr/bin/env node

import path from "node:path";

import {
  buildCatalog,
  defaultCatalogOutput,
  formatCoverage,
  formatDiagnostic,
  validateCatalog,
  writeCatalog,
} from "./lib/catalog.mjs";

function parseArguments(arguments_) {
  let output = defaultCatalogOutput;
  let requireComplete = false;

  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];

    if (argument === "--") {
      continue;
    } else if (argument === "--require-complete") {
      requireComplete = true;
    } else if (argument === "--output") {
      const value = arguments_[index + 1];
      if (!value) {
        throw new Error("--output requires a path");
      }
      output = path.resolve(value);
      index += 1;
    } else if (argument.startsWith("--output=")) {
      output = path.resolve(argument.slice("--output=".length));
    } else if (argument === "--help" || argument === "-h") {
      console.log(
        "Usage: pnpm catalog:generate [-- --output <path>] [--require-complete]\n\n" +
          `Default output: ${defaultCatalogOutput}`,
      );
      process.exit(0);
    } else {
      throw new Error(`unknown argument: ${argument}`);
    }
  }

  return { output, requireComplete };
}

try {
  const { output, requireComplete } = parseArguments(process.argv.slice(2));
  const validation = await validateCatalog({ requireComplete });

  for (const warning of validation.warnings) {
    console.warn(`warning: ${formatDiagnostic(warning)}`);
  }
  if (validation.errors.length > 0) {
    for (const error of validation.errors) {
      console.error(`error: ${formatDiagnostic(error)}`);
    }
    process.exitCode = 1;
  } else {
    const catalog = buildCatalog(validation);
    await writeCatalog(output, catalog);
    console.log(`Generated ${output}`);
    console.log(`Metadata coverage: ${formatCoverage(validation.coverage)}`);
  }
} catch (error) {
  console.error(`error: ${error.message}`);
  process.exitCode = 1;
}
