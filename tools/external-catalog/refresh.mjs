#!/usr/bin/env node

import { lstat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { loadExternalState } from "./lib/config.mjs";
import { assertSafePosixPath } from "./lib/guards.mjs";
import { createGitHubClient } from "./lib/network.mjs";
import { repositoryRoot } from "./lib/schema.mjs";

function parseArguments(arguments_) {
  let providerId;
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === "--") {
      continue;
    }
    if (argument === "--provider") {
      providerId = arguments_[index + 1];
      if (!providerId) {
        throw new Error("--provider requires an id");
      }
      index += 1;
    } else if (argument.startsWith("--provider=")) {
      providerId = argument.slice("--provider=".length);
    } else if (argument === "--help" || argument === "-h") {
      console.log(
        "Usage: pnpm external:refresh -- --provider <id>\n\n" +
          "Explicit network command. Provider refresh modules must stage reviewed lock/cache/history changes; normal generation is offline-only.",
      );
      process.exit(0);
    } else {
      throw new Error(`unknown argument: ${argument}`);
    }
  }
  if (!providerId) {
    throw new Error("--provider is required");
  }
  return { providerId };
}

try {
  const { providerId } = parseArguments(process.argv.slice(2));
  const state = await loadExternalState();
  const provider = state.providers.get(providerId);
  if (!provider) {
    throw new Error(`unknown provider: ${providerId}`);
  }
  assertSafePosixPath(provider.refreshModule);
  const modulePath = path.resolve(
    repositoryRoot,
    ...provider.refreshModule.split("/"),
  );
  const relative = path.relative(repositoryRoot, modulePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`${provider.id}: refresh module escapes repository root`);
  }
  const entry = await lstat(modulePath);
  if (!entry.isFile() || entry.isSymbolicLink()) {
    throw new Error(`${provider.id}: refresh module must be a regular file`);
  }
  const module = await import(pathToFileURL(modulePath).href);
  if (typeof module.refresh !== "function") {
    throw new Error(`${provider.id}: refresh module must export refresh(context)`);
  }

  await module.refresh({
    provider,
    state,
    repositoryRoot,
    github: createGitHubClient(),
  });
} catch (error) {
  console.error(`error: ${error.message}`);
  process.exitCode = 1;
}
