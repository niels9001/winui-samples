export const PROVIDER_ID = "winui-gallery";

export const CATALOG_PATH =
  "WinUIGallery/SampleSupport/Data/ControlInfoData.json";
export const UPSTREAM_SCHEMA_PATH =
  "WinUIGallery/SampleSupport/Data/ControlInfoDataSchema.json";
export const ROOT_LICENSE_PATH = "LICENSE";

export const PINNED_SNAPSHOT = Object.freeze({
  owner: "microsoft",
  repository: "WinUI-Gallery",
  ref: "refs/heads/main",
  commitSha: "8854551b0464b6ad824d6b9e1c79933888f14acc",
  treeSha: "79a62e7565aa23808f0f4d21e8743e563234cedb",
  commitTime: "2026-08-14T07:46:34Z",
  catalogBlobSha: "681e0569fcf304ad4d9f925109f1f6797d66c092",
  catalogSize: 168285,
  schemaBlobSha: "e033b88cb16c2395edc5667c3b5aecf84d3f4bdb",
  schemaSize: 6481,
  licenseBlobSha: "21071075c24599ee98254f702bcfc504cdc275a6",
  licenseSize: 1162,
});

export const REVIEWED_SYNC = Object.freeze({
  id: "winui-gallery-8854551b0464-reviewed",
  reviewedAt: "2026-08-18T09:02:26Z",
  lockCommitSha: PINNED_SNAPSHOT.commitSha,
});

export const REVIEWED_RENAMES = Object.freeze([]);
export const REVIEWED_TOMBSTONES = Object.freeze([]);
export const REVIEWED_REDIRECTS = Object.freeze([]);

export const EXPECTED = Object.freeze({
  groups: 19,
  specialGroups: 3,
  records: 120,
  specialRecords: 15,
  descriptions: 113,
  apiNamespaces: 106,
  baseClasses: 95,
  documentationLinks: 303,
  httpsDocumentationLinks: 302,
  storeDocumentationLinks: 1,
  relatedEdges: 322,
  uniqueImages: 102,
  controlExamples: 330,
  controlExamplePages: 115,
  sampleDefinitions: 316,
  selectedSourceFiles: 575,
  selectedSourceBytes: 1543461,
  lockedArtifacts: 679,
  lockedArtifactBytes: 2217816,
  cachedFilesIncludingLicense: 680,
  cachedBytesIncludingLicense: 2218978,
  nestedCodeUnits: 419,
});

export const OBSERVED_DEFINITION_COMBINATIONS = Object.freeze({
  "header+xaml+c#": 97,
  "header+xaml": 191,
  "header+c#": 26,
  header: 2,
});

export const AUXILIARY_SOURCES = Object.freeze({
  ContentDialog: Object.freeze([
    "WinUIGallery/Samples/ContentDialog/ContentDialogContent.xaml",
    "WinUIGallery/Samples/ContentDialog/ContentDialogContent.xaml.cs",
    "WinUIGallery/Samples/ContentDialog/ContentDialogExample.xaml",
    "WinUIGallery/Samples/ContentDialog/ContentDialogExample.xaml.cs",
  ]),
  CustomUserControls: Object.freeze([
    "WinUIGallery/Samples/CustomUserControls/CounterControl.cs",
    "WinUIGallery/Samples/CustomUserControls/CounterControl.xaml",
    "WinUIGallery/Samples/CustomUserControls/TemperatureConverterControl.xaml",
    "WinUIGallery/Samples/CustomUserControls/TemperatureConverterControl.xaml.cs",
    "WinUIGallery/Samples/CustomUserControls/ValidatedPasswordBox.cs",
    "WinUIGallery/Samples/CustomUserControls/ValidatedPasswordBox.xaml",
  ]),
  CustomXamlConditionals: Object.freeze([
    "WinUIGallery/Samples/CustomXamlConditionals/FeatureFlagCondition.cs",
  ]),
});

export const DYNAMIC_LEGACY_OVERRIDES = Object.freeze([
  Object.freeze({
    recordKey: "SystemBackdropElement",
    examplePosition: 1,
    language: "XAML",
    path: "WinUIGallery/Samples/SampleCode/SystemBackdropElement/SystemBackdropElementAcrylic_xaml.txt",
  }),
  Object.freeze({
    recordKey: "SystemBackdropElement",
    examplePosition: 1,
    language: "XAML",
    path: "WinUIGallery/Samples/SampleCode/SystemBackdropElement/SystemBackdropElementMica_xaml.txt",
  }),
  Object.freeze({
    recordKey: "SystemBackdropElement",
    examplePosition: 1,
    language: "XAML",
    path: "WinUIGallery/Samples/SampleCode/SystemBackdropElement/SystemBackdropElementMicaAlt_xaml.txt",
  }),
  Object.freeze({
    recordKey: "ScrollView",
    examplePosition: 3,
    language: "C#",
    path: "WinUIGallery/Samples/SampleCode/ScrollView/ScrollViewSample3_DefaultAnimation_cs.txt",
  }),
  Object.freeze({
    recordKey: "ScrollView",
    examplePosition: 3,
    language: "C#",
    path: "WinUIGallery/Samples/SampleCode/ScrollView/ScrollViewSample3_AccordionAnimation_cs.txt",
  }),
  Object.freeze({
    recordKey: "ScrollView",
    examplePosition: 3,
    language: "C#",
    path: "WinUIGallery/Samples/SampleCode/ScrollView/ScrollViewSample3_TeleportationAnimation_cs.txt",
  }),
  Object.freeze({
    recordKey: "Templates",
    examplePosition: 3,
    language: "XAML",
    path: "WinUIGallery/Samples/SampleCode/Templates/TemplatesSample3_WrapGrid_xaml.txt",
  }),
  Object.freeze({
    recordKey: "Templates",
    examplePosition: 3,
    language: "XAML",
    path: "WinUIGallery/Samples/SampleCode/Templates/TemplatesSample3_StackPanel_xaml.txt",
  }),
]);

export const IMAGE_PATH_CASE_OVERRIDES = Object.freeze({
  "WinUIGallery/Assets/ControlImages/CheckBox.png":
    "WinUIGallery/Assets/ControlImages/Checkbox.png",
  "WinUIGallery/Assets/ControlImages/AnnotatedScrollbar.png":
    "WinUIGallery/Assets/ControlImages/AnnotatedScrollBar.png",
});

export const CATALOG_ROOT_FIELDS = Object.freeze(["$schema", "Groups"]);
export const CATALOG_GROUP_FIELDS = Object.freeze([
  "UniqueId",
  "Title",
  "IconGlyph",
  "IsSpecialSection",
  "Items",
]);
export const CATALOG_ITEM_FIELDS = Object.freeze([
  "UniqueId",
  "Title",
  "ApiNamespace",
  "Subtitle",
  "Description",
  "ImagePath",
  "IsNew",
  "IsUpdated",
  "Docs",
  "RelatedControls",
  "Tags",
  "BaseClasses",
  "SourcePath",
]);
export const CATALOG_DOC_FIELDS = Object.freeze(["Title", "Uri"]);

export const SCHEMA_ITEM_FIELDS = Object.freeze([
  "UniqueId",
  "Title",
  "ApiNamespace",
  "Subtitle",
  "Description",
  "ImagePath",
  "IsNew",
  "IsUpdated",
  "Docs",
  "RelatedControls",
  "Tags",
]);

export function pagePaths(recordKey) {
  const page =
    `WinUIGallery/Samples/${recordKey}/${recordKey}Page.xaml`;
  return [page, `${page}.cs`];
}

export function repositoryUrl() {
  return `https://github.com/${PINNED_SNAPSHOT.owner}/${PINNED_SNAPSHOT.repository}`;
}

export function pinnedBlobUrl(sourcePath) {
  const encodedPath = sourcePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${repositoryUrl()}/blob/${PINNED_SNAPSHOT.commitSha}/${encodedPath}`;
}

export function mediaTypeForPath(sourcePath) {
  if (sourcePath.endsWith(".png")) {
    return "image/png";
  }
  if (sourcePath.endsWith(".json")) {
    return "application/json";
  }
  if (sourcePath.endsWith(".xaml")) {
    return "application/xml";
  }
  return "text/plain";
}
