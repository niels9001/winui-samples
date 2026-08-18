import {
  CATALOG_DOC_FIELDS,
  CATALOG_GROUP_FIELDS,
  CATALOG_ITEM_FIELDS,
  CATALOG_ROOT_FIELDS,
  EXPECTED,
  IMAGE_PATH_CASE_OVERRIDES,
  OBSERVED_DEFINITION_COMBINATIONS,
  SCHEMA_ITEM_FIELDS,
} from "./constants.mjs";

function fail(context, message) {
  throw new Error(`${context}: ${message}`);
}

function isPlainObject(value) {
  return Boolean(
    value &&
    typeof value === "object" &&
    !Array.isArray(value),
  );
}

function assertObject(value, context) {
  if (!isPlainObject(value)) {
    fail(context, "must be an object");
  }
}

function assertExactFields(value, allowedFields, context) {
  assertObject(value, context);
  const allowed = new Set(allowedFields);
  const unknown = Object.keys(value).filter((field) => !allowed.has(field));
  if (unknown.length > 0) {
    fail(context, `unknown fields: ${unknown.sort().join(", ")}`);
  }
}

function assertString(value, context) {
  if (typeof value !== "string" || value.length === 0) {
    fail(context, "must be a non-empty string");
  }
  if (
    value.includes("\0") ||
    /[\u0001-\u0008\u000B\u000C\u000E-\u001F]/.test(value)
  ) {
    fail(context, "contains unsafe control characters");
  }
}

function assertOptionalString(value, context) {
  if (value !== undefined) {
    assertString(value, context);
  }
}

function assertBoolean(value, context) {
  if (value !== undefined && typeof value !== "boolean") {
    fail(context, "must be a boolean when present");
  }
}

function assertUniqueStringArray(value, context) {
  if (!Array.isArray(value)) {
    fail(context, "must be an array");
  }
  const seen = new Set();
  value.forEach((item, index) => {
    assertString(item, `${context}[${index}]`);
    if (seen.has(item)) {
      fail(context, `duplicate value ${JSON.stringify(item)}`);
    }
    seen.add(item);
  });
}

function sameValues(actual, expected) {
  return (
    actual.length === expected.length &&
    [...actual].sort().every(
      (value, index) => value === [...expected].sort()[index],
    )
  );
}

export function parsePinnedUpstreamSchema(source) {
  let result = "";
  let quote = null;
  let escaped = false;
  let removedTrailingCommas = 0;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quote !== null) {
      result += character;
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === quote) {
        quote = null;
      }
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      result += character;
      continue;
    }
    if (character === ",") {
      let lookahead = index + 1;
      while (/\s/.test(source[lookahead] ?? "")) {
        lookahead += 1;
      }
      if (source[lookahead] === "}" || source[lookahead] === "]") {
        removedTrailingCommas += 1;
        continue;
      }
    }
    result += character;
  }

  if (removedTrailingCommas !== 1) {
    fail(
      "upstream schema",
      `expected exactly one reviewed trailing comma, received ${removedTrailingCommas}`,
    );
  }
  try {
    return JSON.parse(result);
  } catch (error) {
    fail(
      "upstream schema",
      `cannot parse after the reviewed trailing-comma repair: ${error.message}`,
    );
  }
}

export function validateUpstreamSchema(schema) {
  assertObject(schema, "upstream schema");
  if (schema.$schema !== "http://json-schema.org/draft-04/schema#") {
    fail("upstream schema", "unexpected JSON Schema dialect");
  }
  const groupSchema = schema.properties?.Groups?.items;
  const itemSchema = groupSchema?.properties?.Items?.items;
  if (!groupSchema || !itemSchema) {
    fail("upstream schema", "Groups/Items definitions are absent");
  }
  const groupFields = Object.keys(groupSchema.properties ?? {});
  const itemFields = Object.keys(itemSchema.properties ?? {});
  if (!sameValues(groupFields, CATALOG_GROUP_FIELDS)) {
    fail("upstream schema", "group property set drifted");
  }
  if (!sameValues(itemFields, SCHEMA_ITEM_FIELDS)) {
    fail("upstream schema", "item property set drifted");
  }
  if (
    itemSchema.properties.IsNew?.default !== true ||
    itemSchema.properties.IsUpdated?.default !== true ||
    groupSchema.properties.IsSpecialSection?.default !== true
  ) {
    fail("upstream schema", "observed boolean defaults drifted");
  }
  if (
    Object.hasOwn(itemSchema.properties, "BaseClasses") ||
    Object.hasOwn(itemSchema.properties, "SourcePath")
  ) {
    fail(
      "upstream schema",
      "expected BaseClasses and SourcePath to remain under-specified at this pin",
    );
  }
  return {
    underSpecifiedFields: ["BaseClasses", "SourcePath"],
    defaultsAreDescriptiveOnly: true,
  };
}

export function authoredImagePath(imageUri, context) {
  const prefix = "ms-appx:///Assets/ControlImages/";
  if (
    typeof imageUri !== "string" ||
    !imageUri.startsWith(prefix) ||
    !imageUri.endsWith(".png")
  ) {
    fail(context, "must be an ms-appx ControlImages PNG URI");
  }
  const relative = imageUri.slice("ms-appx:///".length);
  if (
    relative.includes("\\") ||
    relative.includes("//") ||
    relative.split("/").some((segment) => segment === "." || segment === "..")
  ) {
    fail(context, "contains an unsafe image path");
  }
  return `WinUIGallery/${relative}`;
}

export function resolveImagePath(imageUri, context) {
  const authoredPath = authoredImagePath(imageUri, context);
  return {
    authoredPath,
    resolvedPath: IMAGE_PATH_CASE_OVERRIDES[authoredPath] ?? authoredPath,
    caseCorrected: Object.hasOwn(IMAGE_PATH_CASE_OVERRIDES, authoredPath),
  };
}

function validateDocumentLink(document, context) {
  assertExactFields(document, CATALOG_DOC_FIELDS, context);
  assertString(document.Title, `${context}.Title`);
  assertString(document.Uri, `${context}.Uri`);
  let url;
  try {
    url = new URL(document.Uri);
  } catch {
    fail(context, "Uri must be absolute");
  }
  if (!["https:", "ms-windows-store:"].includes(url.protocol)) {
    fail(context, `unsupported documentation URI scheme ${url.protocol}`);
  }
  return url.protocol;
}

function validateItem(item, group, context) {
  assertExactFields(item, CATALOG_ITEM_FIELDS, context);
  for (const required of [
    "UniqueId",
    "Title",
    "Subtitle",
    "ImagePath",
    "Docs",
    "Tags",
  ]) {
    if (!Object.hasOwn(item, required)) {
      fail(context, `missing required pinned field ${required}`);
    }
  }
  assertString(item.UniqueId, `${context}.UniqueId`);
  if (!/^[A-Za-z0-9][A-Za-z0-9._~/-]*$/.test(item.UniqueId)) {
    fail(context, "UniqueId is not a safe immutable record key");
  }
  assertString(item.Title, `${context}.Title`);
  assertString(item.Subtitle, `${context}.Subtitle`);
  assertOptionalString(item.Description, `${context}.Description`);
  assertOptionalString(item.ApiNamespace, `${context}.ApiNamespace`);
  assertOptionalString(item.SourcePath, `${context}.SourcePath`);
  assertBoolean(item.IsNew, `${context}.IsNew`);
  assertBoolean(item.IsUpdated, `${context}.IsUpdated`);
  if (item.SourcePath !== undefined && !item.SourcePath.startsWith("/")) {
    fail(context, "SourcePath must remain an upstream-rooted implementation pointer");
  }
  assertUniqueStringArray(item.Tags, `${context}.Tags`);
  if (item.RelatedControls !== undefined) {
    assertUniqueStringArray(item.RelatedControls, `${context}.RelatedControls`);
  }
  if (item.BaseClasses !== undefined) {
    assertUniqueStringArray(item.BaseClasses, `${context}.BaseClasses`);
  }
  if (!Array.isArray(item.Docs)) {
    fail(`${context}.Docs`, "must be an array");
  }
  const documentationSchemes = item.Docs.map((document, index) =>
    validateDocumentLink(document, `${context}.Docs[${index}]`),
  );
  const image = resolveImagePath(item.ImagePath, `${context}.ImagePath`);

  return {
    ...item,
    IsNew: item.IsNew ?? false,
    IsUpdated: item.IsUpdated ?? false,
    RelatedControls: item.RelatedControls ?? [],
    group: {
      UniqueId: group.UniqueId,
      Title: group.Title,
      IsSpecialSection: group.IsSpecialSection ?? false,
    },
    documentationSchemes,
    image,
  };
}

export function validateAndFlattenCatalog(
  catalog,
  { enforceSnapshotCounts = true } = {},
) {
  assertExactFields(catalog, CATALOG_ROOT_FIELDS, "catalog");
  if (catalog.$schema !== "ControlInfoDataSchema.json") {
    fail("catalog", "unexpected $schema reference");
  }
  if (!Array.isArray(catalog.Groups)) {
    fail("catalog.Groups", "must be an array");
  }

  const groupIds = new Set();
  const pages = [];
  for (const [groupIndex, group] of catalog.Groups.entries()) {
    const context = `catalog.Groups[${groupIndex}]`;
    assertExactFields(group, CATALOG_GROUP_FIELDS, context);
    for (const required of ["UniqueId", "Title", "Items"]) {
      if (!Object.hasOwn(group, required)) {
        fail(context, `missing required field ${required}`);
      }
    }
    assertString(group.UniqueId, `${context}.UniqueId`);
    assertString(group.Title, `${context}.Title`);
    assertOptionalString(group.IconGlyph, `${context}.IconGlyph`);
    assertBoolean(group.IsSpecialSection, `${context}.IsSpecialSection`);
    if (!Array.isArray(group.Items)) {
      fail(`${context}.Items`, "must be an array");
    }
    if (groupIds.has(group.UniqueId)) {
      fail(context, `duplicate group UniqueId ${group.UniqueId}`);
    }
    groupIds.add(group.UniqueId);
    group.Items.forEach((item, itemIndex) => {
      pages.push(
        validateItem(item, group, `${context}.Items[${itemIndex}]`),
      );
    });
  }

  const pageIds = new Set();
  for (const page of pages) {
    if (pageIds.has(page.UniqueId)) {
      fail("catalog", `duplicate global UniqueId ${page.UniqueId}`);
    }
    pageIds.add(page.UniqueId);
  }
  const dangling = pages.flatMap((page) =>
    page.RelatedControls
      .filter((target) => !pageIds.has(target))
      .map((target) => `${page.UniqueId}->${target}`),
  );
  if (dangling.length > 0) {
    fail("catalog", `dangling RelatedControls: ${dangling.join(", ")}`);
  }

  if (enforceSnapshotCounts) {
    const documents = pages.flatMap((page) => page.Docs);
    const schemes = pages.flatMap((page) => page.documentationSchemes);
    const counts = {
      groups: catalog.Groups.length,
      specialGroups: catalog.Groups.filter(
        (group) => group.IsSpecialSection ?? false,
      ).length,
      records: pages.length,
      specialRecords: pages.filter((page) => page.group.IsSpecialSection).length,
      descriptions: pages.filter((page) =>
        Object.hasOwn(page, "Description"),
      ).length,
      apiNamespaces: pages.filter((page) =>
        Object.hasOwn(page, "ApiNamespace"),
      ).length,
      baseClasses: pages.filter((page) =>
        Object.hasOwn(page, "BaseClasses"),
      ).length,
      documentationLinks: documents.length,
      httpsDocumentationLinks: schemes.filter((scheme) => scheme === "https:")
        .length,
      storeDocumentationLinks: schemes.filter(
        (scheme) => scheme === "ms-windows-store:",
      ).length,
      relatedEdges: pages.reduce(
        (total, page) => total + page.RelatedControls.length,
        0,
      ),
      uniqueImages: new Set(pages.map((page) => page.image.resolvedPath)).size,
    };
    for (const [name, expected] of Object.entries(EXPECTED)) {
      if (Object.hasOwn(counts, name) && counts[name] !== expected) {
        fail(
          "catalog",
          `${name} invariant failed: expected ${expected}, received ${counts[name]}`,
        );
      }
    }
  }

  return pages;
}

export function assertDefinitionCombinationCounts(combinations) {
  const actual = Object.fromEntries(
    [...combinations.entries()].sort(([left], [right]) =>
      left.localeCompare(right, "en-US"),
    ),
  );
  const expected = OBSERVED_DEFINITION_COMBINATIONS;
  if (
    !sameValues(Object.keys(actual), Object.keys(expected)) ||
    Object.entries(expected).some(([key, value]) => actual[key] !== value)
  ) {
    fail(
      "sample definitions",
      `section combinations drifted: ${JSON.stringify(actual)}`,
    );
  }
}
