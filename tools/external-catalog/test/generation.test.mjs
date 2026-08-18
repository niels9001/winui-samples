import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  rm,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { loadExternalState } from "../lib/config.mjs";
import {
  generateExternalCatalog,
  validateOfflineAdapterGraph,
} from "../lib/generate.mjs";
import {
  createEnabledGalleryState,
  loadRecordFixture,
} from "./fixtures.mjs";

test("provider-less generation is compatible and makes no network calls", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => {
    throw new Error("network must not be used");
  };
  try {
    const state = await loadExternalState();
    const catalog = await generateExternalCatalog({ state });
    assert.deepEqual(catalog.providers, []);
    assert.deepEqual(catalog.records, []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("enabled generation uses only valid cache and fails when cache is cold", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "external-generation-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const record = await loadRecordFixture("winui-gallery");
  const { state, output, payloadPath } =
    await createEnabledGalleryState(root, [record]);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => {
    throw new Error("network must not be used");
  };
  try {
    const catalog = await generateExternalCatalog({
      state,
      repoRoot: root,
      adapterLoader: async () => ({
        generate: async () => output,
      }),
    });

    assert.equal(catalog.records.length, 1);

    await unlink(payloadPath);
    await assert.rejects(
      generateExternalCatalog({
        state,
        repoRoot: root,
        adapterLoader: async () => ({
          generate: async () => output,
        }),
      }),
      /unavailable offline/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("adapter module graphs are recursively restricted to provider-owned pure modules", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "external-adapter-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const adapterRoot = path.join(root, "winui-gallery");
  const entryPath = path.join(adapterRoot, "index.mjs");
  const helperPath = path.join(adapterRoot, "helper.mjs");
  await mkdir(adapterRoot, { recursive: true });
  await writeFile(
    entryPath,
    'import { helper } from /* comment-separated import */ "./helper.mjs"; export const generate = helper;\n',
  );
  await writeFile(
    helperPath,
    'export const helper = () => globalThis["fetch"]("https://example.com");\n',
  );
  await assert.rejects(
    validateOfflineAdapterGraph(entryPath),
    /cannot call fetch/,
  );

  await writeFile(
    helperPath,
    "export const helper = ({ readArtifact }) => readArtifact(\"Data.json\");\n",
  );
  await assert.doesNotReject(validateOfflineAdapterGraph(entryPath));
});

test("adapter context cannot mutate trusted provider or lock state", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "external-freeze-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const record = await loadRecordFixture("winui-gallery");
  const { state, output } = await createEnabledGalleryState(root, [record]);
  let lockMutationBlocked = false;
  let providerMutationBlocked = false;

  await generateExternalCatalog({
    state,
    repoRoot: root,
    adapterLoader: async () => ({
      generate: async (context) => {
        try {
          context.lock.artifacts.push({});
        } catch (error) {
          lockMutationBlocked = error instanceof TypeError;
        }
        try {
          context.provider.allowedSourceRoots.push("Other");
        } catch (error) {
          providerMutationBlocked = error instanceof TypeError;
        }
        return output;
      },
    }),
  });

  assert.equal(lockMutationBlocked, true);
  assert.equal(providerMutationBlocked, true);
  assert.equal(state.locks.get("winui-gallery").artifacts.length, 2);
  assert.deepEqual(
    state.providers.get("winui-gallery").allowedSourceRoots,
    ["WinUIGallery"],
  );
});

test("reviewed active records cannot silently disappear", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "external-deletion-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const record = await loadRecordFixture("winui-gallery");
  const { state, output } = await createEnabledGalleryState(root, [record]);
  output.records = [];

  await assert.rejects(
    generateExternalCatalog({
      state,
      repoRoot: root,
      adapterLoader: async () => ({
        generate: async () => output,
      }),
    }),
    /disappeared without a tombstone/,
  );
});
