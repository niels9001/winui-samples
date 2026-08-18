import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  access,
  readFile,
  readdir,
  stat,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const siteRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const repositoryRoot = path.resolve(siteRoot, "..");
const distRoot = path.join(siteRoot, "dist");
const catalogPath = path.join(
  siteRoot,
  "src",
  "generated",
  "sample-catalog.json",
);
const basePath = "/winui-samples/";
const featuredFileSizeLimit = 128 * 1024;
const safeFeaturedFileExtensions = new Set([
  ".appcontent-ms",
  ".appxmanifest",
  ".c",
  ".cpp",
  ".cs",
  ".csproj",
  ".h",
  ".idl",
  ".ino",
  ".json",
  ".manifest",
  ".md",
  ".props",
  ".ps1",
  ".py",
  ".resw",
  ".targets",
  ".txt",
  ".vcxproj",
  ".xaml",
  ".xml",
  ".yaml",
  ".yml",
]);
const deniedDirectoryNames = new Set([
  ".git",
  ".vs",
  "apppackages",
  "artifacts",
  "bin",
  "build",
  "bundleartifacts",
  "debug",
  "dist",
  "generated files",
  "node_modules",
  "obj",
  "packages",
  "release",
  "x64",
  "x86",
  "arm",
  "arm64",
]);
const deniedFilePatterns = [
  /^\.env(?:\.|$)/i,
  /(?:^|[._-])credentials?(?:[._-]|$)/i,
  /(?:^|[._-])passwords?(?:[._-]|$)/i,
  /(?:^|[._-])private[._-]?keys?(?:[._-]|$)/i,
  /(?:^|[._-])secrets?(?:[._-]|$)/i,
  /\.g(?:\.i)?\.cs$/i,
  /\.generated\.[^.]+$/i,
  /^packages\.lock\.json$/i,
  /^project\.assets\.json$/i,
];

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function featuredFileKey(file) {
  const slug = file.path
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72)
    .replace(/-+$/, "");
  const pathHash = createHash("sha256")
    .update(file.path)
    .digest("hex")
    .slice(0, 12);
  return `${slug}-${pathHash}`;
}

function hasCodeRoute(sample, file) {
  const segments = file.path.split("/");
  const extension = path.posix.extname(file.path).toLowerCase();
  const validPath =
    file.path.length > 0 &&
    !file.path.includes("\\") &&
    !path.posix.isAbsolute(file.path) &&
    !/^[A-Za-z]:/.test(file.path) &&
    segments.every(
      (segment) =>
        segment.length > 0 &&
        segment !== "." &&
        segment !== ".." &&
        !segment.startsWith(".") &&
        !deniedFilePatterns.some((pattern) => pattern.test(segment)),
    ) &&
    !segments
      .slice(0, -1)
      .some((segment) => deniedDirectoryNames.has(segment.toLowerCase())) &&
    safeFeaturedFileExtensions.has(extension);
  const hasCachedPreview =
    !sample.federated ||
    (typeof file.sha256 === "string" &&
      typeof file.size === "number" &&
      file.size <= featuredFileSizeLimit);
  return validPath && hasCachedPreview;
}

function htmlUrl(url) {
  return url.replaceAll("&", "&amp;");
}

function htmlText(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function nestedUnits(units) {
  return units.flatMap((unit) => [
    unit,
    ...nestedUnits(unit.children ?? []),
  ]);
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function collectFiles(directory, extension) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(entryPath, extension)));
    } else if (
      entry.isFile() &&
      (!extension || entry.name.endsWith(extension))
    ) {
      files.push(entryPath);
    }

  }

  return files;
}

function relativeOutputPath(filePath) {
  return path.relative(distRoot, filePath).split(path.sep).join("/");
}

function scriptAssetNames(html) {
  const names = new Set();
  for (const match of html.matchAll(
    /(?:src|component-url|renderer-url)=["'][^"']*\/_astro\/([^"']+\.js)["']/g,
  )) {
    names.add(match[1]);
  }
  return names;
}

async function staticScriptDependencies(entryNames) {
  const names = new Set(entryNames);
  const queue = [...names];
  while (queue.length > 0) {
    const name = queue.shift();
    const contents = await readFile(
      path.join(distRoot, "_astro", name),
      "utf8",
    );
    for (const match of contents.matchAll(
      /(?:from|import)["']\.\/([^"']+\.js)["']/g,
    )) {
      if (!names.has(match[1])) {
        names.add(match[1]);
        queue.push(match[1]);
      }
    }
  }
  return names;
}

async function scriptGzipSize(names) {
  let size = 0;
  for (const name of names) {
    size += gzipSync(await readFile(path.join(distRoot, "_astro", name)), {
      level: 9,
    }).length;
  }
  return size;
}

function inlineScriptGzipSize(html) {
  const contents = [
    ...html.matchAll(
      /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g,
    ),
  ]
    .map((match) => match[1])
    .join("\n");
  return gzipSync(contents, { level: 9 }).length;
}

function localOutputPath(urlValue) {
  if (!urlValue.startsWith(basePath)) {
    return undefined;
  }

  const withoutFragment = urlValue.split(/[?#]/, 1)[0];
  const relative = decodeURIComponent(withoutFragment.slice(basePath.length));
  if (relative.length === 0) {
    return path.join(distRoot, "index.html");
  }
  if (relative.endsWith("/")) {
    return path.join(distRoot, relative, "index.html");
  }
  return path.join(distRoot, relative);
}

function assertOrdered(html, markers, label) {
  let previousIndex = -1;
  for (const marker of markers) {
    const markerIndex = html.indexOf(marker);
    assert.ok(markerIndex > previousIndex, `${label}: ${marker}`);
    previousIndex = markerIndex;
  }
}

function assertDeveloperChrome(html, label) {
  const forbidden = [
    /Read the README/i,
    /Migration notes?/i,
    /ported from UWP/i,
    /Recently shipped/i,
    /PR #\d+/i,
    /merged pull request/i,
  ];
  for (const pattern of forbidden) {
    assert.doesNotMatch(html, pattern, `${label}: ${pattern}`);
  }
}

const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
assert.equal(catalog.samples.length, 233);
assert.deepEqual(
  Object.fromEntries(
    catalog.providers.map((provider) => [provider.id, provider.recordCount]),
  ),
  {
    "winui-gallery": 120,
    "windows-app-sdk-samples": 42,
    "winui-samples": 71,
  },
);
assert.equal(new Set(catalog.samples.map((sample) => sample.id)).size, 233);
assert.equal(
  new Set(catalog.samples.map((sample) => sample.globalId)).size,
  233,
);
assert.equal(
  new Set(catalog.samples.map((sample) => sample.routePath)).size,
  233,
);

const localHeroById = new Map();
for (const sample of catalog.samples.filter((entry) => !entry.federated)) {
  const mediaDirectory = path.join(
    repositoryRoot,
    ...sample.project.repositoryPath.split("/"),
    "media",
  );
  const sidecarPath = path.join(mediaDirectory, "hero.json");
  const candidates = [
    {
      filename: "hero.webp",
      path: path.join(mediaDirectory, "hero.webp"),
    },
    {
      filename: "hero.png",
      path: path.join(mediaDirectory, "hero.png"),
    },
  ];
  const existingImages = [];
  for (const candidate of candidates) {
    if (await fileExists(candidate.path)) existingImages.push(candidate);
  }
  const hasSidecar = await fileExists(sidecarPath);
  assert.equal(
    hasSidecar,
    existingImages.length > 0,
    `${sample.id} hero image and sidecar must be paired.`,
  );
  if (!hasSidecar) continue;

  assert.equal(
    existingImages.length,
    1,
    `${sample.id} must have one approved hero image.`,
  );
  const sidecar = JSON.parse(await readFile(sidecarPath, "utf8"));
  const image = existingImages[0];
  const bytes = await readFile(image.path);
  assert.equal(sidecar.schemaVersion, 1);
  assert.equal(sidecar.sampleId, sample.id);
  assert.equal(
    sidecar.sourceMetadata,
    `${sample.project.repositoryPath}/sample.yml`,
  );
  assert.equal(sidecar.image.file, image.filename);
  assert.equal(sidecar.image.width, 1440);
  assert.equal(sidecar.image.height, 900);
  assert.equal(sidecar.image.width * 10, sidecar.image.height * 16);
  assert.ok(sidecar.alt.trim().length > 0);
  assert.equal(
    sidecar.image.sha256,
    createHash("sha256").update(bytes).digest("hex"),
    `${sample.id} hero hash mismatch.`,
  );
  localHeroById.set(sample.id, {
    ...sidecar,
    filename: image.filename,
  });
}
assert.equal(localHeroById.size, 48);
assert.equal(71 - localHeroById.size, 23);

const browsePath = path.join(distRoot, "samples", "index.html");
const browseHtml = await readFile(browsePath, "utf8");
const landingPath = path.join(distRoot, "index.html");
const landingHtml = await readFile(landingPath, "utf8");
const browseIndexRoot = path.join(distRoot, "browse-index");
const browseIndexFiles = await collectFiles(browseIndexRoot, ".json");
assert.equal(
  browseIndexFiles.length,
  1,
  "Expected one content-addressed Browse index.",
);
const browseIndexPath = browseIndexFiles[0];
const browseIndexBytes = await readFile(browseIndexPath);
const browseIndexHash = createHash("sha256")
  .update(browseIndexBytes)
  .digest("hex");
assert.equal(path.basename(browseIndexPath), `${browseIndexHash}.json`);
const browseIndexText = browseIndexBytes.toString("utf8");
for (const credentialPattern of [
  /AKIA[0-9A-Z]{16}/g,
  /github_pat_[A-Za-z0-9_]{20,}/g,
  /gh[opsu]_[A-Za-z0-9]{36,}/g,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
  /(?:api[_-]?key|access[_-]?token|client[_-]?secret|password)\s*[:=]\s*["']?[A-Za-z0-9_./+=-]{12,}/gi,
]) {
  assert.doesNotMatch(
    browseIndexText,
    credentialPattern,
    `Browse index contains a credential-like value: ${credentialPattern}`,
  );
}
const browseIndex = JSON.parse(browseIndexText);
assert.equal(browseIndex.schemaVersion, 1);
assert.equal(browseIndex.catalogHash, catalog.contentHash);
assert.equal(browseIndex.searchHash, catalog.searchIndex.contentHash);
assert.equal(browseIndex.recordCount, 233);
assert.equal(browseIndex.records.length, 233);
assert.deepEqual(browseIndex.records, catalog.searchIndex.records);
assert.equal(Object.keys(browseIndex.media).length, 49);
assert.equal(
  browseIndex.media["file-access"].url,
  `${basePath}sample-media/file-access/hero.png`,
);
assert.match(browseHtml, new RegExp(`${browseIndexHash}\\.json`));
assert.doesNotMatch(
  browseHtml,
  /&quot;searchGroups&quot;|&quot;federated&quot;|cache\/blobs/,
);
const serializedBrowseIndex = JSON.stringify(browseIndex);
for (const forbidden of [
  "cachePath",
  "licenseRefs",
  "metadata.warnings",
  "pull request",
  "migration notes",
]) {
  assert.equal(
    serializedBrowseIndex.toLowerCase().includes(forbidden.toLowerCase()),
    false,
    `Browse index contains ${forbidden}`,
  );
}

assert.match(browseHtml, /<main\b[^>]*\bid="main-content"/);
assert.match(browseHtml, /aria-live="polite"/);
assert.match(
  browseHtml,
  /<title>Browse \| Windows App Samples Browser<\/title>/,
);
assert.match(browseHtml, /WinUI samples/);
assert.match(browseHtml, /<noscript>/);
assert.match(
  browseHtml,
  /Every sample in Windows App Samples Browser\s+remains available below/,
);
assert.doesNotMatch(browseHtml, /readinessSelector|screenshot-recipes|pullRequest/);
assertDeveloperChrome(browseHtml, "Browse");
const noScriptDirectory =
  /<noscript>([\s\S]*?)<\/noscript>/.exec(browseHtml)?.[1] ?? "";
for (const sample of catalog.samples) {
  assert.match(
    noScriptDirectory,
    new RegExp(
      `href=["']${escapeRegExp(basePath)}samples/${escapeRegExp(sample.id)}/["']`,
    ),
    `No-JavaScript directory is missing ${sample.id}`,
  );
}

for (const provider of catalog.providers) {
  assert.match(browseHtml, new RegExp(escapeRegExp(provider.label)));
}

for (const document of catalog.samples.flatMap((sample) =>
  sample.documentation.filter((entry) => entry.kind === "migration"),
)) {
  assert.ok(
    !browseHtml.includes(document.title),
    `Browse index contains migration documentation: ${document.title}`,
  );
}

assertOrdered(
  landingHtml,
  [
    'id="hero-title"',
    'data-showcase-stage',
    'id="build-paths"',
    'id="featured-title"',
    'id="get-started-title"',
  ],
  "Landing section order",
);
assert.match(landingHtml, /Find working Windows code for what you want to build/);
assert.match(
  landingHtml,
  /<title>Windows App Samples Browser<\/title>/,
);
assert.match(
  landingHtml,
  /property="og:site_name" content="Windows App Samples Browser"/,
);
assert.match(
  landingHtml,
  /aria-label="Windows App Samples Browser home"/,
);
assert.match(landingHtml, /data-showcase-stage/);
assert.match(landingHtml, /Windows code workspace/);
assert.match(landingHtml, /Search by outcome or API/);
assert.doesNotMatch(landingHtml, /sample-activity|pullRequest|contribute-title/);
assert.doesNotMatch(
  landingHtml,
  /(?:ghp|github_pat)_[A-Za-z0-9_]+|Bearer\s+[A-Za-z0-9._-]+/,
);
assert.match(
  landingHtml,
  new RegExp(
    `<strong[^>]*>${catalog.samples.length} focused examples<\\/strong><span[^>]*>across ${catalog.providers.length} trusted sources`,
  ),
);
for (const provider of catalog.providers) {
  assert.match(
    landingHtml,
    new RegExp(escapeRegExp(provider.label)),
    `Landing does not feature ${provider.label}`,
  );
}
assertDeveloperChrome(landingHtml, "Landing");

const expectedHtmlPaths = new Set(["index.html", "samples/index.html"]);
for (const redirect of catalog.routes?.redirects ?? []) {
  const match = /^samples\/([^/]+)$/.exec(redirect.fromPath);
  assert.ok(match?.[1], `Unsupported redirect route ${redirect.fromPath}`);
  const relativePath = `samples/${match[1]}/index.html`;
  assert.equal(
    await fileExists(path.join(distRoot, ...relativePath.split("/"))),
    true,
    `Missing static redirect route ${redirect.fromPath}`,
  );
  expectedHtmlPaths.add(relativePath);
}
const detailById = new Map();
let codeRouteCount = 0;

for (const sample of catalog.samples) {
  const detailPath = path.join(
    distRoot,
    "samples",
    sample.id,
    "index.html",
  );
  assert.equal(
    await fileExists(detailPath),
    true,
    `Missing detail route for ${sample.id}`,
  );
  expectedHtmlPaths.add(`samples/${sample.id}/index.html`);

  const detailHtml = await readFile(detailPath, "utf8");
  detailById.set(sample.id, detailHtml);
  assertDeveloperChrome(detailHtml, sample.id);
  assert.match(
    detailHtml,
    /<nav\b[^>]*aria-labelledby="page-index-title"/,
    `${sample.id} page index needs an accessible name`,
  );
  assert.match(
    detailHtml,
    new RegExp(escapeRegExp(sample.provider.label)),
  );
  const record = sample.federated?.record;
  const contentCount = record
    ? record.content.variants.length +
      record.content.scenarios.length +
      record.content.examples.length
    : sample.scenarios.length;
  const documentationMarkers = ['id="overview"'];
  if (!record) documentationMarkers.push('id="run"');
  if (contentCount > 0) documentationMarkers.push('id="content"');
  if (sample.apis.length > 0) documentationMarkers.push('id="apis"');
  if (sample.featuredFiles.length > 0) documentationMarkers.push('id="code"');
  documentationMarkers.push(
    'id="requirements"',
    'id="limitations"',
    'id="resources"',
    'id="related-title"',
  );
  assertOrdered(
    detailHtml,
    documentationMarkers,
    `${sample.id} documentation order`,
  );
  assert.doesNotMatch(detailHtml, /class="sample-facts/);
  assert.match(detailHtml, /Source and documentation/);
  assert.match(detailHtml, /Related projects/);
  assert.doesNotMatch(detailHtml, /external[\\/]cache|cache[\\/]blobs|sha256[\\/]/i);

  if (record) {
    assert.doesNotMatch(detailHtml, /id="run"/);
    assert.doesNotMatch(detailHtml, /dotnet build|dotnet run|git clone/i);
    assert.ok(detailHtml.includes(htmlUrl(record.links.source)));
    assert.match(
      detailHtml,
      new RegExp(record.source.lockedCommitSha.slice(0, 12)),
    );
    assert.match(detailHtml, /License and attribution/);
    for (const license of sample.federated.licenses) {
      assert.ok(
        detailHtml.includes(htmlUrl(license.licenseUrl)),
        `${sample.id} is missing ${license.id} attribution`,
      );
    }
    for (const warning of record.metadata.warnings) {
      assert.ok(
        !detailHtml.includes(htmlText(warning.message)),
        `${sample.id} renders provider review warning ${warning.code}`,
      );
    }
    for (const unit of nestedUnits([
      ...record.content.variants,
      ...record.content.scenarios,
      ...record.content.examples,
    ])) {
      assert.ok(
        detailHtml.includes(htmlText(unit.title)),
        `${sample.id} is missing nested content ${unit.id}`,
      );
    }

    if (record.provider.id === "winui-gallery") {
      assert.match(detailHtml, /winui3gallery:\/\/item\//);
      if (record.images.length > 0) {
        assert.match(
          detailHtml,
          /class="detail-title-icon"[^>]*alt=""[^>]*aria-hidden="true"|alt=""[^>]*aria-hidden="true"[^>]*class="detail-title-icon"/,
        );
      }
      assert.doesNotMatch(detailHtml, /Gallery screenshot/i);
    } else {
      assert.doesNotMatch(detailHtml, /winui3gallery:\/\/item\//);
    }
  } else {
    assert.match(detailHtml, /Build and launch from a local checkout/);
    assert.match(detailHtml, /aria-label="Copy [^"]+ build commands"/);
    assert.match(detailHtml, /data-copy-control/);
    const repositoryPath = sample.project.repositoryPath
      .split("/")
      .map(encodeURIComponent)
      .join("/");
    assert.match(
      detailHtml,
      new RegExp(
        `github\\.com/niels9001/winui-samples/tree/main/${escapeRegExp(
          repositoryPath,
        )}`,
      ),
    );

    const approvedHero = localHeroById.get(sample.id);
    if (approvedHero) {
      assert.match(
        detailHtml,
        new RegExp(
          `src="${escapeRegExp(basePath)}sample-media/${escapeRegExp(
            sample.id,
          )}/${escapeRegExp(approvedHero.filename)}"`,
        ),
      );
      const heroAlt = htmlText(approvedHero.alt).replaceAll("&#39;", "'");
      assert.ok(
        detailHtml.includes(`alt="${heroAlt}"`),
        `${sample.id} is missing its sidecar alt text.`,
      );
      assert.match(detailHtml, /\bwidth="1440"/);
      assert.match(detailHtml, /\bheight="900"/);
      assert.match(
        detailHtml,
        /data-aspect-ratio="16:10" data-fit="contain"/,
      );
    } else {
      assert.match(detailHtml, /class="detail-visual-fallback/);
      assert.doesNotMatch(
        detailHtml,
        new RegExp(
          `sample-media/${escapeRegExp(sample.id)}/hero\\.(?:webp|png)`,
        ),
      );
    }
  }

  const limitationsStart = detailHtml.indexOf('id="limitations"');
  const limitationsEnd = detailHtml.indexOf('id="resources"', limitationsStart);
  assert.doesNotMatch(
    detailHtml.slice(limitationsStart, limitationsEnd),
    /\b(?:UWP|ported|porting|Migration notes?)\b/i,
    `${sample.id} limitations contain platform history`,
  );

  const heroStart = detailHtml.indexOf('<section class="detail-hero"');
  const heroEnd = detailHtml.indexOf("</section>", heroStart);
  const heroHtml = detailHtml.slice(heroStart, heroEnd);
  assert.equal(
    (heroHtml.match(/class="button-link"/g) ?? []).length,
    1,
    `${sample.id} must have one primary hero action`,
  );
  assert.match(heroHtml, />\s*View source\b/);
  assert.doesNotMatch(heroHtml, /data-copy-control|git clone|README/i);

  if (sample.scenarios.length > 6) {
    assert.match(
      detailHtml,
      new RegExp(`Show all ${sample.scenarios.length} scenarios`),
    );
  }
  if (sample.scenarios.some((scenario) => (scenario.apis?.length ?? 0) > 3)) {
    assert.match(detailHtml, /class="scenario-api-disclosure"/);
  }

  const migrationDocuments = sample.documentation.filter(
    (document) => document.kind === "migration",
  );
  for (const document of migrationDocuments) {
    assert.ok(
      !detailHtml.includes(document.title),
      `${sample.id} shows migration documentation: ${document.title}`,
    );
  }

  for (const file of sample.featuredFiles) {
    const key = featuredFileKey(file);
    const codePath = path.join(
      distRoot,
      "samples",
      sample.id,
      "code",
      key,
      "index.html",
    );
    const expected = hasCodeRoute(sample, file);
    assert.equal(
      await fileExists(codePath),
      expected,
      `${expected ? "Missing" : "Unexpected"} code route for ${sample.id}/${file.path}`,
    );
    if (!expected) {
      assert.match(detailHtml, new RegExp(escapeRegExp(file.path)));
      assert.match(detailHtml, /source only/);
      continue;
    }

    codeRouteCount += 1;
    expectedHtmlPaths.add(
      `samples/${sample.id}/code/${key}/index.html`,
    );

    const codeHtml = await readFile(codePath, "utf8");
    assertDeveloperChrome(codeHtml, `${sample.id}/${file.path}`);
    assert.match(codeHtml, /aria-label="Code actions"/);
    assert.match(codeHtml, /aria-label="Copy file path"/);
    assert.match(codeHtml, /aria-label="Open file in source"/);
    assert.match(codeHtml, /aria-label="Curated files"/);
    assert.match(
      codeHtml,
      /class="line"|Preview unavailable/,
      `Code route did not render source or a clear fallback for ${sample.id}/${file.path}`,
    );
    if (file.canonicalUrl) {
      assert.ok(codeHtml.includes(htmlUrl(file.canonicalUrl)));
    } else {
      assert.match(
        codeHtml,
        /github\.com\/niels9001\/winui-samples\/blob\/main\//,
      );
    }
  }
}

const htmlFiles = await collectFiles(distRoot, ".html");
assert.equal(codeRouteCount, 992);
assert.deepEqual(
  htmlFiles.map(relativeOutputPath).sort(),
  [...expectedHtmlPaths].sort(),
  "Static HTML routes do not exactly match the catalog.",
);

for (const id of [
  "file-access",
  "bluetooth",
  "sensors",
  "winui-gallery--button--c065a8f484b9",
  "winui-gallery--color--e03b2aead598",
  "windows-app-sdk-samples--app-lifecycle-activation--cb5546636ba5",
  "windows-app-sdk-samples--photo-editor--9974079a54c2",
  "windows-app-sdk-samples--secure-ui--174d4739093c",
]) {
  assert.ok(detailById.has(id), `Missing representative detail page ${id}`);
}
assert.match(
  detailById.get("file-access"),
  /sample-media\/file-access\/hero\.png/,
);
const fileAccessHero = detailById
  .get("file-access")
  .slice(
    detailById.get("file-access").indexOf('<section class="detail-hero"'),
    detailById
      .get("file-access")
      .indexOf(
        "</section>",
        detailById.get("file-access").indexOf('<section class="detail-hero"'),
      ),
  );
assert.doesNotMatch(
  fileAccessHero,
  /class="detail-visual-fallback/,
);
assert.match(
  detailById.get("winui-gallery--button--c065a8f484b9"),
  /A simple Button with text content/,
);
assert.match(
  detailById.get("winui-gallery--color--e03b2aead598"),
  /Upstream special section/,
);
assert.doesNotMatch(
  detailById.get("windows-app-sdk-samples--secure-ui--174d4739093c"),
  /class="detail-summary"/,
);

const mediaExtension = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
]);
const expectedMediaPaths = catalog.samples.flatMap((sample) =>
  (sample.federated?.record.images ?? []).map((image) => {
    const extension = mediaExtension.get(image.mediaType);
    assert.ok(extension, `Unsupported generated media type ${image.mediaType}`);
    return `sample-media/${sample.id}/${image.id}.${extension}`;
  }),
);
expectedMediaPaths.push(
  ...[...localHeroById].map(
    ([sampleId, hero]) =>
      `sample-media/${sampleId}/${hero.filename}`,
  ),
);
const mediaFiles = await collectFiles(path.join(distRoot, "sample-media"));
assert.deepEqual(
  mediaFiles.map(relativeOutputPath).sort(),
  expectedMediaPaths.sort(),
  "Static media routes do not exactly match the normalized catalog.",
);
assert.equal(mediaFiles.length, 170);

for (const htmlPath of htmlFiles) {
  const html = await readFile(htmlPath, "utf8");
  const htmlSize = (await stat(htmlPath)).size;
  const htmlLimit =
    htmlPath === browsePath ? 650 * 1024 : 1024 * 1024;
  assert.ok(
    htmlSize <= htmlLimit,
    `${path.relative(distRoot, htmlPath)} is ${(htmlSize / 1024).toFixed(1)} KiB`,
  );
  assert.match(html, /<main\b[^>]*\bid="main-content"/, htmlPath);
  assert.equal(
    (html.match(/<main\b/g) ?? []).length,
    1,
    `Expected one main landmark in ${path.relative(distRoot, htmlPath)}`,
  );
  assert.doesNotMatch(html, /(?:src|href)=["']["']/, htmlPath);
  assert.doesNotMatch(
    html,
    /\bsrc=["']https?:\/\//i,
    `Runtime external asset in ${relativeOutputPath(htmlPath)}`,
  );
  assert.doesNotMatch(
    html,
    /(?:ghp|github_pat)_[A-Za-z0-9_]+|Bearer\s+[A-Za-z0-9._-]+/,
    `Credential-like content in ${relativeOutputPath(htmlPath)}`,
  );

  for (const image of html.matchAll(/<img\b[^>]*>/g)) {
    const alt = /\balt=(["'])(.*?)\1/.exec(image[0]);
    assert.ok(alt, `Image has no alt attribute in ${relativeOutputPath(htmlPath)}`);
    if (alt[2] === "") {
      assert.match(
        image[0],
        /\baria-hidden=["']true["']|\brole=["']presentation["']/,
        `Decorative image is not hidden in ${relativeOutputPath(htmlPath)}`,
      );
    } else {
      assert.doesNotMatch(
        image[0],
        /\baria-hidden=["']true["']/,
        `Informative image is hidden in ${relativeOutputPath(htmlPath)}`,
      );
    }
  }

  for (const attribute of html.matchAll(
    /\b(?:href|src)=["']([^"'#]+)["']/g,
  )) {
    const urlValue = attribute[1];
    if (!urlValue) {
      continue;
    }
    const outputPath = localOutputPath(urlValue);
    if (outputPath) {
      assert.equal(
        await fileExists(outputPath),
        true,
        `Broken local URL ${urlValue} in ${path.relative(distRoot, htmlPath)}`,
      );
    } else if (urlValue.startsWith("/")) {
      assert.fail(
        `Root-relative URL bypasses the ${basePath} base: ${urlValue} in ${path.relative(
          distRoot,
          htmlPath,
        )}`,
      );
    }
  }
}

const browseSize = (await stat(browsePath)).size;
const assetRoot = path.join(distRoot, "_astro");
const jsFiles = await collectFiles(assetRoot, ".js");
const cssFiles = await collectFiles(assetRoot, ".css");
const landingScripts = await staticScriptDependencies(
  scriptAssetNames(landingHtml),
);
const browseScripts = await staticScriptDependencies(
  scriptAssetNames(browseHtml),
);
const initialLandingGzip =
  (await scriptGzipSize(landingScripts)) +
  inlineScriptGzipSize(landingHtml);
const browseJavaScriptGzip =
  (await scriptGzipSize(browseScripts)) +
  inlineScriptGzipSize(browseHtml);
let lazyThreeGzip = 0;
let cssGzip = 0;
let cssText = "";
let fallbackJavaScript = landingHtml + browseHtml;

for (const assetPath of jsFiles) {
  const size = (await stat(assetPath)).size;
  const contents = await readFile(assetPath);
  fallbackJavaScript += contents.toString("utf8");
  assert.doesNotMatch(
    contents.toString("utf8"),
    /api\.github\.com|raw\.githubusercontent\.com|fetch\(\s*["']https?:/i,
    `Runtime upstream request in ${relativeOutputPath(assetPath)}`,
  );
  const gzipSize = gzipSync(contents, { level: 9 }).length;
  const filename = path.basename(assetPath);
  if (filename.startsWith("three-stage.")) {
    lazyThreeGzip += gzipSize;
  }
  assert.ok(
    size <= 350 * 1024 || filename.startsWith("three-stage."),
    `${filename} is ${(size / 1024).toFixed(1)} KiB`,
  );
}

assert.match(fallbackJavaScript, /saveData/);
assert.match(fallbackJavaScript, /prefers-reduced-motion: reduce/);
assert.match(fallbackJavaScript, /forced-colors: active/);
assert.match(fallbackJavaScript, /SHA-256/);
assert.match(fallbackJavaScript, /force-cache/);

for (const assetPath of cssFiles) {
  const contents = await readFile(assetPath);
  cssText += contents.toString("utf8");
  assert.doesNotMatch(
    contents.toString("utf8"),
    /url\(\s*["']?https?:/i,
    `Runtime external CSS asset in ${relativeOutputPath(assetPath)}`,
  );
  cssGzip += gzipSync(contents, { level: 9 }).length;
}

assert.match(
  cssText,
  /font-size:\s*clamp\(2\.5rem,\s*4\.8vw,\s*4\.65rem\)/,
);
assert.match(cssText, /aspect-ratio:\s*16\s*\/\s*10/);
assert.match(cssText, /object-fit:\s*contain/);
assert.doesNotMatch(cssText, /\.detail-visual-image[^}]*object-fit:\s*cover/);

const favicon = await readFile(path.join(distRoot, "favicon.svg"), "utf8");
assert.match(favicon, /<title>Windows App Samples Browser<\/title>/);

assert.ok(
  initialLandingGzip <= 70 * 1024,
  `Initial landing JavaScript is ${(initialLandingGzip / 1024).toFixed(1)} KiB gzip`,
);
assert.ok(
  lazyThreeGzip <= 132 * 1024,
  `Lazy Three JavaScript is ${(lazyThreeGzip / 1024).toFixed(1)} KiB gzip`,
);
assert.ok(
  browseJavaScriptGzip <= 80 * 1024,
  `Browse JavaScript is ${(browseJavaScriptGzip / 1024).toFixed(1)} KiB gzip`,
);
assert.ok(
  cssGzip <= 80 * 1024,
  `Site CSS is ${(cssGzip / 1024).toFixed(1)} KiB gzip`,
);

console.log(
  [
    `Static smoke passed: ${catalog.samples.length} records, ${htmlFiles.length} HTML routes (${codeRouteCount} code), ${mediaFiles.length} media routes.`,
    `${(initialLandingGzip / 1024).toFixed(1)} KiB initial landing JS gzip;`,
    `${(lazyThreeGzip / 1024).toFixed(1)} KiB lazy Three JS gzip;`,
    `${(browseJavaScriptGzip / 1024).toFixed(1)} KiB Browse JS gzip;`,
    `${(cssGzip / 1024).toFixed(1)} KiB CSS gzip;`,
    `${(browseSize / 1024).toFixed(1)} KiB Browse HTML;`,
    `${(browseIndexBytes.length / 1024).toFixed(1)} KiB Browse index (${(
      gzipSync(browseIndexBytes, { level: 9 }).length / 1024
    ).toFixed(1)} KiB gzip).`,
  ].join(" "),
);
