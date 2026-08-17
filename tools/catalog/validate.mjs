#!/usr/bin/env node

import {
  formatCoverage,
  formatDiagnostic,
  validateCatalog,
} from "./lib/catalog.mjs";

function parseArguments(arguments_) {
  let requireComplete = false;

  for (const argument of arguments_) {
    if (argument === "--") {
      continue;
    } else if (argument === "--require-complete") {
      requireComplete = true;
    } else if (argument === "--help" || argument === "-h") {
      console.log(
        "Usage: pnpm catalog:validate [-- --require-complete]\n\n" +
          "Validates present sample.yml files. --require-complete also requires metadata for every project.",
      );
      process.exit(0);
    } else {
      throw new Error(`unknown argument: ${argument}`);
    }
  }

  return { requireComplete };
}

try {
  const options = parseArguments(process.argv.slice(2));
  const result = await validateCatalog(options);

  console.log(`Metadata coverage: ${formatCoverage(result.coverage)}`);
  if (result.coverage.missingProjects.length > 0) {
    console.log(`Missing metadata: ${result.coverage.missingProjects.join(", ")}`);
  }

  for (const warning of result.warnings) {
    console.warn(`warning: ${formatDiagnostic(warning)}`);
  }

  if (result.errors.length > 0) {
    for (const error of result.errors) {
      console.error(`error: ${formatDiagnostic(error)}`);
    }
    process.exitCode = 1;
  } else {
    console.log("Sample metadata is valid.");
  }
} catch (error) {
  console.error(`error: ${error.message}`);
  process.exitCode = 1;
}
