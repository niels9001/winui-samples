#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";

import {
  atomicWriteFile,
  canonicalStringify,
  hashCanonicalJson,
  sha256Hex,
} from "../../lib/canonical.mjs";
import { createArtifactReader } from "../../lib/cache.mjs";
import { loadExternalState } from "../../lib/config.mjs";
import { createRouteSlug } from "../../lib/identity.mjs";
import { validateProviderOutput } from "../../lib/merge.mjs";
import { repositoryRoot } from "../../lib/schema.mjs";
import { PROVIDER_ID } from "./constants.mjs";
import { generate } from "./index.mjs";

function parseArguments(arguments_) {
  let outputPath = null;
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
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
        "Usage: node tools/external-catalog/providers/winui-gallery/dry-run.mjs [--output <path>]\n\n" +
          "Validates and generates the disabled WinUI Gallery provider entirely from committed lock/cache state.",
      );
      process.exit(0);
    } else {
      throw new Error(`unknown argument: ${argument}`);
    }
  }
  return { outputPath };
}

export async function dryRun({ outputPath = null } = {}) {
  const state = await loadExternalState();
  const curationRoot = path.join(
    repositoryRoot,
    "external",
    "curation",
    PROVIDER_ID,
  );
  const [stateCommit, reviewDocument, cachedLicense, licenseManifest] =
    await Promise.all([
      readFile(path.join(curationRoot, "state-commit.json"), "utf8").then(
        JSON.parse,
      ),
      readFile(path.join(curationRoot, "review.json"), "utf8").then(
        JSON.parse,
      ),
      readFile(path.join(curationRoot, "LICENSE")),
      readFile(
        path.join(
          repositoryRoot,
          "external",
          "licenses",
          `${PROVIDER_ID}.json`,
        ),
        "utf8",
      ).then(JSON.parse),
    ]);
  validateStateCommit(stateCommit, state, {
    cachedLicenseSha256: sha256Hex(cachedLicense),
    reviewSha256: hashCanonicalJson(reviewDocument),
    licenseManifestSha256: hashCanonicalJson(licenseManifest),
  });
  const provider = state.providers.get(PROVIDER_ID);
  const lock = state.locks.get(PROVIDER_ID);
  if (!provider || !lock) {
    throw new Error(`${PROVIDER_ID}: committed provider lock is absent`);
  }
  const output = await generate({
    provider,
    lock,
    readArtifact: createArtifactReader(state, lock, {
      repoRoot: repositoryRoot,
    }),
    createRouteSlug,
  });
  await validateProviderOutput(output, state, provider);
  const bytes = canonicalStringify(output);
  if (outputPath) {
    await atomicWriteFile(outputPath, bytes);
  }
  const report = {
    providerId: PROVIDER_ID,
    commitSha: lock.commitSha,
    records: output.records.length,
    categories: new Set(
      output.records.map((record) => record.categories.provider[0]),
    ).size,
    examples: output.records.reduce(
      (total, record) => total + record.content.examples.length,
      0,
    ),
    nestedCodeUnits: output.records.reduce(
      (total, record) =>
        total +
        record.content.examples.reduce(
          (subtotal, example) => subtotal + example.children.length,
          0,
        ),
      0,
    ),
    featuredSourceFiles: new Set(
      output.records.flatMap((record) =>
        record.featuredSourceFiles.map((file) => file.path),
      ),
    ).size,
    images: new Set(
      output.records.flatMap((record) =>
        record.images.map((image) => image.path),
      ),
    ).size,
    outputBytes: Buffer.byteLength(bytes),
    outputSha256: sha256Hex(bytes),
    outputPath,
  };
  return { output, report };
}

export function validateStateCommit(stateCommit, state, providerFiles) {
  if (
    stateCommit.providerId !== PROVIDER_ID ||
    stateCommit.lockCommitSha !==
      state.locks.get(PROVIDER_ID)?.commitSha ||
    stateCommit.documents.providerLockSha256 !==
      hashCanonicalJson(state.locks.get(PROVIDER_ID) ?? null) ||
    stateCommit.documents.providerCacheEntriesSha256 !==
      hashCanonicalJson(
        state.cacheManifest.entries.filter(
          (entry) => entry.providerId === PROVIDER_ID,
        ),
      ) ||
    stateCommit.documents.providerHistorySha256 !==
      hashCanonicalJson(state.histories.get(PROVIDER_ID) ?? null) ||
    stateCommit.providerFiles.cachedLicenseSha256 !==
      providerFiles.cachedLicenseSha256 ||
    stateCommit.providerFiles.reviewSha256 !==
      providerFiles.reviewSha256 ||
    stateCommit.providerFiles.licenseManifestSha256 !==
      providerFiles.licenseManifestSha256
  ) {
    throw new Error(
      `${PROVIDER_ID}: committed lock/cache/history publication is incomplete`,
    );
  }
  return true;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))
) {
  try {
    const options = parseArguments(process.argv.slice(2));
    const { report } = await dryRun(options);
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    console.error(`error: ${error.message}`);
    process.exitCode = 1;
  }
}
