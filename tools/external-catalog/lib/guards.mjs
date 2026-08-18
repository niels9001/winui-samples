import path from "node:path";

export const textArtifactSizeLimit = 1024 * 1024;
export const mediaArtifactSizeLimit = 2 * 1024 * 1024;
export const recordAggregateSizeLimit = 5 * 1024 * 1024;

export const safeTextExtensions = new Set([
  ".appcontent-ms",
  ".appxmanifest",
  ".c",
  ".cc",
  ".cpp",
  ".cs",
  ".csproj",
  ".css",
  ".h",
  ".hpp",
  ".html",
  ".idl",
  ".ino",
  ".js",
  ".json",
  ".jsx",
  ".manifest",
  ".md",
  ".mjs",
  ".props",
  ".ps1",
  ".resw",
  ".targets",
  ".ts",
  ".tsx",
  ".txt",
  ".xaml",
  ".xml",
  ".yaml",
  ".yml",
]);

const secretFilenamePatterns = [
  /^\.env(?:\.|$)/i,
  /^id_(?:dsa|ecdsa|ed25519|rsa)(?:\.|$)/i,
  /(?:^|[._-])credentials?(?:[._-]|$)/i,
  /(?:^|[._-])passwords?(?:[._-]|$)/i,
  /(?:^|[._-])private[._-]?keys?(?:[._-]|$)/i,
  /(?:^|[._-])secrets?(?:[._-]|$)/i,
  /\.(?:key|p12|pfx|pem)$/i,
];

const secretContentPatterns = [
  /-----BEGIN (?:EC |OPENSSH |RSA )?PRIVATE KEY-----/,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/,
  /\bgh[opsu]_[A-Za-z0-9]{20,}\b/,
  /\bBearer\s+[A-Za-z0-9._~+/=-]{20,}\b/i,
  /\b(?:client_secret|password|private_key)\s*[:=]\s*["'][^"']{8,}["']/i,
];

const dangerousHtmlPattern =
  /<\/?(?:a|audio|body|div|embed|form|head|html|iframe|img|input|link|math|meta|object|p|script|span|style|svg|video)\b[^>]*>/i;

const forbiddenAdapterModules = [
  "axios",
  "child_process",
  "dgram",
  "dns",
  "fs",
  "http",
  "https",
  "net",
  "node:child_process",
  "node:dgram",
  "node:dns",
  "node:fs",
  "node:http",
  "node:https",
  "node:net",
  "node:tls",
  "node:worker_threads",
  "tls",
  "undici",
  "worker_threads",
];

function fail(message) {
  throw new Error(message);
}

export function assertSafePosixPath(value, { allowEmpty = false } = {}) {
  if (typeof value !== "string") {
    fail("path must be a string");
  }
  if (value.length === 0) {
    if (allowEmpty) {
      return value;
    }
    fail("path must not be empty");
  }
  if (
    value.includes("\0") ||
    value.includes("\\") ||
    path.posix.isAbsolute(value) ||
    /^[A-Za-z]:/.test(value)
  ) {
    fail(`unsafe repository path: ${JSON.stringify(value)}`);
  }
  if (/%[0-9a-f]{2}/i.test(value)) {
    fail(`encoded path octets are not allowed: ${value}`);
  }

  const segments = value.split("/");
  if (
    segments.some(
      (segment) =>
        segment.length === 0 || segment === "." || segment === "..",
    )
  ) {
    fail(`path contains an unsafe traversal segment: ${value}`);
  }

  return value;
}

export function assertAllowedSourceRoot(value, roots) {
  assertSafePosixPath(value);
  const matches = roots.some(
    (root) => value === root || value.startsWith(`${root}/`),
  );
  if (!matches) {
    fail(`source path is outside the provider allowlist: ${value}`);
  }
}

export function assertNotSecretLikePath(value) {
  assertSafePosixPath(value);
  const denied = value
    .split("/")
    .some((segment) =>
      secretFilenamePatterns.some((pattern) => pattern.test(segment)),
    );
  if (denied) {
    fail(`secret-like files cannot enter the catalog cache: ${value}`);
  }
}

export function assertNoSecretLikeContent(text, context = "artifact") {
  for (const pattern of secretContentPatterns) {
    if (pattern.test(text)) {
      fail(`${context} contains secret-like content`);
    }
  }
}

export function assertPlainText(value, context = "text") {
  if (typeof value !== "string") {
    return;
  }
  if (value.includes("\0") || /[\u0001-\u0008\u000B\u000C\u000E-\u001F]/.test(value)) {
    fail(`${context} contains unsafe control characters`);
  }
  if (dangerousHtmlPattern.test(value)) {
    fail(`${context} must be plain text; raw HTML is not allowed`);
  }
}

export function assertOfflineAdapterSource(source, context = "provider adapter") {
  if (
    /\bfetch\s*\(/.test(source) ||
    /\b(?:globalThis|window)\s*(?:\.fetch|\[\s*["']fetch["']\s*\])/.test(source)
  ) {
    fail(`${context} cannot call fetch during offline generation`);
  }
  if (
    /\bimport\s*\(/.test(source) ||
    /\brequire\s*\(/.test(source) ||
    /\bprocess\s*\.\s*(?:binding|getBuiltinModule)\s*\(/.test(source)
  ) {
    fail(`${context} cannot load modules dynamically during offline generation`);
  }
  if (/\b(?:WebSocket|EventSource|XMLHttpRequest|sendBeacon)\b/.test(source)) {
    fail(`${context} cannot use browser network primitives`);
  }
  if (/["'][^"']*network\.mjs["']/.test(source)) {
    fail(`${context} cannot import the refresh-only network client`);
  }
  for (const moduleName of forbiddenAdapterModules) {
    const escaped = moduleName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`["']${escaped}(?:/[^"']*)?["']`).test(source)) {
      fail(`${context} cannot import ${moduleName} during offline generation`);
    }
  }
}

export function assertHtmlSafeValue(value, context = "$") {
  if (typeof value === "string") {
    assertPlainText(value, context);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      assertHtmlSafeValue(item, `${context}[${index}]`),
    );
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      assertHtmlSafeValue(item, `${context}.${key}`);
    }
  }
}

export function findExactGitEntry(entries, requestedPath) {
  assertSafePosixPath(requestedPath);
  const exact = entries.find((entry) => entry.path === requestedPath);
  if (!exact) {
    const caseInsensitive = entries.find(
      (entry) => entry.path.toLowerCase() === requestedPath.toLowerCase(),
    );
    if (caseInsensitive) {
      fail(
        `source path casing mismatch: requested ${requestedPath}, locked tree contains ${caseInsensitive.path}`,
      );
    }
    fail(`source path is absent from the locked tree: ${requestedPath}`);
  }
  if (
    exact.mode === "120000" ||
    exact.type === "symlink"
  ) {
    fail(`symbolic links are not allowed: ${requestedPath}`);
  }
  if (
    exact.mode === "160000" ||
    exact.type === "commit"
  ) {
    fail(`submodules are not allowed: ${requestedPath}`);
  }
  if (exact.type !== "blob" || !["100644", "100755"].includes(exact.mode)) {
    fail(`only regular Git blobs are allowed: ${requestedPath}`);
  }
  return exact;
}

export function validateTextArtifact({
  path: sourcePath,
  bytes,
  maxBytes = textArtifactSizeLimit,
}) {
  assertNotSecretLikePath(sourcePath);
  const extension = path.posix.extname(sourcePath).toLowerCase();
  if (!safeTextExtensions.has(extension)) {
    fail(`text extension is not allowlisted: ${extension || "(none)"}`);
  }
  if (bytes.byteLength > maxBytes) {
    fail(`text artifact exceeds ${maxBytes} bytes: ${sourcePath}`);
  }
  if (bytes.includes(0)) {
    fail(`binary content is not allowed in a text artifact: ${sourcePath}`);
  }

  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    fail(`text artifact is not valid UTF-8: ${sourcePath}`);
  }
  assertNoSecretLikeContent(text, sourcePath);
  return text;
}

function hasPrefix(bytes, prefix) {
  return prefix.every((value, index) => bytes[index] === value);
}

function mediaSignature(bytes, mediaType) {
  if (mediaType === "image/png") {
    return hasPrefix(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  }
  if (mediaType === "image/jpeg") {
    return hasPrefix(bytes, [0xff, 0xd8, 0xff]);
  }
  if (mediaType === "image/webp") {
    return (
      hasPrefix(bytes, [0x52, 0x49, 0x46, 0x46]) &&
      bytes.byteLength >= 12 &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
    );
  }
  return false;
}

export function validateMediaArtifact({
  path: sourcePath,
  bytes,
  mediaType,
  maxBytes = mediaArtifactSizeLimit,
}) {
  assertNotSecretLikePath(sourcePath);
  const expectedTypes = new Map([
    [".png", "image/png"],
    [".jpg", "image/jpeg"],
    [".jpeg", "image/jpeg"],
    [".webp", "image/webp"],
  ]);
  const extension = path.posix.extname(sourcePath).toLowerCase();
  const expectedType = expectedTypes.get(extension);
  if (!expectedType || expectedType !== mediaType) {
    fail(`media extension/MIME mismatch for ${sourcePath}: ${mediaType}`);
  }
  if (bytes.byteLength > maxBytes) {
    fail(`media artifact exceeds ${maxBytes} bytes: ${sourcePath}`);
  }
  if (!mediaSignature(bytes, mediaType)) {
    fail(`media signature does not match ${mediaType}: ${sourcePath}`);
  }
  return { mediaType, size: bytes.byteLength };
}

export function validateCachedArtifact({
  path: sourcePath,
  bytes,
  mediaType,
  maxBytes,
}) {
  if (mediaType.startsWith("image/")) {
    return validateMediaArtifact({
      path: sourcePath,
      bytes,
      mediaType,
      maxBytes,
    });
  }
  if (
    mediaType.startsWith("text/") ||
    mediaType === "application/json" ||
    mediaType === "application/xml"
  ) {
    return validateTextArtifact({
      path: sourcePath,
      bytes,
      maxBytes,
    });
  }
  fail(`cache media type is not allowlisted: ${mediaType}`);
}

export function assertRecordAssetBudget(
  assets,
  maxBytes = recordAggregateSizeLimit,
) {
  const total = assets.reduce((sum, asset) => sum + asset.size, 0);
  if (total > maxBytes) {
    fail(`record assets exceed the ${maxBytes}-byte aggregate limit (${total})`);
  }
  return total;
}
