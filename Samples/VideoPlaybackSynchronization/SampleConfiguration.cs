using System;
using System.Collections.Generic;

namespace SDKTemplate;

public sealed partial class MainPage
{
    private readonly IReadOnlyList<Scenario> _scenarios =
    [
        new(
            Strings.Get("ScenarioMultiCameraTitle"),
            typeof(MultiCameraPage),
            "MultiCameraNavigationItem"),
        new(
            Strings.Get("ScenarioOffsetTitle"),
            typeof(OffsetSyncPage),
            "OffsetSyncNavigationItem"),
        new(
            Strings.Get("ScenarioAdaptiveTitle"),
            typeof(AdaptiveSyncPage),
            "AdaptiveSyncNavigationItem"),
    ];
}

internal sealed record Scenario(string Title, Type ClassType, string AutomationId);
