export const providerId = "windows-app-sdk-samples";

export const reviewedSnapshot = Object.freeze({
  repository: {
    owner: "microsoft",
    name: "WindowsAppSDK-Samples",
  },
  ref: "main",
  commitSha: "18431c6d0111d6a4bd8d46b9c8a82add47ccb013",
  treeSha: "748316950eaa0910aea552ba333dba614e710135",
  commitTime: "2026-08-11T10:34:52Z",
  treeEntryCount: 3213,
  blobEntryCount: 2702,
  solutionCount: 86,
  csharpProjectCount: 55,
  cppProjectCount: 49,
  packagingProjectCount: 26,
  readmeCount: 43,
  sampleFrontmatterCount: 22,
});

export const reviewedSync = Object.freeze({
  id: "windows-app-sdk-samples-2026-08-18-18431c6d",
  reviewedAt: "2026-08-18T09:02:23Z",
  lockCommitSha: reviewedSnapshot.commitSha,
});

export const contentGuards = Object.freeze({
  maxFeaturedFilesPerRecord: 6,
  maxFeaturedFileBytes: 64 * 1024,
  maxRenderedLinesPerFile: 400,
  maxRecordBytes: 256 * 1024,
});

export const knownSampleRoots = Object.freeze([
  "AppLifecycle",
  "BackgroundTask",
  "Composition",
  "CustomControls",
  "DeploymentManager",
  "Input",
  "Insights",
  "Installer",
  "Islands",
  "Mica",
  "Notifications",
  "PhotoEditor",
  "ResourceManagement",
  "SceneGraph",
  "SecureUI",
  "SelfContainedDeployment",
  "TextRendering",
  "Unpackaged",
  "Widgets",
  "Windowing",
  "WindowsAIFoundry",
  "WindowsML",
]);

export const infrastructureRoots = Object.freeze([
  "Samples/localpackages",
  "Templates",
]);

export const rootRequirements = Object.freeze({
  minimumWindowsVersion: "Windows 10, version 1809 (build 17763) or later",
  architectures: [],
  declaredPackageCapabilities: [],
  prerequisites: {
    hardware: [],
    accountsAndServices: [],
    software: [
      "Visual Studio 2022 or Visual Studio 2019 version 16.9 or later with Windows application development, .NET desktop development, and Desktop development with C++ workloads",
      "Windows SDK version 2004 (build 19041) or later",
    ],
    notes: [],
  },
});

export const licenseDefinitions = Object.freeze([
  {
    id: `${providerId}:repository-mit`,
    scopePath: "",
    spdxId: "MIT",
    licensePath: "LICENSE",
    attributionText: null,
  },
  {
    id: `${providerId}:expression-builder-mit`,
    scopePath: "Samples/SceneGraph/ExpressionBuilder",
    spdxId: "MIT",
    licensePath: "Samples/SceneGraph/ExpressionBuilder/LICENSE.TXT",
    attributionText: "Copyright (c) 2017 Microsoft Corporation.",
  },
  {
    id: `${providerId}:roboto-mono-apache-2.0`,
    scopePath: "Samples/TextRendering/cpp-win32/DWriteCoreGallery/RobotoMono",
    spdxId: "Apache-2.0",
    licensePath:
      "Samples/TextRendering/cpp-win32/DWriteCoreGallery/RobotoMono/LICENSE.txt",
    attributionText: "Roboto Mono font files are licensed under Apache-2.0.",
  },
  {
    id: `${providerId}:squeezenet-bsd`,
    scopePath: "Samples/WindowsML/Resources/SqueezeNet.onnx",
    spdxId: "BSD-2-Clause",
    licensePath: "Samples/WindowsML/Resources/SqueezeNet.LICENSE.txt",
    attributionText: "SqueezeNet model license.",
  },
  {
    id: `${providerId}:resnet50-apache-2.0`,
    scopePath: "Samples/WindowsML/Resources/ResNet50",
    spdxId: "Apache-2.0",
    licensePath: "Samples/WindowsML/Resources/ResNet50/model.LICENSE.txt",
    attributionText: "ResNet-50 model license.",
  },
]);

export const mediaCandidates = Object.freeze([
  {
    id: "root-banner",
    familyKey: null,
    path: "docs/images/header.png",
    alt: "Windows App SDK Banner",
    sourcePath: "README.md",
    include: false,
    reason: "The repository banner is not sample-specific media.",
  },
  {
    id: "islands-designer",
    familyKey: "islands/winforms-island-app",
    path: "Samples/Islands/img/designer.png",
    alt: "WinForms island control in the Visual Studio designer",
    sourcePath: "Samples/Islands/README.md",
    include: true,
    provenanceKind: "derived",
  },
  {
    id: "islands-running-sample",
    familyKey: "islands/winforms-island-app",
    path: "Samples/Islands/img/screenshot.png",
    alt: "Running WinForms island sample",
    sourcePath: "Samples/Islands/README.md",
    include: true,
    provenanceKind: "derived",
  },
  {
    id: "photo-editor-cpp",
    familyKey: "photo-editor",
    path: "Samples/PhotoEditor/images/photo_editor_banner.png",
    alt:
      "Photo Editor C++ sample showing the collection page, editing page, and editing controls",
    sourcePath: "Samples/PhotoEditor/README.md",
    include: false,
    reason: "The pinned 2,153,403-byte image exceeds the shared media cap.",
  },
  {
    id: "photo-editor-csharp",
    familyKey: "photo-editor",
    path: "Samples/PhotoEditor/images/CS_Picture1.png",
    alt:
      "Photo Editor C# sample showing the collection page and editing controls",
    sourcePath: "Samples/PhotoEditor/README.md",
    include: false,
    reason: "The pinned 5,999,047-byte image exceeds the shared media cap.",
  },
]);

const rootLicense = `${providerId}:repository-mit`;

function warning(code, message, sourcePath, field = null) {
  return { code, message, field, sourcePath };
}

function learn(title, url) {
  return { title, url, kind: "learn" };
}

function repositoryLink(title, url) {
  return { title, url, kind: "repository" };
}

function api(name, url = null) {
  return { name, description: null, url };
}

function provenance(kind, sourcePath) {
  return { kind, sourcePath };
}

function family(value) {
  const metadataSource = value.metadataSource ?? value.sourcePath;
  return Object.freeze({
    exactPaths: [],
    aliases: [],
    languages: [],
    projectTypes: [],
    packaging: [],
    apis: [],
    documentation: [],
    requirements: {},
    scenarios: [],
    examples: [],
    featuredCandidates: [],
    warnings: [],
    limitations: [],
    providerCategories: [],
    portalCategory: null,
    tags: [],
    licenseRefs: [rootLicense],
    attributionRefs: [],
    titleProvenance: provenance("authored", metadataSource),
    upstreamTitleProvenance: provenance("authored", metadataSource),
    summaryProvenance: provenance(
      value.summary === null ? "technical" : "authored",
      metadataSource,
    ),
    descriptionProvenance: provenance("technical", metadataSource),
    ...value,
  });
}

const rootIndex = "README.md";
const appLifecycleReadme = "Samples/AppLifecycle/README.md";
const sceneGraphReadme = "Samples/SceneGraph/README.md";
const windowsMlReadme = "Samples/WindowsML/README.md";

export const familyManifest = Object.freeze([
  family({
    recordKey: "app-lifecycle/activation",
    roots: ["Samples/AppLifecycle/Activation"],
    sourcePath: "Samples/AppLifecycle/Activation",
    metadataSource: rootIndex,
    title: "Activation",
    upstreamTitle: "Activation",
    summary: "These samples demonstrate support for rich activation kinds.",
    aliases: ["AppLifecycle Activation", "GetActivatedEventArgs"],
    projectTypes: ["WinUI 3", "Win32", "WPF", "Windows Forms", "Console"],
    packaging: ["MSIX", "unpackaged"],
    apis: [
      api(
        "Microsoft.Windows.AppLifecycle.AppInstance",
        "https://learn.microsoft.com/windows/windows-app-sdk/api/winrt/microsoft.windows.applifecycle.appinstance",
      ),
    ],
    documentation: [
      learn(
        "Rich activation",
        "https://learn.microsoft.com/windows/apps/windows-app-sdk/applifecycle/applifecycle-rich-activation",
      ),
    ],
    providerCategories: ["App Lifecycle and System Services"],
    portalCategory: "app-fundamentals",
    tags: ["activation", "app-lifecycle"],
  }),
  family({
    recordKey: "app-lifecycle/instancing",
    roots: ["Samples/AppLifecycle/Instancing"],
    sourcePath: "Samples/AppLifecycle/Instancing",
    metadataSource: rootIndex,
    title: "Instancing",
    upstreamTitle: "Instancing",
    summary:
      "These samples demonstrate support for single and selective multi-instancing.",
    aliases: ["AppLifecycle Instancing", "AppInstance"],
    projectTypes: ["WinUI 3", "Win32", "WPF", "Windows Forms", "Console"],
    packaging: ["MSIX", "unpackaged"],
    apis: [
      api(
        "Microsoft.Windows.AppLifecycle.AppInstance",
        "https://learn.microsoft.com/windows/windows-app-sdk/api/winrt/microsoft.windows.applifecycle.appinstance",
      ),
    ],
    documentation: [
      learn(
        "App instancing",
        "https://learn.microsoft.com/windows/apps/windows-app-sdk/applifecycle/applifecycle-instancing",
      ),
    ],
    providerCategories: ["App Lifecycle and System Services"],
    portalCategory: "app-fundamentals",
    tags: ["app-instancing", "app-lifecycle"],
  }),
  family({
    recordKey: "app-lifecycle/state-notifications",
    roots: ["Samples/AppLifecycle/StateNotifications"],
    sourcePath: "Samples/AppLifecycle/StateNotifications",
    metadataSource: rootIndex,
    title: "State and power notifications",
    upstreamTitle: "Power Notifications",
    summary:
      "These samples demonstrate power and system state notifications for managing app workload.",
    titleProvenance: provenance("curated", rootIndex),
    aliases: ["StateNotifications", "Power Notifications"],
    projectTypes: ["WinUI 3", "Win32", "WPF", "Windows Forms", "Console"],
    packaging: ["MSIX", "unpackaged"],
    apis: [api("Microsoft.Windows.System.Power.PowerManager")],
    documentation: [
      learn(
        "Power and state notifications",
        "https://learn.microsoft.com/windows/apps/windows-app-sdk/applifecycle/applifecycle-power",
      ),
    ],
    providerCategories: ["App Lifecycle and System Services"],
    portalCategory: "app-fundamentals",
    tags: ["power", "state-notifications"],
  }),
  family({
    recordKey: "app-lifecycle/environment-variables",
    roots: ["Samples/AppLifecycle/EnvironmentVariables"],
    sourcePath: "Samples/AppLifecycle/EnvironmentVariables",
    metadataSource: appLifecycleReadme,
    title: "Environment variables",
    upstreamTitle: null,
    summary: null,
    titleProvenance: provenance(
      "technical",
      "Samples/AppLifecycle/EnvironmentVariables",
    ),
    upstreamTitleProvenance: provenance(
      "technical",
      "Samples/AppLifecycle/EnvironmentVariables",
    ),
    aliases: ["EnvironmentVariables"],
    projectTypes: ["Win32", "Windows Forms", "Console"],
    packaging: ["unpackaged"],
    providerCategories: ["App Lifecycle and System Services"],
    portalCategory: "app-fundamentals",
    tags: ["environment-variables"],
  }),
  family({
    recordKey: "app-lifecycle/restart",
    roots: ["Samples/AppLifecycle/Restart"],
    sourcePath: "Samples/AppLifecycle/Restart",
    metadataSource: rootIndex,
    title: "Restart",
    upstreamTitle: "Restart",
    summary:
      "These samples demonstrate synchronously restarting an app with command-line restart arguments.",
    aliases: ["AppLifecycle Restart"],
    projectTypes: ["WinUI 3", "Console"],
    packaging: ["MSIX", "unpackaged"],
    apis: [api("Microsoft.Windows.AppLifecycle.AppInstance.Restart")],
    providerCategories: ["App Lifecycle and System Services"],
    portalCategory: "app-fundamentals",
    tags: ["restart", "app-lifecycle"],
  }),
  family({
    recordKey: "app-lifecycle/restart-registration",
    roots: ["Samples/AppLifecycle/RestartRegistration"],
    sourcePath: "Samples/AppLifecycle/RestartRegistration",
    metadataSource:
      "Samples/AppLifecycle/RestartRegistration/cs-winui-packaged/SampleConfiguration.cs",
    title: "Application recovery and restart registration",
    upstreamTitle: "Application Recovery and Restart",
    summary: null,
    titleProvenance: provenance(
      "curated",
      "Samples/AppLifecycle/RestartRegistration/cs-winui-packaged/SampleConfiguration.cs",
    ),
    aliases: ["RestartRegistration"],
    projectTypes: ["WinUI 3"],
    packaging: ["MSIX"],
    documentation: [
      learn(
        "Application Recovery and Restart",
        "https://learn.microsoft.com/windows/win32/api/_recovery/",
      ),
    ],
    providerCategories: ["App Lifecycle and System Services"],
    portalCategory: "app-fundamentals",
    tags: ["application-recovery", "restart-registration"],
  }),
  family({
    recordKey: "app-lifecycle/share-target",
    roots: ["Samples/AppLifecycle/ShareTarget"],
    sourcePath: "Samples/AppLifecycle/ShareTarget",
    metadataSource: rootIndex,
    title: "Share Target",
    upstreamTitle: "Share Target",
    summary: "This sample demonstrates an app that can be activated as a share target.",
    aliases: ["WinUI-CS-ShareTargetSampleApp"],
    projectTypes: ["WinUI 3"],
    packaging: ["MSIX"],
    providerCategories: ["App Lifecycle and System Services"],
    portalCategory: "app-fundamentals",
    tags: ["activation", "share-target"],
    warnings: [
      warning(
        "normalized-relative-link",
        "The root README Share Target link used backslashes; the curated source path is normalized to exact POSIX separators.",
        rootIndex,
        "/source/path",
      ),
    ],
  }),
  family({
    recordKey: "background-task/in-process",
    roots: ["Samples/BackgroundTask/InProc BackgroundTask"],
    sourcePath: "Samples/BackgroundTask/InProc BackgroundTask",
    metadataSource:
      "Samples/BackgroundTask/InProc BackgroundTask/cpp-winui/BackgroundTaskBuilder/README.md",
    title: "In-process background task",
    upstreamTitle: "BackgroundTaskBuilder sample",
    summary:
      "Demonstrates how to register a background task using the Windows App SDK BackgroundTaskBuilder API.",
    titleProvenance: provenance(
      "curated",
      "Samples/BackgroundTask/InProc BackgroundTask/cpp-winui/BackgroundTaskBuilder/README.md",
    ),
    aliases: ["InProc BackgroundTask", "BackgroundTaskBuilder"],
    projectTypes: ["WinUI 3"],
    packaging: ["MSIX"],
    apis: [
      api("Microsoft.Windows.ApplicationModel.Background.BackgroundTaskBuilder"),
    ],
    providerCategories: [
      "App Lifecycle and System Services",
      "Background Task",
    ],
    portalCategory: "app-fundamentals",
    tags: ["background-task", "in-process"],
    warnings: [
      warning(
        "malformed-frontmatter",
        "The README extendedZipContent list separates path and target into different entries.",
        "Samples/BackgroundTask/InProc BackgroundTask/cpp-winui/BackgroundTaskBuilder/README.md",
      ),
      warning(
        "duplicate-url-fragment",
        "The in-process and out-of-process READMEs both declare the BackgroundTaskBuilder urlFragment.",
        "Samples/BackgroundTask/InProc BackgroundTask/cpp-winui/BackgroundTaskBuilder/README.md",
      ),
      warning(
        "authored-language-list-incomplete",
        "README frontmatter lists only C++, while the reviewed project inventory also contains C#.",
        "Samples/BackgroundTask/InProc BackgroundTask/cpp-winui/BackgroundTaskBuilder/README.md",
        "/technologies/languages",
      ),
    ],
  }),
  family({
    recordKey: "background-task/out-of-process",
    roots: ["Samples/BackgroundTask/OutOfProc BackgroundTask"],
    sourcePath: "Samples/BackgroundTask/OutOfProc BackgroundTask",
    metadataSource:
      "Samples/BackgroundTask/OutOfProc BackgroundTask/cpp-winui/BackgroundTaskBuilder/README.md",
    title: "Out-of-process background task",
    upstreamTitle: "BackgroundTaskBuilder sample",
    summary:
      "Demonstrates how to register a background task using the Windows App SDK BackgroundTaskBuilder API.",
    titleProvenance: provenance(
      "curated",
      "Samples/BackgroundTask/OutOfProc BackgroundTask/cpp-winui/BackgroundTaskBuilder/README.md",
    ),
    aliases: ["OutOfProc BackgroundTask", "BackgroundTaskBuilder"],
    projectTypes: ["WinUI 3"],
    packaging: ["MSIX"],
    apis: [
      api("Microsoft.Windows.ApplicationModel.Background.BackgroundTaskBuilder"),
    ],
    providerCategories: [
      "App Lifecycle and System Services",
      "Background Task",
    ],
    portalCategory: "app-fundamentals",
    tags: ["background-task", "out-of-process"],
    warnings: [
      warning(
        "malformed-frontmatter",
        "The README extendedZipContent list separates path and target into different entries.",
        "Samples/BackgroundTask/OutOfProc BackgroundTask/cpp-winui/BackgroundTaskBuilder/README.md",
      ),
      warning(
        "duplicate-url-fragment",
        "The in-process and out-of-process READMEs both declare the BackgroundTaskBuilder urlFragment.",
        "Samples/BackgroundTask/OutOfProc BackgroundTask/cpp-winui/BackgroundTaskBuilder/README.md",
      ),
      warning(
        "authored-language-list-incomplete",
        "README frontmatter lists only C++, while the reviewed project inventory also contains C#.",
        "Samples/BackgroundTask/OutOfProc BackgroundTask/cpp-winui/BackgroundTaskBuilder/README.md",
        "/technologies/languages",
      ),
    ],
  }),
  family({
    recordKey: "composition/dynamic-refresh-rate-tool",
    roots: ["Samples/Composition/DynamicRefreshRateTool"],
    sourcePath: "Samples/Composition/DynamicRefreshRateTool",
    metadataSource:
      "Samples/Composition/DynamicRefreshRateTool/cpp-winui/README.md",
    title: "DynamicRefreshRateTool sample",
    upstreamTitle: "DynamicRefreshRateTool sample",
    summary:
      "Demonstrates how to use APIs related to Dynamic Refresh Rate with WinUI 3 applications.",
    aliases: ["Dynamic Refresh Rate Tool"],
    languages: ["C++"],
    projectTypes: ["WinUI 3"],
    packaging: ["MSIX"],
    providerCategories: [],
    portalCategory: "graphics-and-ui",
    tags: ["dynamic-refresh-rate", "display"],
    warnings: [
      warning(
        "malformed-frontmatter",
        "The README extendedZipContent list separates path and target into different entries.",
        "Samples/Composition/DynamicRefreshRateTool/cpp-winui/README.md",
      ),
      warning(
        "root-index-omission",
        "The sample is present in the pinned tree but omitted from the root sample list.",
        rootIndex,
      ),
    ],
  }),
  family({
    recordKey: "custom-controls",
    roots: ["Samples/CustomControls"],
    sourcePath: "Samples/CustomControls",
    metadataSource: "Samples/CustomControls/README.md",
    title: "Custom Controls",
    upstreamTitle: "C# Windows Runtime Component WinUI Controls Sample",
    summary:
      "Shows how to author a Windows Runtime Component in C# with WinUI controls and consume it from C++ and C#.",
    aliases: ["WinUICsComponent", "CppApp", "CppAppUnpackaged", "CsApp"],
    projectTypes: ["WinUI 3", "Windows Runtime Component"],
    packaging: ["MSIX", "unpackaged"],
    documentation: [
      learn(
        "Create a C# component with WinUI 3 controls",
        "https://learn.microsoft.com/windows/apps/develop/platform/csharp-winrt/create-winrt-component-winui-cswinrt",
      ),
    ],
    providerCategories: ["Runtime Components"],
    portalCategory: "user-interface",
    tags: ["custom-controls", "csharp-winrt", "runtime-component"],
  }),
  family({
    recordKey: "deployment-manager",
    roots: ["Samples/DeploymentManager"],
    sourcePath: "Samples/DeploymentManager",
    metadataSource: "Samples/DeploymentManager/README.md",
    title: "Deployment Manager sample",
    upstreamTitle: "Deployment Manager sample",
    summary: "Shows how to use the Windows App Runtime Deployment API.",
    aliases: ["DeploymentManagerSample"],
    projectTypes: ["WinUI 3"],
    packaging: ["MSIX", "unpackaged"],
    apis: [api("Microsoft.Windows.ApplicationModel.WindowsAppRuntime.DeploymentManager")],
    providerCategories: ["Deployment"],
    portalCategory: "deployment",
    tags: ["deployment-manager", "windows-app-runtime"],
  }),
  family({
    recordKey: "input",
    roots: ["Samples/Input"],
    sourcePath: "Samples/Input",
    metadataSource: "Samples/Input/cs-winui/README.md",
    title: "Input Samples",
    upstreamTitle: "Input Samples",
    summary: "Showcases Microsoft.UI.Input API usage.",
    aliases: ["Gesture Recognizer", "Keyboard Shortcut Manager"],
    languages: ["C#"],
    projectTypes: ["WinUI 3"],
    packaging: ["MSIX"],
    apis: [api("Microsoft.UI.Input")],
    providerCategories: [],
    portalCategory: "user-interface",
    tags: ["input", "keyboard", "pointer"],
    warnings: [
      warning(
        "root-index-omission",
        "The sample is present in the pinned tree but omitted from the root sample list.",
        rootIndex,
      ),
    ],
  }),
  family({
    recordKey: "insights",
    roots: ["Samples/Insights"],
    sourcePath: "Samples/Insights",
    metadataSource: "Samples/Insights/cpp-win32/README.md",
    title: "Insights",
    upstreamTitle: null,
    summary: null,
    titleProvenance: provenance("technical", "Samples/Insights"),
    upstreamTitleProvenance: provenance("technical", "Samples/Insights"),
    aliases: ["Insights cpp-win32"],
    languages: ["C++"],
    projectTypes: ["Win32"],
    packaging: ["unpackaged"],
    providerCategories: [],
    portalCategory: "app-fundamentals",
    tags: ["diagnostics", "insights"],
    warnings: [
      warning(
        "root-index-omission",
        "The sample is present in the pinned tree but omitted from the root sample list.",
        rootIndex,
      ),
    ],
  }),
  family({
    recordKey: "installer",
    roots: ["Samples/Installer"],
    sourcePath: "Samples/Installer",
    metadataSource: "Samples/Installer/README.md",
    title: "Installer launch sample",
    upstreamTitle: "Installer launch sample",
    summary:
      "Shows how to use CreateProcess to launch the Windows App SDK installer without a console window.",
    aliases: ["WindowsAppRuntimeInstall.exe"],
    languages: ["C++"],
    projectTypes: ["Console", "Win32"],
    packaging: ["unpackaged"],
    documentation: [
      learn(
        "Downloads for the Windows App SDK",
        "https://learn.microsoft.com/windows/apps/windows-app-sdk/downloads",
      ),
    ],
    requirements: {
      prerequisites: {
        software: [
          "WindowsAppRuntimeInstall.exe downloaded to the configured local path",
        ],
        notes: [
          "The upstream sample assumes WindowsAppRuntimeInstall.exe is in the user's Downloads folder unless main.cpp is changed.",
        ],
      },
    },
    limitations: [
      "The sample executes whichever executable is present at the configured path; use a trusted test installer or harmless test executable to avoid unintended system changes.",
    ],
    providerCategories: ["Deployment"],
    portalCategory: "deployment",
    tags: ["installer", "process-launch"],
  }),
  family({
    recordKey: "islands/simple-island-app",
    roots: ["Samples/Islands/SimpleIslandApp"],
    sourcePath: "Samples/Islands/SimpleIslandApp",
    metadataSource: "Samples/Islands/README.md",
    title: "SimpleIslandApp",
    upstreamTitle: "SimpleIslandApp",
    summary:
      "Shows how to add a Windows App SDK ContentIsland with XAML content to a Win32 app.",
    aliases: ["Simple Island App"],
    languages: ["C++"],
    projectTypes: ["Win32", "WinUI 3"],
    packaging: ["unpackaged", "framework-dependent"],
    requirements: {
      prerequisites: {
        software: ["Windows App SDK runtime installed on the target machine"],
      },
    },
    providerCategories: ["Islands"],
    portalCategory: "user-interface",
    tags: ["content-islands", "xaml", "win32"],
  }),
  family({
    recordKey: "islands/ux-frameworks-on-islands",
    roots: ["Samples/Islands/UXFrameworksOnIslands"],
    sourcePath: "Samples/Islands/UXFrameworksOnIslands",
    metadataSource: "Samples/Islands/README.md",
    title: "UXFrameworksOnIslands",
    upstreamTitle: "UXFrameworksOnIslands",
    summary:
      "Shows how to integrate different UX frameworks in one application using Windows App SDK ContentIsland APIs.",
    aliases: ["UX Frameworks on Islands"],
    languages: ["C++"],
    projectTypes: ["Win32", "WinUI 3"],
    packaging: ["MSIX"],
    providerCategories: ["Islands"],
    portalCategory: "user-interface",
    tags: ["content-islands", "accessibility", "input"],
  }),
  family({
    recordKey: "islands/winforms-island-app",
    roots: [
      "Samples/Islands/cs-winforms-unpackaged",
      "Samples/Islands/SampleWinUIClassLibrary",
    ],
    sourcePath: "Samples/Islands/cs-winforms-unpackaged",
    metadataSource: "Samples/Islands/README.md",
    title: "WinForms Island App",
    upstreamTitle: "WinForms Island App (cs-winforms-unpackaged)",
    summary:
      "Shows how to add a Windows App SDK island with XAML content to a Windows Forms app.",
    aliases: ["cs-winforms-unpackaged", "SampleWinUIClassLibrary"],
    languages: ["C#"],
    projectTypes: ["Windows Forms", "WinUI 3 class library"],
    packaging: ["unpackaged", "framework-dependent"],
    requirements: {
      prerequisites: {
        software: ["Windows App SDK runtime installed on the target machine"],
      },
    },
    providerCategories: ["Islands"],
    portalCategory: "user-interface",
    tags: ["content-islands", "windows-forms", "xaml"],
  }),
  family({
    recordKey: "mica",
    roots: ["Samples/Mica"],
    sourcePath: "Samples/Mica",
    metadataSource: "Samples/Mica/README.md",
    title: "Mica material sample",
    upstreamTitle: "Mica material sample",
    summary:
      "Shows how to use the Mica material in different apps with the Windows App SDK.",
    aliases: ["Mica cpp-win32", "Mica WebView2"],
    languages: ["C++"],
    projectTypes: ["Win32", "WebView2"],
    packaging: ["unpackaged"],
    providerCategories: ["Graphics"],
    portalCategory: "graphics-and-ui",
    tags: ["mica", "materials"],
  }),
  family({
    recordKey: "notifications/app",
    roots: ["Samples/Notifications/App"],
    sourcePath: "Samples/Notifications/App",
    metadataSource: "Samples/Notifications/App/README.md",
    title: "App Notifications Sample",
    upstreamTitle: "App Notifications Sample",
    summary:
      "Demonstrates Windows App SDK App Notifications APIs from unpackaged WinUI apps.",
    aliases: [
      "CsUnpackagedAppNotifications",
      "CppUnpackagedAppNotifications",
    ],
    projectTypes: ["WinUI 3"],
    packaging: ["unpackaged"],
    apis: [api("Microsoft.Windows.AppNotifications")],
    providerCategories: ["Notifications"],
    portalCategory: "notifications",
    tags: ["app-notifications", "toast"],
    scenarios: [
      {
        id: "local-toast-avatar",
        title: "Local toast with avatar image",
        sourcePath: "Samples/Notifications/App/README.md",
      },
      {
        id: "local-toast-avatar-text-box",
        title: "Local toast with avatar and text box",
        sourcePath: "Samples/Notifications/App/README.md",
      },
    ],
    warnings: [
      warning(
        "authored-language-list-incomplete",
        "README frontmatter lists only C++, while the reviewed project inventory also contains C#.",
        "Samples/Notifications/App/README.md",
        "/technologies/languages",
      ),
    ],
  }),
  family({
    recordKey: "notifications/push",
    roots: ["Samples/Notifications/Push"],
    sourcePath: "Samples/Notifications/Push",
    metadataSource: "Samples/Notifications/Push/README.md",
    title: "Push Notifications Sample",
    upstreamTitle: "Push Notifications Sample",
    summary:
      "Demonstrates Windows App SDK Push Notifications APIs from an unpackaged app.",
    aliases: ["PushNotifications"],
    languages: ["C++"],
    projectTypes: ["Console", "Win32"],
    packaging: ["MSIX", "unpackaged"],
    apis: [api("Microsoft.Windows.PushNotifications")],
    documentation: [
      learn(
        "Push notifications overview",
        "https://learn.microsoft.com/windows/apps/windows-app-sdk/notifications/push-notifications/",
      ),
    ],
    requirements: {
      prerequisites: {
        accountsAndServices: ["An Azure AppId for the sample application"],
        software: [
          "A web API tool such as Postman or Fiddler to emulate the external app service",
        ],
        notes: [
          "Replace the zero GUID in the sample with the application's Azure AppId before building.",
        ],
      },
    },
    providerCategories: ["Notifications"],
    portalCategory: "notifications",
    tags: ["push-notifications", "wns"],
  }),
  family({
    recordKey: "photo-editor",
    roots: ["Samples/PhotoEditor"],
    sourcePath: "Samples/PhotoEditor",
    metadataSource: "Samples/PhotoEditor/README.md",
    title: "Photo Editor",
    upstreamTitle: "Photo Editor",
    summary:
      "Shows how to retrieve photos from the Pictures library and edit a selected image with photo effects.",
    aliases: ["PhotoEditor"],
    projectTypes: ["WinUI 3"],
    packaging: ["MSIX"],
    requirements: {
      prerequisites: {
        notes: [
          "The Pictures folder needs image files for the sample to display a collection.",
        ],
      },
    },
    providerCategories: [],
    portalCategory: "graphics-and-ui",
    tags: ["photo-editing", "xaml", "win2d", "data-binding"],
    featuredCandidates: [
      "Samples/PhotoEditor/cpp-winui/PhotoEditor/MainPage.xaml",
      "Samples/PhotoEditor/cpp-winui/PhotoEditor/MainPage.xaml.cpp",
      "Samples/PhotoEditor/cpp-winui/PhotoEditor/DetailPage.xaml.cpp",
      "Samples/PhotoEditor/cs-winui/MainPage.xaml",
      "Samples/PhotoEditor/cs-winui/MainPage.xaml.cs",
      "Samples/PhotoEditor/cs-winui/DetailPage.xaml.cs",
    ],
    warnings: [
      warning(
        "root-index-omission",
        "The sample is present in the pinned tree but omitted from the root sample list.",
        rootIndex,
      ),
      warning(
        "repaired-source-links",
        "Sixteen legacy README link occurrences uniquely map to thirteen reviewed exact-case source files.",
        "Samples/PhotoEditor/README.md",
        "/featuredSourceFiles",
      ),
      warning(
        "media-omitted-size",
        "Both README-linked PhotoEditor images exceed the shared media cap and are preserved only as pinned curation metadata.",
        "Samples/PhotoEditor/README.md",
        "/images",
      ),
    ],
  }),
  family({
    recordKey: "resource-management",
    roots: ["Samples/ResourceManagement"],
    sourcePath: "Samples/ResourceManagement",
    metadataSource: "Samples/ResourceManagement/README.md",
    title: "Load resources using MRT Core",
    upstreamTitle: "Load resources using MRT Core",
    summary:
      "Uses MRT Core ResourceLoader and ResourceManager APIs to load resources from several resource files.",
    aliases: ["ResourceManagement", "MRT Core"],
    projectTypes: ["WinUI 3", "WPF", "class library"],
    packaging: ["MSIX", "unpackaged"],
    apis: [
      api("Microsoft.Windows.ApplicationModel.Resources.ResourceLoader"),
      api("Microsoft.Windows.ApplicationModel.Resources.ResourceManager"),
    ],
    providerCategories: [
      "App Lifecycle and System Services",
      "Data and Files",
    ],
    portalCategory: "data-and-files",
    tags: ["mrt-core", "resources", "localization"],
  }),
  family({
    recordKey: "scene-graph/sample-gallery",
    roots: [
      "Samples/SceneGraph/SampleGalleryApp",
      "Samples/SceneGraph/SampleGalleryPackage",
      "Samples/SceneGraph/SamplesCommon",
    ],
    exactPaths: ["Samples/SceneGraph/SceneGraph.sln"],
    sourcePath: "Samples/SceneGraph/SampleGalleryApp",
    metadataSource: sceneGraphReadme,
    title: "Sample Gallery",
    upstreamTitle: "Sample Gallery",
    summary:
      "A gallery application containing samples that each demonstrate a composition, input, or SceneGraph concept or API.",
    aliases: ["SceneGraph SampleGalleryApp", "WinAppSDK Scene Graph SampleGallery"],
    languages: ["C#"],
    projectTypes: ["WinUI 3"],
    packaging: ["MSIX"],
    providerCategories: ["User Interface and Input"],
    portalCategory: "graphics-and-ui",
    tags: ["composition", "input", "scene-graph"],
    limitations: [
      "The upstream shared code includes early reference implementations, prototypes, and utilities; this wording does not mark this family as deprecated.",
      "Gallery image credits in the upstream README thank Conroy Williamson for contributed images.",
    ],
    warnings: [
      warning(
        "missing-relative-link",
        "The upstream README links STARTUP.md, which is absent from the pinned tree.",
        sceneGraphReadme,
      ),
      warning(
        "missing-relative-link",
        "The upstream README links CONTRIBUTING.md, which is absent from the SceneGraph subtree.",
        sceneGraphReadme,
      ),
      warning(
        "external-media-omitted",
        "The external Giphy animation is not cached or emitted as sample media.",
        sceneGraphReadme,
        "/images",
      ),
    ],
  }),
  family({
    recordKey: "scene-graph/depth-demo",
    roots: ["Samples/SceneGraph/Demos/DepthDemo"],
    sourcePath: "Samples/SceneGraph/Demos/DepthDemo",
    metadataSource: sceneGraphReadme,
    title: "Depth Demo",
    upstreamTitle: null,
    summary: null,
    titleProvenance: provenance(
      "technical",
      "Samples/SceneGraph/Demos/DepthDemo",
    ),
    upstreamTitleProvenance: provenance(
      "technical",
      "Samples/SceneGraph/Demos/DepthDemo",
    ),
    aliases: ["DepthDemo"],
    languages: ["C#"],
    projectTypes: ["WinUI 3"],
    packaging: ["MSIX"],
    providerCategories: ["User Interface and Input"],
    portalCategory: "graphics-and-ui",
    tags: ["composition", "depth"],
  }),
  family({
    recordKey: "scene-graph/effect-editor",
    roots: ["Samples/SceneGraph/Demos/EffectEditor"],
    sourcePath: "Samples/SceneGraph/Demos/EffectEditor",
    metadataSource: sceneGraphReadme,
    title: "Effect Editor",
    upstreamTitle: null,
    summary: null,
    titleProvenance: provenance(
      "technical",
      "Samples/SceneGraph/Demos/EffectEditor",
    ),
    upstreamTitleProvenance: provenance(
      "technical",
      "Samples/SceneGraph/Demos/EffectEditor",
    ),
    aliases: ["EffectEditor"],
    languages: ["C#"],
    projectTypes: ["WinUI 3"],
    packaging: ["MSIX"],
    providerCategories: ["User Interface and Input"],
    portalCategory: "graphics-and-ui",
    tags: ["composition", "effects"],
  }),
  family({
    recordKey: "scene-graph/material-creator",
    roots: ["Samples/SceneGraph/Demos/MaterialCreator"],
    sourcePath: "Samples/SceneGraph/Demos/MaterialCreator",
    metadataSource: sceneGraphReadme,
    title: "Material Creator",
    upstreamTitle: null,
    summary: null,
    titleProvenance: provenance(
      "technical",
      "Samples/SceneGraph/Demos/MaterialCreator",
    ),
    upstreamTitleProvenance: provenance(
      "technical",
      "Samples/SceneGraph/Demos/MaterialCreator",
    ),
    aliases: ["MaterialCreator"],
    languages: ["C#"],
    projectTypes: ["WinUI 3"],
    packaging: ["MSIX"],
    providerCategories: ["User Interface and Input"],
    portalCategory: "graphics-and-ui",
    tags: ["composition", "materials"],
  }),
  family({
    recordKey: "scene-graph/expression-builder",
    roots: ["Samples/SceneGraph/ExpressionBuilder"],
    sourcePath: "Samples/SceneGraph/ExpressionBuilder",
    metadataSource: sceneGraphReadme,
    title: "ExpressionBuilder",
    upstreamTitle: "ExpressionBuilder",
    summary:
      "A set of C# classes for building ExpressionAnimations in a more type-safe environment.",
    aliases: ["Expression Builder"],
    languages: ["C#"],
    projectTypes: ["class library"],
    packaging: ["unpackaged"],
    providerCategories: ["User Interface and Input"],
    portalCategory: "graphics-and-ui",
    tags: ["composition", "expression-animations"],
    licenseRefs: [
      rootLicense,
      `${providerId}:expression-builder-mit`,
    ],
  }),
  family({
    recordKey: "secure-ui",
    roots: ["Samples/SecureUI"],
    sourcePath: "Samples/SecureUI",
    metadataSource: "Samples/SecureUI",
    title: "SecureUI",
    upstreamTitle: null,
    summary: null,
    titleProvenance: provenance("technical", "Samples/SecureUI"),
    upstreamTitleProvenance: provenance("technical", "Samples/SecureUI"),
    aliases: ["Secure UI Test App"],
    languages: ["C++"],
    projectTypes: ["WinUI 3"],
    packaging: ["MSIX"],
    providerCategories: [],
    portalCategory: "security",
    tags: ["secure-ui"],
    warnings: [
      warning(
        "root-index-omission",
        "The sample is present in the pinned tree but omitted from the root sample list.",
        rootIndex,
      ),
    ],
  }),
  family({
    recordKey: "self-contained-deployment",
    roots: ["Samples/SelfContainedDeployment"],
    sourcePath: "Samples/SelfContainedDeployment",
    metadataSource: "Samples/SelfContainedDeployment/README.md",
    title: "Self-contained deployment",
    upstreamTitle: null,
    summary: null,
    titleProvenance: provenance(
      "technical",
      "Samples/SelfContainedDeployment",
    ),
    upstreamTitleProvenance: provenance(
      "technical",
      "Samples/SelfContainedDeployment",
    ),
    aliases: ["SelfContainedDeployment"],
    projectTypes: ["WinUI 3", "Console"],
    packaging: ["MSIX", "unpackaged", "self-contained"],
    providerCategories: [],
    portalCategory: "deployment",
    tags: ["deployment", "self-contained"],
    warnings: [
      warning(
        "root-index-omission",
        "The sample is present in the pinned tree but omitted from the root sample list.",
        rootIndex,
      ),
    ],
  }),
  family({
    recordKey: "text-rendering",
    roots: ["Samples/TextRendering"],
    sourcePath: "Samples/TextRendering",
    metadataSource: "Samples/TextRendering/README.md",
    title: "DWriteCore gallery sample",
    upstreamTitle: "DWriteCore gallery sample",
    summary:
      "Demonstrates DWriteCore, a reimplementation of the Windows DirectWrite API.",
    aliases: ["DWriteCoreGallery"],
    languages: ["C++"],
    projectTypes: ["Win32"],
    packaging: ["MSIX"],
    apis: [api("DWriteCore")],
    providerCategories: ["Graphics"],
    portalCategory: "graphics-and-ui",
    tags: ["directwrite", "dwritecore", "text-rendering"],
    licenseRefs: [
      rootLicense,
      `${providerId}:roboto-mono-apache-2.0`,
    ],
  }),
  family({
    recordKey: "unpackaged",
    roots: ["Samples/Unpackaged"],
    sourcePath: "Samples/Unpackaged",
    metadataSource: "Samples/Unpackaged/README.md",
    title: "Unpackaged App Sample",
    upstreamTitle: "Unpackaged App Sample",
    summary:
      "Demonstrates using the Windows App SDK in non-MSIX deployed applications.",
    aliases: ["Unpackaged"],
    projectTypes: ["Console"],
    packaging: ["unpackaged", "framework-dependent"],
    providerCategories: ["Deployment"],
    portalCategory: "deployment",
    tags: ["deployment", "unpackaged"],
  }),
  family({
    recordKey: "widgets",
    roots: ["Samples/Widgets"],
    sourcePath: "Samples/Widgets",
    metadataSource: "Samples/Widgets/README.md",
    title: "Windows Widgets Samples",
    upstreamTitle: "Windows Widgets Samples",
    summary: "Shows how to author Windows Widgets with the Windows App SDK.",
    aliases: ["WidgetHelper", "SampleWidgetProviderAppPackage"],
    projectTypes: ["Console", "Win32"],
    packaging: ["MSIX"],
    providerCategories: ["Widgets"],
    portalCategory: "user-interface",
    tags: ["widgets"],
  }),
  family({
    recordKey: "windowing",
    roots: ["Samples/Windowing"],
    sourcePath: "Samples/Windowing",
    metadataSource: "Samples/Windowing/README.md",
    title: "Windowing gallery sample",
    upstreamTitle: "Windowing gallery sample",
    summary: "Shows how to use the Windows App SDK windowing APIs.",
    aliases: ["AppWindow", "Windowing WinUI C# Sample"],
    projectTypes: ["WinUI 3", "WPF"],
    packaging: ["MSIX", "unpackaged"],
    apis: [
      api(
        "Microsoft.UI.Windowing.AppWindow",
        "https://learn.microsoft.com/windows/windows-app-sdk/api/winrt/microsoft.ui.windowing.appwindow",
      ),
    ],
    providerCategories: ["User Interface and Input"],
    portalCategory: "user-interface",
    tags: ["appwindow", "title-bar", "windowing"],
  }),
  family({
    recordKey: "windows-ai",
    roots: ["Samples/WindowsAIFoundry"],
    sourcePath: "Samples/WindowsAIFoundry/cs-winui",
    metadataSource: "Samples/WindowsAIFoundry/cs-winui/README.md",
    title: "Windows AI Samples",
    upstreamTitle: "Windows AI Samples",
    summary: "Shows how to use the Windows AI APIs.",
    aliases: ["WindowsAIFoundry", "WindowsAISamples"],
    languages: ["C#"],
    projectTypes: ["WinUI 3"],
    packaging: ["MSIX", "self-contained"],
    documentation: [
      learn(
        "Windows AI APIs",
        "https://learn.microsoft.com/windows/ai/apis/",
      ),
      learn(
        "Get started with Windows AI APIs",
        "https://learn.microsoft.com/windows/ai/apis/model-setup",
      ),
    ],
    requirements: {
      architectures: ["arm64"],
      prerequisites: {
        hardware: ["Copilot+ PC"],
        notes: [
          "Build and run the sample as ARM64.",
          "Windows AI APIs require package identity; unpackaged binaries need identity granted through an external location.",
        ],
      },
    },
    limitations: [
      "Unpackaged configuration without package identity is not supported by Windows AI APIs.",
    ],
    providerCategories: ["Artificial Intelligence"],
    portalCategory: "artificial-intelligence",
    tags: ["copilot-plus-pc", "imaging", "language-model", "ocr"],
  }),
  family({
    recordKey: "windows-ml/console-inference",
    roots: [
      "Samples/WindowsML/cpp/CppConsoleDesktop",
      "Samples/WindowsML/cpp/CppConsoleDesktop.FrameworkDependent",
      "Samples/WindowsML/cpp/CppConsoleDesktop.SelfContained",
      "Samples/WindowsML/cs/CSharpConsoleDesktop",
      "Samples/WindowsML/Shared",
    ],
    exactPaths: ["Samples/WindowsML/WindowsML-Samples.sln"],
    sourcePath: "Samples/WindowsML/cpp/CppConsoleDesktop",
    metadataSource: windowsMlReadme,
    title: "Windows ML console inference",
    upstreamTitle: "Console Applications",
    summary:
      "C++ and C# console samples for ONNX Runtime inference, execution-provider discovery, model compilation, and deployment variants.",
    titleProvenance: provenance("derived", windowsMlReadme),
    summaryProvenance: provenance("derived", windowsMlReadme),
    aliases: [
      "CppConsoleDesktop",
      "CSharpConsoleDesktop",
      "CppConsoleDesktop.FrameworkDependent",
      "CppConsoleDesktop.SelfContained",
    ],
    projectTypes: ["Console"],
    packaging: ["framework-dependent", "self-contained", "unpackaged"],
    providerCategories: ["Artificial Intelligence"],
    portalCategory: "artificial-intelligence",
    tags: ["inference", "onnx-runtime", "windows-ml"],
    requirements: {
      minimumWindowsVersion:
        "Windows 11, version 24H2 (build 26100) or later",
      prerequisites: {
        software: ["Windows App SDK 2.1.3 or later"],
      },
    },
    licenseRefs: [rootLicense, `${providerId}:squeezenet-bsd`],
    warnings: [
      warning(
        "shallow-solution-link",
        "Child README solution links do not resolve from their shallow directories; the aggregate WindowsML-Samples.sln path is curated explicitly.",
        windowsMlReadme,
        "/content/variants",
      ),
    ],
  }),
  family({
    recordKey: "windows-ml/genai",
    roots: [
      "Samples/WindowsML/cpp/CppConsoleDesktop.GenAI",
      "Samples/WindowsML/cs/HelloPhi",
    ],
    sourcePath: "Samples/WindowsML/cpp/CppConsoleDesktop.GenAI",
    metadataSource:
      "Samples/WindowsML/cpp/CppConsoleDesktop.GenAI/README.md",
    title: "ONNX Runtime GenAI examples",
    upstreamTitle: "ONNX Runtime GenAI C Example",
    summary:
      "C and C# examples adapted from the ONNX Runtime GenAI examples.",
    titleProvenance: provenance(
      "derived",
      "Samples/WindowsML/cpp/CppConsoleDesktop.GenAI/README.md",
    ),
    summaryProvenance: provenance(
      "derived",
      "Samples/WindowsML/cpp/CppConsoleDesktop.GenAI/README.md",
    ),
    aliases: ["CppConsoleDesktop.GenAI", "HelloPhi"],
    projectTypes: ["Console"],
    packaging: ["unpackaged"],
    documentation: [
      repositoryLink(
        "ONNX Runtime GenAI C examples",
        "https://github.com/microsoft/onnxruntime-genai/tree/main/examples/c",
      ),
      repositoryLink(
        "ONNX Runtime GenAI C# HelloPhi example",
        "https://github.com/microsoft/onnxruntime-genai/tree/main/examples/csharp/HelloPhi",
      ),
    ],
    requirements: {
      minimumWindowsVersion:
        "Windows 11, version 24H2 (build 26100) or later",
      prerequisites: {
        software: ["Windows App SDK 2.1.3 or later"],
        notes: [
          "A compatible external model must be downloaded separately from a model provider such as Foundry Local or Hugging Face.",
        ],
      },
    },
    limitations: [
      "External GenAI models are not part of the repository snapshot and are not cached by this catalog.",
    ],
    providerCategories: ["Artificial Intelligence"],
    portalCategory: "artificial-intelligence",
    tags: ["genai", "onnx-runtime", "phi"],
    warnings: [
      warning(
        "shallow-solution-link",
        "Both GenAI READMEs link the aggregate solution using a path that is too shallow for their directories.",
        "Samples/WindowsML/cpp/CppConsoleDesktop.GenAI/README.md",
        "/content/variants",
      ),
    ],
  }),
  family({
    recordKey: "windows-ml/abi-execution-providers",
    roots: ["Samples/WindowsML/cpp-abi"],
    sourcePath: "Samples/WindowsML/cpp-abi",
    metadataSource: "Samples/WindowsML/cpp-abi/README.md",
    title: "Windows ML ABI Sample (C++)",
    upstreamTitle: "Windows ML ABI Sample (C++)",
    summary:
      "Demonstrates execution-provider discovery and management through direct ABI and COM interfaces.",
    aliases: ["CppAbiEPEnumerationSample"],
    languages: ["C++"],
    projectTypes: ["Console", "ABI/COM"],
    packaging: ["self-contained", "unpackaged"],
    requirements: {
      minimumWindowsVersion:
        "Windows 11, version 24H2 (build 26100) or later",
      prerequisites: {
        software: [
          "Visual Studio 2022 with the C++ development workload",
          "Windows 11 SDK version 10.0.26100.0 or later",
          "Windows App SDK 1.8 or later runtime",
        ],
      },
    },
    providerCategories: ["Artificial Intelligence"],
    portalCategory: "artificial-intelligence",
    tags: ["abi", "com", "execution-providers", "windows-ml"],
  }),
  family({
    recordKey: "windows-ml/cmake-execution-provider-catalog",
    roots: ["Samples/WindowsML/cpp-cmake"],
    sourcePath: "Samples/WindowsML/cpp-cmake/WinMLEpCatalog",
    metadataSource:
      "Samples/WindowsML/cpp-cmake/WinMLEpCatalog/README.md",
    title: "Windows ML EP Catalog Sample",
    upstreamTitle: "Windows ML EP Catalog Sample (CMake/WinML C API)",
    summary:
      "Demonstrates the WinMLEpCatalog C API for discovering and managing hardware-accelerated execution providers.",
    aliases: ["WinMLEpCatalog", "WinML C API"],
    languages: ["C++"],
    projectTypes: ["CMake", "Console"],
    packaging: ["unpackaged"],
    featuredCandidates: [
      "Samples/WindowsML/cpp-cmake/WinMLEpCatalog/main.cpp",
    ],
    requirements: {
      minimumWindowsVersion:
        "Windows 11, version 24H2 (build 26100) or later",
      prerequisites: {
        software: [
          "Visual Studio 2022 with the C++ workload",
          "CMake 3.21 or later",
          "NuGet CLI available on PATH",
          "Ninja when using the Ninja generator",
        ],
      },
    },
    providerCategories: ["Artificial Intelligence"],
    portalCategory: "artificial-intelligence",
    tags: ["cmake", "execution-providers", "windows-ml"],
  }),
  family({
    recordKey: "windows-ml/desktop-image-classification",
    roots: [
      "Samples/WindowsML/cs-winforms",
      "Samples/WindowsML/cs-winui",
      "Samples/WindowsML/cs-wpf",
      "Samples/WindowsML/Resources",
    ],
    sourcePath: "Samples/WindowsML/cs-winui",
    metadataSource: windowsMlReadme,
    title: "Windows ML desktop image classification",
    upstreamTitle: "GUI Applications",
    summary:
      "Image-classification samples for WinUI 3, Windows Forms, and WPF desktop applications.",
    titleProvenance: provenance("derived", windowsMlReadme),
    summaryProvenance: provenance("derived", windowsMlReadme),
    aliases: [
      "Windows ML WinUI 3 Image Classification Sample",
      "Windows ML WinForms Image Classification Sample",
      "Windows ML WPF Image Classification Sample",
    ],
    languages: ["C#"],
    projectTypes: ["WinUI 3", "Windows Forms", "WPF"],
    packaging: ["MSIX", "unpackaged"],
    requirements: {
      minimumWindowsVersion:
        "Windows 11, version 24H2 (build 26100) or later",
      prerequisites: {
        software: ["Windows App SDK 2.1.3 or later"],
      },
    },
    limitations: [
      "The ResNet-50 model requires conversion with AI Toolkit before use.",
      "External model payloads are not cached by this catalog.",
    ],
    providerCategories: ["Artificial Intelligence"],
    portalCategory: "artificial-intelligence",
    tags: ["image-classification", "onnx-runtime", "windows-ml"],
    licenseRefs: [
      rootLicense,
      `${providerId}:squeezenet-bsd`,
      `${providerId}:resnet50-apache-2.0`,
    ],
    warnings: [
      warning(
        "shallow-solution-link",
        "The GUI sample links are directories; their projects are nested under the reviewed aggregate Windows ML inventory.",
        windowsMlReadme,
        "/content/variants",
      ),
    ],
  }),
  family({
    recordKey: "windows-ml/python-squeezenet",
    roots: ["Samples/WindowsML/python"],
    sourcePath: "Samples/WindowsML/python/SqueezeNetPython",
    metadataSource:
      "Samples/WindowsML/python/SqueezeNetPython/readme.md",
    title: "WindowsML python",
    upstreamTitle: "WindowsML python",
    summary:
      "Shows how to use Windows ML and ONNX Runtime for Python machine-learning projects across Windows AI hardware.",
    aliases: ["SqueezeNetPython"],
    languages: ["Python"],
    projectTypes: ["Python"],
    packaging: ["unpackaged"],
    featuredCandidates: [
      "Samples/WindowsML/python/SqueezeNetPython/main.py",
    ],
    requirements: {
      minimumWindowsVersion:
        "Windows 11, version 24H2 (build 26100) or later",
      architectures: ["arm64", "x64"],
      prerequisites: {
        software: [
          "Python 3.10 through 3.13 installed outside the Microsoft Store",
          "Windows App Runtime matching the Windows ML Python package",
        ],
        notes: [
          "Experimental and preview Windows App SDK package version tags use Python .dev version syntax.",
        ],
      },
    },
    providerCategories: ["Artificial Intelligence"],
    portalCategory: "artificial-intelligence",
    tags: ["python", "squeezenet", "windows-ml"],
    licenseRefs: [rootLicense, `${providerId}:squeezenet-bsd`],
  }),
  family({
    recordKey: "dynamic-dependencies",
    roots: ["DynamicDependenciesSample/DynamicDependencies"],
    sourcePath: "DynamicDependenciesSample/DynamicDependencies",
    metadataSource:
      "DynamicDependenciesSample/DynamicDependencies/README.md",
    title: "Dynamic Dependencies Sample",
    upstreamTitle: "Dynamic Dependencies Sample",
    summary:
      "Demonstrates using Dynamic Dependencies APIs to load MSIX framework packages in an application.",
    aliases: ["DirectX", "DynamicDependencies"],
    languages: ["C++"],
    projectTypes: ["Win32"],
    packaging: ["unpackaged"],
    featuredCandidates: [
      "DynamicDependenciesSample/DynamicDependencies/DirectX/D3D9ExSample.vcxproj",
    ],
    documentation: [
      learn(
        "Use the dynamic dependency API",
        "https://learn.microsoft.com/windows/apps/desktop/modernize/framework-packages/use-the-dynamic-dependency-api",
      ),
    ],
    requirements: {
      prerequisites: {
        software: [
          "DirectX SDK",
          "An architecture-appropriate DirectX framework package",
        ],
      },
    },
    providerCategories: ["Dynamic Dependencies"],
    portalCategory: "deployment",
    tags: ["directx", "dynamic-dependencies", "msix-framework"],
    warnings: [
      warning(
        "provider-source-root-handoff",
        "The shared registry currently allows only Samples; integration must add DynamicDependenciesSample before enabling this provider.",
        "external/providers.json",
        "/source/path",
      ),
    ],
  }),
]);

export const reviewedRenames = Object.freeze([]);
export const reviewedTombstones = Object.freeze([]);

if (familyManifest.length !== 42) {
  throw new Error(
    `needs-curation: expected 42 reviewed families, received ${familyManifest.length}`,
  );
}
