using System;
using System.Collections.Generic;

namespace SDKTemplate;

public sealed partial class MainPage
{
    private readonly List<Scenario> _scenarios =
    [
        new(
            Strings.Get("ScenarioPresetTitle"),
            typeof(TranscodingPage),
            TranscodingScenario.Preset,
            "PresetNavigationItem"),
        new(
            Strings.Get("ScenarioCustomTitle"),
            typeof(TranscodingPage),
            TranscodingScenario.Custom,
            "CustomNavigationItem"),
        new(
            Strings.Get("ScenarioTrimTitle"),
            typeof(TranscodingPage),
            TranscodingScenario.Trim,
            "TrimNavigationItem"),
    ];
}

internal sealed record Scenario(
    string Title,
    Type ClassType,
    TranscodingScenario Parameter,
    string AutomationId);

internal enum TranscodingScenario
{
    Preset,
    Custom,
    Trim,
}
