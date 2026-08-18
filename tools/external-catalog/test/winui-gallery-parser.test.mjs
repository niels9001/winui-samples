import assert from "node:assert/strict";
import test from "node:test";

import { createArtifactReader } from "../lib/cache.mjs";
import { loadExternalState } from "../lib/config.mjs";
import {
  findExactGitEntry,
} from "../lib/guards.mjs";
import { repositoryRoot } from "../lib/schema.mjs";
import {
  CATALOG_PATH,
  UPSTREAM_SCHEMA_PATH,
} from "../providers/winui-gallery/constants.mjs";
import {
  parsePinnedUpstreamSchema,
  resolveImagePath,
  validateAndFlattenCatalog,
  validateUpstreamSchema,
} from "../providers/winui-gallery/catalog.mjs";
import {
  decodeUtf8,
  parseControlExamples,
  parseSampleDefinition,
} from "../providers/winui-gallery/parser.mjs";

const documentsPromise = (async () => {
  const state = await loadExternalState();
  const lock = state.locks.get("winui-gallery");
  const readArtifact = createArtifactReader(state, lock, {
    repoRoot: repositoryRoot,
  });
  const [catalogBytes, schemaBytes] = await Promise.all([
    readArtifact(CATALOG_PATH),
    readArtifact(UPSTREAM_SCHEMA_PATH),
  ]);
  return {
    catalog: JSON.parse(decodeUtf8(catalogBytes, CATALOG_PATH)),
    schemaSource: decodeUtf8(schemaBytes, UPSTREAM_SCHEMA_PATH),
  };
})();

test("pinned upstream schema has one reviewed trailing comma and known omissions", async () => {
  const { schemaSource } = await documentsPromise;
  assert.throws(() => JSON.parse(schemaSource), SyntaxError);
  const schema = parsePinnedUpstreamSchema(schemaSource);
  assert.deepEqual(validateUpstreamSchema(schema), {
    underSpecifiedFields: ["BaseClasses", "SourcePath"],
    defaultsAreDescriptiveOnly: true,
  });
  assert.throws(
    () =>
      validateUpstreamSchema(
        parsePinnedUpstreamSchema(
          schemaSource.replace('"Tags":', '"Extra": {},\n"Tags":'),
        ),
      ),
    /property set drifted/,
  );
  assert.throws(
    () => parsePinnedUpstreamSchema(schemaSource.replace(/\}\s*$/, "},\n}")),
    /exactly one reviewed trailing comma/,
  );
});

test("catalog validation rejects unknown fields, duplicates, and dangling relations", async () => {
  const { catalog } = await documentsPromise;

  const unknown = structuredClone(catalog);
  unknown.Groups[0].Items[0].UnknownImporterField = true;
  assert.throws(
    () => validateAndFlattenCatalog(unknown),
    /unknown fields: UnknownImporterField/,
  );

  const duplicate = structuredClone(catalog);
  duplicate.Groups[0].Items[1].UniqueId =
    duplicate.Groups[0].Items[0].UniqueId;
  assert.throws(
    () => validateAndFlattenCatalog(duplicate),
    /duplicate global UniqueId/,
  );

  const dangling = structuredClone(catalog);
  dangling.Groups[0].Items[0].RelatedControls = ["MissingPage"];
  assert.throws(
    () => validateAndFlattenCatalog(dangling),
    /dangling RelatedControls/,
  );
});

test("absent booleans deserialize false without applying schema defaults", async () => {
  const { catalog } = await documentsPromise;
  const pages = validateAndFlattenCatalog(catalog);
  const button = pages.find((page) => page.UniqueId === "Button");
  assert.equal(Object.hasOwn(catalog.Groups.flatMap((group) => group.Items).find(
    (item) => item.UniqueId === "Button",
  ), "IsNew"), false);
  assert.equal(button.IsNew, false);
  assert.equal(button.IsUpdated, false);
  assert.equal(button.group.IsSpecialSection, false);

  const resources = pages.find((page) => page.UniqueId === "XamlResources");
  assert.equal(resources.IsNew, true);
  assert.equal(resources.group.IsSpecialSection, true);
});

test("under-specified BaseClasses and SourcePath remain accepted authored fields", async () => {
  const { catalog } = await documentsPromise;
  const pages = validateAndFlattenCatalog(catalog);
  const button = pages.find((page) => page.UniqueId === "Button");
  assert.deepEqual(button.BaseClasses, [
    "Object",
    "DependencyObject",
    "UIElement",
    "FrameworkElement",
    "Control",
    "ContentControl",
    "ButtonBase",
  ]);
  assert.equal(
    button.SourcePath,
    "/CommonStyles/Button_themeresources.xaml",
  );
});

test("image resolution applies only the two reviewed exact-case corrections", () => {
  assert.deepEqual(
    resolveImagePath(
      "ms-appx:///Assets/ControlImages/CheckBox.png",
      "CheckBox.ImagePath",
    ),
    {
      authoredPath: "WinUIGallery/Assets/ControlImages/CheckBox.png",
      resolvedPath: "WinUIGallery/Assets/ControlImages/Checkbox.png",
      caseCorrected: true,
    },
  );
  assert.equal(
    resolveImagePath(
      "ms-appx:///Assets/ControlImages/Button.png",
      "Button.ImagePath",
    ).caseCorrected,
    false,
  );
  const entries = [
    {
      path: "WinUIGallery/Assets/ControlImages/Checkbox.png",
      mode: "100644",
      type: "blob",
    },
  ];
  assert.throws(
    () =>
      findExactGitEntry(
        entries,
        "WinUIGallery/Assets/ControlImages/CheckBox.png",
      ),
    /casing mismatch/,
  );
});

test("SampleDefinition parser accepts exactly the four observed combinations", () => {
  const fixtures = {
    "header+xaml+c#": "--- header\nBoth\n--- xaml\n<Button />\n--- c#\nnew Button();",
    "header+xaml": "--- header\nMarkup\n--- xaml\n<Button />",
    "header+c#": "--- header\nCode\n--- c#\nnew Button();",
    header: "--- header\nHeader only",
  };
  for (const [combination, source] of Object.entries(fixtures)) {
    assert.equal(
      parseSampleDefinition(source, combination).combination,
      combination,
    );
  }
  assert.throws(
    () => parseSampleDefinition("--- header\nA\n--- javascript\nB"),
    /unknown section/,
  );
  assert.throws(
    () => parseSampleDefinition("--- xaml\n<Button />"),
    /header section is required/,
  );
});

test("comments and inline examples never create phantom SampleDefinitions", () => {
  const source = `
    <!-- <controls:ControlExample SampleDefinition="Fake\\Comment.txt"> -->
    <controls:ControlExample>
      <controls:ControlExample.Example>
        <TextBlock Text="SampleDefinition=&quot;Fake\\Inline.txt&quot;" />
      </controls:ControlExample.Example>
    </controls:ControlExample>
    <controls:ControlExample
      SampleDefinition="Button\\ButtonSimple.txt">
    </controls:ControlExample>
  `;
  assert.deepEqual(parseControlExamples(source), [
    { position: 1, sampleDefinition: null },
    {
      position: 2,
      sampleDefinition: "Button/ButtonSimple.txt",
    },
  ]);
});

test("catalog retains the one Store URI as a non-web authored document", async () => {
  const { catalog } = await documentsPromise;
  const pages = validateAndFlattenCatalog(catalog);
  const storeDocuments = pages.flatMap((page) =>
    page.Docs
      .filter((document) => document.Uri.startsWith("ms-windows-store:"))
      .map((document) => ({ recordKey: page.UniqueId, ...document })),
  );
  assert.deepEqual(storeDocuments, [
    {
      recordKey: "AnimatedVisualPlayer",
      Title: "Full Samples",
      Uri: "ms-windows-store://pdp/?productid=9N3J5TG8FF7F",
    },
  ]);
});
