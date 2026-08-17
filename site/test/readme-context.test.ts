import assert from "node:assert/strict";
import test from "node:test";

import { extractReadmeSection } from "../src/lib/readme-context";

test("extracts and sanitizes authored README migration sections", () => {
  const markdown = `# Sample

## Migration notes

Uses the \`FileOpenPicker\` from [Windows App SDK](https://example.com).

- Keeps the existing scenario flow.

## Known differences / limitations

None.
`;

  assert.equal(
    extractReadmeSection(markdown, "Migration notes"),
    "Uses the FileOpenPicker from Windows App SDK.\nKeeps the existing scenario flow.",
  );
  assert.equal(
    extractReadmeSection(markdown, "Known differences / limitations"),
    "None.",
  );
  assert.equal(
    extractReadmeSection(markdown, "Missing section"),
    undefined,
  );
});
