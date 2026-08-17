using System;
using System.Collections.Generic;

namespace SDKTemplate;

public sealed partial class MainPage
{
    private readonly List<Scenario> _scenarios =
    [
        new(
            Strings.Get("ScenarioConnectDisconnectTitle"),
            typeof(Scenario1_ConnectDisconnect),
            "ConnectDisconnectNavigationItem"),
        new(
            Strings.Get("ScenarioLedTemperatureTitle"),
            typeof(Scenario2_LEDTemperature),
            "LedTemperatureNavigationItem"),
    ];
}

internal sealed record Scenario(string Title, Type ClassType, string AutomationId);
