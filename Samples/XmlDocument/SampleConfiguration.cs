using System;
using System.Collections.Generic;

namespace SDKTemplate;

public sealed partial class MainPage
{
    private static readonly IReadOnlyList<ScenarioDefinition> Scenarios =
    [
        new("ScenarioBuildRssTitle", "BuildRssNavigationItem", typeof(Scenario1_BuildNewRss)),
        new("ScenarioDomLoadSaveTitle", "DomLoadSaveNavigationItem", typeof(Scenario2_MarkHotProducts)),
        new("ScenarioLoadSettingsTitle", "LoadSettingsNavigationItem", typeof(Scenario3_XmlLoading)),
        new("ScenarioXPathTitle", "XPathNavigationItem", typeof(Scenario4_GiftDispatch)),
        new("ScenarioXsltTitle", "XsltNavigationItem", typeof(Scenario5_XsltTransform)),
    ];
}

internal sealed record ScenarioDefinition(
    string TitleResourceKey,
    string AutomationId,
    Type PageType);
