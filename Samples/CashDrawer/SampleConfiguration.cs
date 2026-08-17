using System;
using System.Collections.Generic;

namespace SDKTemplate;

public partial class MainPage
{
    public const string FEATURE_NAME = "Cash Drawer";

    private readonly List<Scenario> scenarios =
    [
        new()
        {
            Title = "Drawer claim and open",
            ClassType = typeof(Scenario1_OpenDrawer)
        },
        new()
        {
            Title = "Wait for drawer close",
            ClassType = typeof(Scenario2_CloseDrawer)
        },
        new()
        {
            Title = "Drawer retain and release",
            ClassType = typeof(Scenario3_MultipleDrawers)
        },
    ];
}

public sealed class Scenario
{
    public required string Title { get; init; }

    public required Type ClassType { get; init; }
}
