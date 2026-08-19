import assert from "node:assert/strict";
import test from "node:test";

import {
  extractReadmeSection,
  removePortingOnlyProse,
} from "../src/lib/readme-context";

test("extracts and sanitizes authored limitation sections", () => {
  const markdown = `# Sample

## Migration notes

Uses the \`FileOpenPicker\` from [Windows App SDK](https://example.com).

- Keeps the existing scenario flow.

## Known differences / limitations

None.
`;

  assert.equal(
    extractReadmeSection(markdown, "Known differences / limitations"),
    "None.",
  );
  assert.equal(
    extractReadmeSection(markdown, "Missing section"),
    undefined,
  );
});

test("removes porting history while preserving useful limitations", () => {
  assert.equal(
    removePortingOnlyProse(
      "This sample was ported from UWP. A camera is required. ARM64 is not supported.",
    ),
    "A camera is required. ARM64 is not supported.",
  );
  assert.equal(
    removePortingOnlyProse("The original UWP implementation was replaced."),
    undefined,
  );
});

test("joins hard-wrapped prose before removing platform history", () => {
  const markdown = `## Known differences / limitations

- The source UWP sample uses a roaming folder. The API remains available, but
  roaming settings are no longer supported on Windows 11.
- This port keeps the scenario for API compatibility.
- A camera is required.
`;
  const extracted = extractReadmeSection(
    markdown,
    "Known differences / limitations",
  );
  assert.equal(
    extracted,
    "The source UWP sample uses a roaming folder. The API remains available, but roaming settings are no longer supported on Windows 11.\nThis port keeps the scenario for API compatibility.\nA camera is required.",
  );
  assert.equal(
    removePortingOnlyProse(extracted ?? ""),
    "The API remains available, but roaming settings are no longer supported on Windows 11. A camera is required.",
  );
});

test("rewrites current limitations that contain historical framing", () => {
  assert.equal(
    removePortingOnlyProse(
      "Closing the desktop app ends playback because there is no UWP background task in this port.",
    ),
    "Closing the desktop app ends playback.",
  );
  assert.equal(
    removePortingOnlyProse(
      "The UWP display-orientation behavior is not reproduced because its current-view DisplayInformation path is unavailable.",
    ),
    "Display-orientation handling is unavailable because the current-view DisplayInformation path cannot be used by the desktop app.",
  );
});

test("preserves active association-launching constraints without migration framing", () => {
  const limitations = [
    'The UWP "Launch with view preference" (split-screen) options, which relied on LauncherOptions.DesiredRemainingView, are dropped.',
    "Those APIs target the UWP single-window/tablet model and have no desktop equivalent.",
    "The UWP appUriHandler (associating an https:// domain with the app) is dropped; it requires a verified domain.",
    "Only the custom alsdk: scheme is registered.",
    "The Open With dialog is requested with LauncherOptions.DisplayApplicationPicker; the UWP positioning hints, which are CoreWindow-relative, are not set.",
  ].join("\n");

  const cleaned = removePortingOnlyProse(limitations);
  assert.equal(
    cleaned,
    '"Launch with view preference" (split-screen) options are unavailable. The required view-management APIs have no desktop equivalent. HTTPS app URI handling requires a verified domain and is not enabled. Only the custom alsdk: scheme is registered. The Open With dialog does not set CoreWindow-relative positioning hints.',
  );
  assert.doesNotMatch(cleaned ?? "", /\b(?:UWP|migration|port(?:ed|ing)?)\b/i);
});
