using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Windows.Devices.PointOfService;

namespace SDKTemplate;

public sealed partial class MainPage
{
    private readonly List<Scenario> _scenarios =
    [
        new(
            Strings.Get("ScenarioSelectDisplayTitle"),
            typeof(Scenario1_SelectDisplay),
            "SelectDisplayNavigationItem"),
        new(
            Strings.Get("ScenarioDisplayTextTitle"),
            typeof(Scenario2_DisplayText),
            "DisplayTextNavigationItem"),
        new(
            Strings.Get("ScenarioWindowsTitle"),
            typeof(Scenario3_UsingWindows),
            "WindowsNavigationItem"),
        new(
            Strings.Get("ScenarioAttributesTitle"),
            typeof(Scenario4_UpdatingLineDisplayAttributes),
            "AttributesNavigationItem"),
        new(
            Strings.Get("ScenarioGlyphsTitle"),
            typeof(Scenario5_DefiningCustomGlyphs),
            "GlyphsNavigationItem"),
        new(
            Strings.Get("ScenarioCursorTitle"),
            typeof(Scenario6_ManipulatingCursorAttributes),
            "CursorNavigationItem"),
        new(
            Strings.Get("ScenarioMarqueeTitle"),
            typeof(Scenario7_ScrollingContentUsingMarquee),
            "MarqueeNavigationItem"),
    ];

    internal string? SelectedLineDisplayId { get; set; }

    internal async Task<ClaimedLineDisplay?> ClaimScenarioLineDisplayAsync()
    {
        if (string.IsNullOrEmpty(SelectedLineDisplayId))
        {
            NotifyUser(Strings.Get("SelectLineDisplayFirst"), NotifyType.ErrorMessage);
            return null;
        }

        try
        {
            ClaimedLineDisplay? lineDisplay =
                await ClaimedLineDisplay.FromIdAsync(SelectedLineDisplayId);
            if (lineDisplay is null)
            {
                NotifyUser(
                    Strings.Get("UnableToClaimSelectedLineDisplay"),
                    NotifyType.ErrorMessage);
            }

            return lineDisplay;
        }
        catch (Exception ex)
        {
            NotifyOperationError(Strings.Get("ClaimingLineDisplayOperation"), ex);
            return null;
        }
    }
}

internal sealed record Scenario(string Title, Type ClassType, string AutomationId);
