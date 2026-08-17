using System;
using System.Collections.Generic;

namespace SDKTemplate;

public partial class MainPage
{
    public const string FEATURE_NAME = "Capabilities";

    private readonly List<Scenario> scenarios =
    [
        new()
        {
            Title = "Check capability and set display message",
            ClassType = typeof(Scenario1_Check)
        },
        new()
        {
            Title = "Request multiple capabilities",
            ClassType = typeof(Scenario2_RequestMany)
        },
    ];
}

public sealed class Scenario
{
    public required string Title { get; init; }

    public required Type ClassType { get; init; }
}
