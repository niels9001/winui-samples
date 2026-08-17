using System;
using System.Collections.Generic;

namespace SDKTemplate;

public sealed partial class MainPage
{
    private readonly List<Scenario> _scenarios =
    [
        new(
            Strings.Get("ScenarioBankCardsTitle"),
            typeof(Scenario1_BankCards),
            "BankCardsNavigationItem"),
        new(
            Strings.Get("ScenarioAamvaCardsTitle"),
            typeof(Scenario2_AamvaCards),
            "AamvaCardsNavigationItem"),
    ];
}

internal sealed record Scenario(string Title, Type ClassType, string AutomationId);
