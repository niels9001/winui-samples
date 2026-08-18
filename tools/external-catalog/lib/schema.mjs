import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
export const repositoryRoot = path.resolve(
  moduleDirectory,
  "..",
  "..",
  "..",
);

const schemaDirectory = path.join(
  repositoryRoot,
  "metadata",
  "schema",
  "federated",
  "v1",
);

const schemaFiles = {
  "cache-manifest": "cache-manifest.schema.json",
  "license-manifest": "license-manifest.schema.json",
  "merged-catalog": "merged-catalog.schema.json",
  "normalized-record": "normalized-record.schema.json",
  "provider-output": "provider-output.schema.json",
  "provider-registry": "provider-registry.schema.json",
  "source-lock": "source-lock.schema.json",
  "sync-history": "sync-history.schema.json",
};

let validatorsPromise;

function formatErrors(errors) {
  return (errors ?? [])
    .map((error) => {
      const location = error.instancePath || "/";
      return `${location} ${error.message}`.trim();
    })
    .join("; ");
}

async function buildValidators() {
  const schemas = {};
  for (const [name, filename] of Object.entries(schemaFiles)) {
    schemas[name] = JSON.parse(
      await readFile(path.join(schemaDirectory, filename), "utf8"),
    );
  }

  const ajv = new Ajv2020({
    allErrors: true,
    allowUnionTypes: true,
    strict: true,
  });
  for (const schema of Object.values(schemas)) {
    ajv.addSchema(schema);
  }

  return Object.fromEntries(
    Object.entries(schemas).map(([name, schema]) => [
      name,
      ajv.getSchema(schema.$id),
    ]),
  );
}

async function validators() {
  validatorsPromise ??= buildValidators();
  return validatorsPromise;
}

export async function validateContract(name, value) {
  const validator = (await validators())[name];
  if (!validator) {
    throw new Error(`unknown federated contract schema: ${name}`);
  }
  const valid = validator(value);
  return {
    valid: Boolean(valid),
    errors: valid ? [] : [...(validator.errors ?? [])],
  };
}

export async function assertContract(name, value, context = name) {
  const result = await validateContract(name, value);
  if (!result.valid) {
    throw new Error(`${context} is invalid: ${formatErrors(result.errors)}`);
  }
}
