#!/usr/bin/env node

import path from "node:path";

import {
  defaultExternalCatalogOutput,
  generateAndWriteExternalCatalog,
} from "./lib/generate.mjs";

function parseArguments(arguments_) {
  let outputPath = defaultExternalCatalogOutput;
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === "--") {
      continue;
    }
    if (argument === "--output") {
      const value = arguments_[index + 1];
      if (!value) {
        throw new Error("--output requires a path");
      }
      outputPath = path.resolve(value);
      index += 1;
    } else if (argument.startsWith("--output=")) {
      outputPath = path.resolve(argument.slice("--output=".length));
    } else if (argument === "--help" || argument === "-h") {
      console.log(
        "Usage: pnpm external:generate [-- --output <path>]\n\n" +
          "Generates only from committed locks/cache/history. It never calls the network.",
      );
      process.exit(0);
    } else {
      throw new Error(`unknown argument: ${argument}`);
    }
  }
  return { outputPath };
}

try {
  const { outputPath } = parseArguments(process.argv.slice(2));
  const catalog = await generateAndWriteExternalCatalog({ outputPath });
  console.log(
    `Generated ${outputPath}: ${catalog.providers.length} enabled providers, ${catalog.records.length} records.`,
  );
} catch (error) {
  console.error(`error: ${error.message}`);
  process.exitCode = 1;
}
