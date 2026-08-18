import assert from "node:assert/strict";
import test from "node:test";

import {
  clearExplorerFilters,
  createDefaultExplorerState,
  createExplorerIndex,
  filterAndSortSamples,
  getFacetCounts,
  getFacetOptions,
  parseExplorerState,
  serializeExplorerState,
} from "../src/lib/explorer";
import {
  makeSample,
  testCategories,
} from "./fixtures";

const searchable = makeSample(
  "camera-capture",
  "Capturing a photo from a Windows app",
  {
    project: {
      folder: "Camera",
      name: "CameraCapture",
      repositoryPath: "Samples/Camera",
    },
    summary: "Capture and save a portrait with a connected camera.",
    aliases: ["Camera", "MediaCapture"],
    tags: ["photos", "webcam"],
    originalSamples: [
      {
        name: "CameraStarterKit",
        url: "https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/CameraStarterKit",
      },
    ],
    documentation: [
      {
        title: "Ported from UWP",
        url: "https://learn.microsoft.com/windows/apps/windows-app-sdk/migrate-to-windows-app-sdk/",
        kind: "migration",
      },
    ],
    scenarios: [
      {
        id: "preview-photo",
        title: "Preview and save a portrait",
        summary: "Start a camera preview before saving an image.",
        apis: ["Windows.Media.Capture.MediaCapture"],
        sourceFiles: ["Scenarios/Preview.xaml.cs"],
      },
    ],
    apis: [
      {
        name: "Windows.Media.Capture.MediaCapture",
        description: "Initializes and controls the capture device.",
      },
    ],
  },
);

test("indexes every authored search surface", () => {
  const index = createExplorerIndex([searchable], testCategories);
  const queries = [
    "capturing photo",
    "connected camera",
    "CameraCapture",
    "WinUI samples",
    "MediaCapture",
    "webcam",
    "Preview portrait",
    "Windows.Media.Capture",
    "Preview.xaml.cs",
    "CameraStarterKit",
  ];

  for (const query of queries) {
    const state = createDefaultExplorerState();
    state.query = query;
    assert.deepEqual(
      filterAndSortSamples(index, state).map((entry) => entry.sample.id),
      ["camera-capture"],
      query,
    );
  }

  const excluded = createDefaultExplorerState();
  excluded.query = "ported UWP";
  assert.deepEqual(filterAndSortSamples(index, excluded), []);
  assert.doesNotMatch(JSON.stringify(index), /ported from UWP/i);
});

test("keeps C# and C++ as distinct search languages", () => {
  const managed = makeSample("managed", "Managed language sample", {
    languages: ["C#"],
  });
  const native = makeSample("native", "Native language sample", {
    languages: ["C++"],
  });
  const index = createExplorerIndex([managed, native], testCategories);
  const csharp = createDefaultExplorerState();
  csharp.query = "C#";
  assert.deepEqual(
    filterAndSortSamples(index, csharp).map((entry) => entry.sample.id),
    ["managed"],
  );
  const cpp = createDefaultExplorerState();
  cpp.query = "C++";
  assert.deepEqual(
    filterAndSortSamples(index, cpp).map((entry) => entry.sample.id),
    ["native"],
  );
});

test("round-trips stable shareable URL state", () => {
  const state = createDefaultExplorerState();
  state.query = "storage file";
  state.sort = "project";
  state.facets.primaryCategory = ["files-and-data"];
  state.facets.tag = ["storage", "files"];
  state.facets.architecture = ["arm64", "x64"];
  state.facets.provider = ["winui-samples"];
  state.facets.language = ["C#"];

  const serialized = serializeExplorerState(state);
  assert.equal(
    serialized.toString(),
    "q=storage+file&sort=project&provider=winui-samples&primary=files-and-data&tag=files&tag=storage&arch=arm64&arch=x64&language=C%23",
  );
  assert.deepEqual(parseExplorerState(serialized), {
    ...state,
    facets: {
      ...state.facets,
      tag: ["files", "storage"],
      architecture: ["arm64", "x64"],
    },
  });
  assert.equal(parseExplorerState("?sort=recent").sort, "recommended");
  assert.deepEqual(
    parseExplorerState("?source=winui-samples").facets.provider,
    ["winui-samples"],
  );
  const legacyCaptureState = createDefaultExplorerState();
  legacyCaptureState.facets.capture = ["automatic"];
  assert.deepEqual(
    parseExplorerState("?capture=automatic"),
    legacyCaptureState,
  );
});

test("filters with OR within a facet and AND across facets", () => {
  const file = makeSample("file-access", "Reading and writing local files", {
    categories: {
      primary: "files-and-data",
      secondary: ["app-fundamentals"],
    },
    tags: ["files", "storage"],
    requirements: {
      supportedArchitectures: ["x64", "arm64"],
      capabilities: [
        {
          name: "picturesLibrary",
          kind: "general",
          description: "Reads and writes the Pictures library.",
        },
      ],
    },
    screenshots: [
      {
        id: "ready",
        alt: "The file sample ready to run.",
        scenario: "main-scenario",
        capture: {
          mode: "automatic",
          readinessSelector: "text=Ready",
        },
      },
    ],
  });
  const media = makeSample("media-playback", "Playing synchronized media", {
    categories: { primary: "media" },
    tags: ["video", "streaming"],
    requirements: {
      supportedArchitectures: ["x64"],
      hardware: ["Camera"],
      accountServices: ["Contoso media account"],
    },
    screenshots: [],
  });
  const index = createExplorerIndex([file, media], testCategories);
  const state = createDefaultExplorerState();
  state.facets.primaryCategory = ["files-and-data", "media"];
  state.facets.architecture = ["arm64"];

  assert.deepEqual(
    filterAndSortSamples(index, state).map((entry) => entry.sample.id),
    ["file-access"],
  );

  const options = getFacetOptions(index);
  assert.deepEqual(
    options.provider.map((option) => option.value),
    ["winui-samples"],
  );
  assert.deepEqual(options.capture, [
    { value: "automatic", label: "Automated preview" },
    { value: "none", label: "No preview recipe" },
  ]);
  const legacyCaptureFilter = createDefaultExplorerState();
  legacyCaptureFilter.facets.capture = ["automatic"];
  assert.deepEqual(
    filterAndSortSamples(index, legacyCaptureFilter).map(
      (entry) => entry.sample.id,
    ),
    ["file-access"],
  );
  const counts = getFacetCounts(
    index,
    state,
    "primaryCategory",
    options.primaryCategory,
  );
  assert.equal(counts.get("files-and-data"), 1);
  assert.equal(counts.get("media"), 0);
});

test("sorts by intent title and technical project name without recency", () => {
  const first = makeSample("zeta", "Building an alpha experience", {
    project: { name: "ZuluProject" },
  });
  const second = makeSample("alpha", "Creating a zeta experience", {
    project: { name: "AlphaProject" },
  });
  const index = createExplorerIndex([first, second], testCategories);
  const state = createDefaultExplorerState();

  state.sort = "title";
  assert.deepEqual(
    filterAndSortSamples(index, state).map((entry) => entry.sample.id),
    ["zeta", "alpha"],
  );

  state.sort = "project";
  assert.deepEqual(
    filterAndSortSamples(index, state).map((entry) => entry.sample.id),
    ["alpha", "zeta"],
  );
});

test("merges case-only freeform facets while preserving an authored label", () => {
  const first = makeSample("bluetooth-a", "Connecting Bluetooth devices", {
    tags: ["Bluetooth"],
  });
  const second = makeSample("bluetooth-b", "Pairing bluetooth hardware", {
    tags: ["bluetooth"],
  });
  const index = createExplorerIndex([first, second], testCategories);
  const options = getFacetOptions(index);

  assert.deepEqual(options.tag, [
    { value: "bluetooth", label: "Bluetooth" },
  ]);

  const state = createDefaultExplorerState();
  state.facets.tag = ["bluetooth"];
  assert.deepEqual(
    filterAndSortSamples(index, state).map((entry) => entry.sample.id),
    ["bluetooth-a", "bluetooth-b"],
  );
});

test("handles empty and one-record partial catalogs", () => {
  const emptyIndex = createExplorerIndex([], testCategories);
  assert.deepEqual(
    filterAndSortSamples(emptyIndex, createDefaultExplorerState()),
    [],
  );
  assert.deepEqual(
    getFacetOptions(emptyIndex).tag,
    [],
  );

  const partialIndex = createExplorerIndex([searchable], testCategories);
  assert.equal(
    filterAndSortSamples(
      partialIndex,
      createDefaultExplorerState(),
    ).length,
    1,
  );
});

test("clears query and facets while preserving the chosen sort", () => {
  const state = createDefaultExplorerState();
  state.query = "files";
  state.sort = "title";
  state.facets.tag = ["storage"];

  const cleared = clearExplorerFilters(state);
  assert.equal(cleared.query, "");
  assert.equal(cleared.sort, "title");
  assert.deepEqual(cleared.facets.tag, []);
});
