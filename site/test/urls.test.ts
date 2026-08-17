import assert from "node:assert/strict";
import test from "node:test";

import { withBasePath } from "../src/lib/base-path";
import {
  repositoryBlobUrl,
  repositoryReadmeUrl,
  repositoryTreeUrl,
  sampleCodePath,
  sampleDetailPath,
} from "../src/lib/urls";

test("creates main-branch source and README URLs with encoded segments", () => {
  assert.equal(
    repositoryTreeUrl("Samples/File Access"),
    "https://github.com/niels9001/winui-samples/tree/main/Samples/File%20Access",
  );
  assert.equal(
    repositoryBlobUrl("Samples/File Access", "Scenarios/Create #1.cs"),
    "https://github.com/niels9001/winui-samples/blob/main/Samples/File%20Access/Scenarios/Create%20%231.cs",
  );
  assert.equal(
    repositoryReadmeUrl("Samples/FileAccess"),
    "https://github.com/niels9001/winui-samples/blob/main/Samples/FileAccess/README.md",
  );
});

test("rejects repository traversal", () => {
  assert.throws(
    () => repositoryTreeUrl("Samples/../secrets"),
    /traversal segments/,
  );
  assert.throws(
    () => repositoryBlobUrl("Samples/FileAccess", "../outside.cs"),
    /traversal segments/,
  );
});

test("preserves the GitHub Pages base for detail and code routes", () => {
  assert.equal(
    withBasePath(sampleDetailPath("file-access"), "/winui-samples"),
    "/winui-samples/samples/file-access/",
  );
  assert.equal(
    withBasePath(
      sampleCodePath("file-access", "01-main-page"),
      "/winui-samples",
    ),
    "/winui-samples/samples/file-access/code/01-main-page/",
  );
});
