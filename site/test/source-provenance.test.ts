import assert from "node:assert/strict";
import test from "node:test";

import {
  developerDocumentation,
  getSampleSource,
  sampleSourceFileUrl,
} from "../src/lib/source-provenance";
import { makeSample } from "./fixtures";

test("provides a quiet default source and honors catalog provenance", () => {
  const local = getSampleSource(makeSample("local", "Local"));
  assert.equal(local.label, "WinUI samples");
  assert.match(local.canonicalUrl, /\/tree\/main\//);

  const federated = makeSample("gallery", "Gallery", {
    source: {
      id: "winui-gallery",
      label: "WinUI Gallery",
      canonicalUrl: "https://github.com/microsoft/WinUI-Gallery",
    },
  });

  assert.deepEqual(getSampleSource(federated), {
    ...federated.source,
    catalogUrl: "https://github.com/microsoft/WinUI-Gallery",
  });
});

test("builds file links from each provider's canonical source", () => {
  const gallery = makeSample("gallery", "Gallery", {
    source: {
      id: "winui-gallery",
      label: "WinUI Gallery",
      canonicalUrl:
        "https://github.com/microsoft/WinUI-Gallery/tree/main/WinUIGallery/ControlPages",
    },
  });
  assert.equal(
    sampleSourceFileUrl(gallery, "Pages/Button Page.xaml.cs"),
    "https://github.com/microsoft/WinUI-Gallery/blob/main/WinUIGallery/ControlPages/Pages/Button%20Page.xaml.cs",
  );

  const conceptual = makeSample("conceptual", "Conceptual", {
    source: {
      id: "windows-app-sdk",
      label: "Windows App SDK samples",
      canonicalUrl: "https://github.com/microsoft/WindowsAppSDK-Samples",
    },
  });
  assert.equal(
    sampleSourceFileUrl(conceptual, "App.xaml.cs"),
    conceptual.source?.canonicalUrl,
  );
});

test("hides platform porting guidance but keeps functional migration docs", () => {
  const sample = makeSample("app-data", "Manage app data", {
    documentation: [
      {
        title: "Move from UWP to the Windows App SDK",
        url: "https://learn.microsoft.com/windows/apps/windows-app-sdk/migrate-to-windows-app-sdk/",
        kind: "migration",
      },
      {
        title: "Migrate app-data versions",
        url: "https://learn.microsoft.com/uwp/api/windows.storage.applicationdata.setversionasync",
        kind: "api-reference",
      },
    ],
  });

  assert.deepEqual(
    developerDocumentation(sample).map((document) => document.title),
    ["Migrate app-data versions"],
  );
});
