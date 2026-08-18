#!/usr/bin/env node

import { validateEnabledCache } from "./lib/cache.mjs";
import { loadExternalState } from "./lib/config.mjs";
import { repositoryRoot } from "./lib/schema.mjs";

try {
  const state = await loadExternalState();
  await validateEnabledCache(state, { repoRoot: repositoryRoot });
  const enabled = [...state.providers.values()].filter(
    (provider) => provider.enabled,
  );
  console.log(
    `Federated catalog contracts are valid: ${enabled.length} enabled providers, ${state.cacheManifest.entries.length} cached artifacts.`,
  );
} catch (error) {
  console.error(`error: ${error.message}`);
  process.exitCode = 1;
}
