using System;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Windows.System.UserProfile;

namespace SDKTemplate;

public sealed partial class Scenario1_Prefs : Page
{
    private readonly MainPage rootPage = MainPage.Current;

    public Scenario1_Prefs()
    {
        InitializeComponent();
    }

    private void ShowResults_Click(object sender, RoutedEventArgs e)
    {
        try
        {
            OutputTextBox.Text =
                $"Languages: {string.Join(", ", GlobalizationPreferences.Languages)}" +
                Environment.NewLine +
                $"Home region: {GlobalizationPreferences.HomeGeographicRegion}" +
                Environment.NewLine +
                $"Calendar systems: {string.Join(", ", GlobalizationPreferences.Calendars)}" +
                Environment.NewLine +
                $"Clocks: {string.Join(", ", GlobalizationPreferences.Clocks)}" +
                Environment.NewLine +
                $"First day of the week: {GlobalizationPreferences.WeekStartsOn}";

            rootPage.NotifyUser(
                "User globalization preferences retrieved.",
                NotifyType.StatusMessage);
        }
        catch (Exception ex)
        {
            rootPage.NotifyOperationError(
                "Retrieving globalization preferences",
                ex);
        }
    }
}
