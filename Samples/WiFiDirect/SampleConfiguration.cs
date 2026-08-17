using System;
using System.Collections.Generic;

namespace SDKTemplate;

public sealed partial class MainPage
{
    public const string FeatureName = "Wi-Fi Direct";

    private static readonly IReadOnlyList<Scenario> Scenarios =
    [
        new("Advertiser", typeof(Scenario1_Advertiser)),
        new("Connector", typeof(Scenario2_Connector)),
    ];
}

internal sealed record Scenario(string Title, Type ClassType);
