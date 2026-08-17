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
const activityPath = path.join(
  siteRoot,
  "src",
  "generated",
  "sample-activity.json",
);
const basePath = "/winui-samples/";

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

const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
const activity = JSON.parse(await readFile(activityPath, "utf8"));
const browsePath = path.join(distRoot, "samples", "index.html");
const browseHtml = await readFile(browsePath, "utf8");
const landingPath = path.join(distRoot, "index.html");
const landingHtml = await readFile(landingPath, "utf8");

assert.match(browseHtml, /<main\b[^>]*\bid="main-content"/);
assert.match(browseHtml, /aria-live="polite"/);
assert.match(browseHtml, /Browse samples/);
assert.match(browseHtml, /Declared package capabilities/);
assert.doesNotMatch(browseHtml, /(?:New|Updated)\s*(?:first|recent)/i);

const landingSections = [
  'id="hero-title"',
  'id="stage-title"',
  'id="activity-title"',
  'id="featured-title"',
  'id="outcomes-title"',
  'id="get-started-title"',
  'id="contribute-title"',
];
let previousSectionIndex = -1;
for (const section of landingSections) {
  const sectionIndex = landingHtml.indexOf(section);
  assert.ok(sectionIndex > previousSectionIndex, `Landing section order: ${section}`);
  previousSectionIndex = sectionIndex;
}
assert.match(landingHtml, />71<\/dt>/);
assert.match(landingHtml, />105<\/dt>/);
if (activity.entries.length === 0) {
  assert.match(landingHtml, /The next shipment will appear here/);
  assert.match(landingHtml, /No placeholder dates or invented releases/);
} else {
  assert.match(landingHtml, /class="activity-list"/);
  for (const entry of activity.entries) {
    assert.match(
      landingHtml,
      new RegExp(`PR #${entry.pullRequest.number}\\b`),
      `Missing activity PR #${entry.pullRequest.number}`,
    );
  }
}
assert.doesNotMatch(
  landingHtml,
  /(?:ghp|github_pat)_[A-Za-z0-9_]+|Bearer\s+[A-Za-z0-9._-]+/,
);

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
  assert.match(detailHtml, /<aside[^>]*class="sample-facts/);
  assert.match(detailHtml, /Declared package capabilities/);
  assert.match(detailHtml, /Actual prerequisites/);
  assert.match(detailHtml, /Browse featured code/);
  assert.match(
    detailHtml,
    new RegExp(
      `github\\.com/niels9001/winui-samples/tree/main/${sample.project.repositoryPath.replaceAll(
        "/",
        "\\/",
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
    assert.match(codeHtml, /Featured implementation/);
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
assert.ok(
  htmlFiles.length >= catalog.samples.length + 2,
  "Expected browse, detail, and code HTML output.",
);

for (const htmlPath of htmlFiles) {
  const html = await readFile(htmlPath, "utf8");
  const htmlSize = (await stat(htmlPath)).size;
  const htmlLimit = htmlPath === browsePath ? 2 * 1024 * 1024 : 1024 * 1024;
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
assert.ok(
  browseSize <= 669_000,
  `Browse HTML is ${(browseSize / 1024).toFixed(1)} KiB`,
);

const assetFiles = await collectFiles(path.join(distRoot, "_astro"), ".js");
let initialLandingGzip = 0;
let lazyThreeGzip = 0;
for (const assetPath of assetFiles) {
  const size = (await stat(assetPath)).size;
  const contents = await readFile(assetPath);
  const gzipSize = gzipSync(contents, { level: 9 }).length;
  const filename = path.basename(assetPath);
  if (filename.startsWith("three-stage.")) {
    lazyThreeGzip += gzipSize;
  } else if (!filename.startsWith("SampleExplorer.")) {
    initialLandingGzip += gzipSize;
  }
  assert.ok(
    size <= 350 * 1024 || filename.startsWith("three-stage."),
    `${filename} is ${(size / 1024).toFixed(1)} KiB`,
  );
}
assert.ok(
  initialLandingGzip < 180 * 1024,
  `Initial landing JavaScript is ${(initialLandingGzip / 1024).toFixed(1)} KiB gzip`,
);
assert.ok(
  lazyThreeGzip < 180 * 1024,
  `Lazy Three JavaScript is ${(lazyThreeGzip / 1024).toFixed(1)} KiB gzip`,
);

console.log(
  `Static smoke passed: ${catalog.samples.length} samples, ${htmlFiles.length} HTML routes, ${(initialLandingGzip / 1024).toFixed(1)} KiB initial landing JS, ${(lazyThreeGzip / 1024).toFixed(1)} KiB lazy Three JS.`,
);
