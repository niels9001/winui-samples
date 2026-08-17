import assert from "node:assert/strict";
import test from "node:test";

import { normalizeBasePath, withBasePath } from "../src/lib/base-path";

test("normalizes the GitHub Pages base path", () => {
  assert.equal(normalizeBasePath("/winui-samples"), "/winui-samples/");
  assert.equal(normalizeBasePath("/winui-samples/"), "/winui-samples/");
  assert.equal(normalizeBasePath("/"), "/");
});

test("prefixes routes, fragments, and assets without changing their shape", () => {
  assert.equal(withBasePath("/", "/winui-samples"), "/winui-samples/");
  assert.equal(
    withBasePath("/samples/", "/winui-samples"),
    "/winui-samples/samples/",
  );
  assert.equal(
    withBasePath("/#get-started", "/winui-samples/"),
    "/winui-samples/#get-started",
  );
  assert.equal(
    withBasePath("/favicon.svg", "/winui-samples"),
    "/winui-samples/favicon.svg",
  );
});

test("rejects absolute and protocol-relative inputs", () => {
  assert.throws(
    () => withBasePath("https://example.com", "/winui-samples"),
    /root-relative/,
  );
  assert.throws(
    () => withBasePath("//example.com", "/winui-samples"),
    /root-relative/,
  );
});
