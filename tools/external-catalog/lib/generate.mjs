import {
  lstat,
  readFile,
  realpath,
} from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  init as initializeModuleLexer,
  parse as parseModuleImports,
} from "es-module-lexer";

import {
  atomicWriteCanonicalJson,
} from "./canonical.mjs";
import {
  createArtifactReader,
  validateEnabledCache,
} from "./cache.mjs";
import {
  loadExternalState,
} from "./config.mjs";
import {
  createRouteSlug,
} from "./identity.mjs";
import { mergeProviderOutputs } from "./merge.mjs";
import { repositoryRoot } from "./schema.mjs";
import {
  assertOfflineAdapterSource,
  assertSafePosixPath,
} from "./guards.mjs";

export const defaultExternalCatalogOutput = path.join(
  repositoryRoot,
  "external",
  "generated",
  "catalog.json",
);

function deepFreeze(value, seen = new WeakSet()) {
  if (
    value === null ||
    typeof value !== "object" ||
    seen.has(value)
  ) {
    return value;
  }
  seen.add(value);
  for (const item of Object.values(value)) {
    deepFreeze(item, seen);
  }
  return Object.freeze(value);
}

function isPathInside(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
}

async function staticModuleSpecifiers(source, context) {
  await initializeModuleLexer;
  let imports;
  try {
    [imports] = parseModuleImports(source);
  } catch (error) {
    throw new Error(
      `cannot parse provider adapter module ${context}: ${error.message}`,
    );
  }

  return imports.map((entry) => {
    if (entry.d >= 0 || typeof entry.n !== "string") {
      throw new Error(
        `provider adapter imports must be static string literals: ${context}`,
      );
    }
    return entry.n;
  });
}

export async function validateOfflineAdapterGraph(entryPath) {
  const adapterRoot = path.dirname(entryPath);
  const realAdapterRoot = await realpath(adapterRoot);
  const visited = new Set();

  async function visit(modulePath) {
    const resolved = path.resolve(modulePath);
    if (visited.has(resolved)) {
      return;
    }
    if (!isPathInside(adapterRoot, resolved)) {
      throw new Error(
        `provider adapter import escapes its owned directory: ${resolved}`,
      );
    }
    if (path.extname(resolved) !== ".mjs") {
      throw new Error(`provider adapter modules must use .mjs: ${resolved}`);
    }

    const entry = await lstat(resolved);
    if (!entry.isFile() || entry.isSymbolicLink()) {
      throw new Error(
        `provider adapter graph must contain regular non-symbolic-link files: ${resolved}`,
      );
    }
    const realResolved = await realpath(resolved);
    if (!isPathInside(realAdapterRoot, realResolved)) {
      throw new Error(
        `provider adapter import resolves outside its owned directory: ${resolved}`,
      );
    }
    const source = await readFile(resolved, "utf8");
    assertOfflineAdapterSource(source, resolved);
    visited.add(resolved);

    for (const specifier of await staticModuleSpecifiers(source, resolved)) {
      if (!specifier.startsWith(".")) {
        throw new Error(
          `provider adapters may import only provider-owned relative modules: ${specifier}`,
        );
      }
      const importedPath = path.resolve(path.dirname(resolved), specifier);
      await visit(importedPath);
    }
  }

  await visit(entryPath);
}

async function withOfflineGlobals(action) {
  const names = ["EventSource", "WebSocket", "XMLHttpRequest", "fetch"];
  const descriptors = new Map();
  const deny = () => {
    throw new Error("provider adapters cannot use network APIs during generation");
  };

  for (const name of names) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, name);
    descriptors.set(name, descriptor);
    if (descriptor && !descriptor.configurable) {
      if (!descriptor.writable) {
        throw new Error(`cannot secure non-configurable global ${name}`);
      }
      globalThis[name] = deny;
    } else {
      Object.defineProperty(globalThis, name, {
        configurable: true,
        enumerable: descriptor?.enumerable ?? false,
        value: deny,
        writable: false,
      });
    }
  }

  try {
    return await action();
  } finally {
    for (const [name, descriptor] of descriptors) {
      if (descriptor) {
        Object.defineProperty(globalThis, name, descriptor);
      } else {
        delete globalThis[name];
      }
    }
  }
}

async function defaultAdapterLoader(provider, repoRoot) {
  assertSafePosixPath(provider.adapterModule);
  const modulePath = path.resolve(
    repoRoot,
    ...provider.adapterModule.split("/"),
  );
  const relative = path.relative(repoRoot, modulePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`${provider.id}: adapter module escapes repository root`);
  }
  const [realRepoRoot, realModulePath] = await Promise.all([
    realpath(repoRoot),
    realpath(modulePath),
  ]).catch((error) => {
    throw new Error(
      `${provider.id}: cannot resolve adapter module ${provider.adapterModule}: ${error.message}`,
    );
  });
  if (!isPathInside(realRepoRoot, realModulePath)) {
    throw new Error(`${provider.id}: adapter module resolves outside repository root`);
  }

  try {
    await validateOfflineAdapterGraph(modulePath);
  } catch (error) {
    throw new Error(
      `${provider.id}: enabled provider adapter graph is invalid at ${provider.adapterModule}: ${error.message}`,
    );
  }
  const module = await withOfflineGlobals(() =>
    import(pathToFileURL(modulePath).href),
  );
  if (typeof module.generate !== "function") {
    throw new Error(`${provider.id}: adapter must export generate(context)`);
  }
  return {
    generate: (context) =>
      withOfflineGlobals(() => module.generate(context)),
  };
}

export async function generateExternalCatalog({
  state,
  repoRoot = repositoryRoot,
  adapterLoader = defaultAdapterLoader,
} = {}) {
  const externalState = state ?? (await loadExternalState());
  await validateEnabledCache(externalState, { repoRoot });

  const outputs = [];
  for (const provider of externalState.providers.values()) {
    if (!provider.enabled) {
      continue;
    }
    const lock = externalState.locks.get(provider.id);
    const history = externalState.histories.get(provider.id);
    if (!lock || !history) {
      throw new Error(`${provider.id}: enabled provider state is incomplete`);
    }
    const adapter = await adapterLoader(provider, repoRoot);
    const providerContext = deepFreeze(structuredClone(provider));
    const lockContext = deepFreeze(structuredClone(lock));
    const historyContext = deepFreeze(
      structuredClone(history),
    );
    const output = await adapter.generate({
      provider: providerContext,
      lock: lockContext,
      history: historyContext,
      readArtifact: createArtifactReader(externalState, lock, { repoRoot }),
      createRouteSlug,
    });
    outputs.push(output);
  }
  return mergeProviderOutputs(externalState, outputs);
}

export async function generateAndWriteExternalCatalog({
  outputPath = defaultExternalCatalogOutput,
  ...options
} = {}) {
  const catalog = await generateExternalCatalog(options);
  await atomicWriteCanonicalJson(outputPath, catalog);
  return catalog;
}
