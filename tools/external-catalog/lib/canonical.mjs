import { createHash, randomUUID } from "node:crypto";
import {
  mkdir,
  open,
  rename,
  rm,
} from "node:fs/promises";
import path from "node:path";

function compareCanonical(left, right) {
  if (
    left &&
    right &&
    typeof left === "object" &&
    typeof right === "object" &&
    !Array.isArray(left) &&
    !Array.isArray(right) &&
    Number.isInteger(left.position) &&
    Number.isInteger(right.position) &&
    left.position !== right.position
  ) {
    return left.position - right.position;
  }

  const leftValue = JSON.stringify(left);
  const rightValue = JSON.stringify(right);
  return leftValue === rightValue ? 0 : leftValue < rightValue ? -1 : 1;
}

export function canonicalize(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalize).sort(compareCanonical);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])]),
    );
  }

  return value;
}

export function canonicalStringify(value) {
  return `${JSON.stringify(canonicalize(value), null, 2)}\n`;
}

export function sha256Hex(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function gitBlobSha(value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value);
  return createHash("sha1")
    .update(Buffer.from(`blob ${bytes.byteLength}\0`))
    .update(bytes)
    .digest("hex");
}

export function hashCanonicalJson(value) {
  return sha256Hex(canonicalStringify(value));
}

export async function atomicWriteFile(outputPath, contents) {
  await mkdir(path.dirname(outputPath), { recursive: true });
  const temporaryPath = path.join(
    path.dirname(outputPath),
    `.${path.basename(outputPath)}.${process.pid}.${randomUUID()}.tmp`,
  );

  let handle;
  try {
    handle = await open(temporaryPath, "wx");
    await handle.writeFile(contents, "utf8");
    await handle.sync();
    await handle.close();
    handle = undefined;
    await rename(temporaryPath, outputPath);
  } catch (error) {
    await handle?.close().catch(() => {});
    await rm(temporaryPath, { force: true }).catch(() => {});
    throw error;
  }
}

export async function atomicWriteCanonicalJson(outputPath, value) {
  await atomicWriteFile(outputPath, canonicalStringify(value));
}
