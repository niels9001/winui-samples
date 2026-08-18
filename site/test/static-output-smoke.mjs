import assert from "node:assert/strict";
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
const distRoot = path.join(siteRoot, "dist");
const catalogPath = path.join(
  siteRoot,
  "src",
  "generated",
  "sample-catalog.json",
);
const basePath = "/winui-samples/";

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function featuredFileKey(file, index) {
  const slug = file.path
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${String(index + 1).padStart(2, "0")}-${slug}`;
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
    } else if (entry.isFile() && entry.name.endsWith(extension)) {
      files.push(entryPath);
    }
  }

  return files;
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
    /href=["'][^"']*README\.md/i,
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
const originalSourceCount = new Set(
  catalog.samples.flatMap((sample) =>
    sample.originalSamples.map((original) => original.url),
  ),
).size;
const browsePath = path.join(distRoot, "samples", "index.html");
const browseHtml = await readFile(browsePath, "utf8");
const landingPath = path.join(distRoot, "index.html");
const landingHtml = await readFile(landingPath, "utf8");

assert.match(browseHtml, /<main\b[^>]*\bid="main-content"/);
assert.match(browseHtml, /aria-live="polite"/);
assert.match(browseHtml, /Browse Windows app code/);
assert.match(browseHtml, /WinUI samples/);
assert.match(browseHtml, /<noscript>/);
assert.match(browseHtml, /Every current title remains available below/);
assert.doesNotMatch(browseHtml, /readinessSelector|screenshot-recipes|pullRequest/);
assertDeveloperChrome(browseHtml, "Browse");

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
assert.match(landingHtml, /data-showcase-stage/);
assert.match(landingHtml, /Windows code workspace/);
assert.match(landingHtml, /Search by outcome or API/);
assert.match(
  landingHtml,
  new RegExp(
    `<strong[^>]*>${catalog.coverage.totalProjects} buildable projects<\\/strong><span[^>]*>drawn from ${originalSourceCount}`,
  ),
);
assert.doesNotMatch(landingHtml, /sample-activity|pullRequest|contribute-title/);
assert.doesNotMatch(
  landingHtml,
  /(?:ghp|github_pat)_[A-Za-z0-9_]+|Bearer\s+[A-Za-z0-9._-]+/,
);
assertDeveloperChrome(landingHtml, "Landing");

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

  const detailHtml = await readFile(detailPath, "utf8");
  assertDeveloperChrome(detailHtml, sample.id);
  assert.match(detailHtml, /WinUI samples/);
  assertOrdered(
    detailHtml,
    [
      'id="overview"',
      'id="run"',
      'id="scenarios"',
      'id="apis"',
      'id="code"',
      'id="requirements"',
      'id="limitations"',
      'id="resources"',
      'id="related-title"',
    ],
    `${sample.id} documentation order`,
  );
  assert.doesNotMatch(detailHtml, /class="sample-facts/);
  assert.match(detailHtml, /Build and launch from a local checkout/);
  assert.match(detailHtml, /aria-label="Copy [^"]+ build commands"/);
  assert.match(detailHtml, /data-copy-control/);
  assert.match(detailHtml, /Source and documentation/);
  assert.match(detailHtml, /Related projects/);
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

  for (const [index, file] of sample.featuredFiles.entries()) {
    const key = featuredFileKey(file, index);
    const codePath = path.join(
      distRoot,
      "samples",
      sample.id,
      "code",
      key,
      "index.html",
    );
    assert.equal(
      await fileExists(codePath),
      true,
      `Missing code route for ${sample.id}/${file.path}`,
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
    assert.match(
      codeHtml,
      /github\.com\/niels9001\/winui-samples\/blob\/main\//,
    );
  }
}

const htmlFiles = await collectFiles(distRoot, ".html");
assert.equal(htmlFiles.length, 427, "Expected the complete 427-route site.");

for (const htmlPath of htmlFiles) {
  const html = await readFile(htmlPath, "utf8");
  const htmlSize = (await stat(htmlPath)).size;
  const htmlLimit = htmlPath === browsePath ? 500_000 : 1024 * 1024;
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

  for (const image of html.matchAll(/<img\b[^>]*>/g)) {
    assert.match(image[0], /\balt=["'][^"']*["']/, htmlPath);
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
let initialLandingGzip = 0;
let browseJavaScriptGzip = 0;
let lazyThreeGzip = 0;
let cssGzip = 0;
let fallbackJavaScript = "";

for (const assetPath of jsFiles) {
  const size = (await stat(assetPath)).size;
  const contents = await readFile(assetPath);
  fallbackJavaScript += contents.toString("utf8");
  const gzipSize = gzipSync(contents, { level: 9 }).length;
  const filename = path.basename(assetPath);
  if (filename.startsWith("three-stage.")) {
    lazyThreeGzip += gzipSize;
  } else if (filename.startsWith("SampleExplorer.")) {
    browseJavaScriptGzip += gzipSize;
  } else {
    initialLandingGzip += gzipSize;
  }
  assert.ok(
    size <= 350 * 1024 || filename.startsWith("three-stage."),
    `${filename} is ${(size / 1024).toFixed(1)} KiB`,
  );
}

assert.match(fallbackJavaScript, /saveData/);
assert.match(fallbackJavaScript, /prefers-reduced-motion: reduce/);
assert.match(fallbackJavaScript, /forced-colors: active/);

for (const assetPath of cssFiles) {
  cssGzip += gzipSync(await readFile(assetPath), { level: 9 }).length;
}

assert.ok(
  initialLandingGzip <= 130 * 1024,
  `Initial landing JavaScript is ${(initialLandingGzip / 1024).toFixed(1)} KiB gzip`,
);
assert.ok(
  lazyThreeGzip <= 132 * 1024,
  `Lazy Three JavaScript is ${(lazyThreeGzip / 1024).toFixed(1)} KiB gzip`,
);
assert.ok(
  browseJavaScriptGzip <= 70 * 1024,
  `Browse JavaScript is ${(browseJavaScriptGzip / 1024).toFixed(1)} KiB gzip`,
);
assert.ok(
  cssGzip <= 80 * 1024,
  `Site CSS is ${(cssGzip / 1024).toFixed(1)} KiB gzip`,
);

console.log(
  [
    `Static smoke passed: ${catalog.samples.length} records, ${htmlFiles.length} HTML routes.`,
    `${(initialLandingGzip / 1024).toFixed(1)} KiB initial landing JS gzip;`,
    `${(lazyThreeGzip / 1024).toFixed(1)} KiB lazy Three JS gzip;`,
    `${(browseJavaScriptGzip / 1024).toFixed(1)} KiB Browse JS gzip;`,
    `${(cssGzip / 1024).toFixed(1)} KiB CSS gzip;`,
    `${(browseSize / 1024).toFixed(1)} KiB Browse HTML.`,
  ].join(" "),
);
