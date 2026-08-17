using System;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Windows.Globalization;

namespace SDKTemplate;

public sealed partial class Scenario3_Region : Page
{
    private readonly MainPage rootPage = MainPage.Current;

    public Scenario3_Region()
    {
        InitializeComponent();
    }

    private void ShowResults_Click(object sender, RoutedEventArgs e)
    {
        try
        {
            var userRegion = new GeographicRegion();
            var exampleRegion = new GeographicRegion("JP");

            OutputTextBox.Text =
                "User's preferred geographic region" + Environment.NewLine +
                ReportRegionData(userRegion) +
                Environment.NewLine + Environment.NewLine +
                "Example region from country code (JP)" + Environment.NewLine +
                ReportRegionData(exampleRegion);

            rootPage.NotifyUser(
                "Region characteristics retrieved.",
                NotifyType.StatusMessage);
        }
        catch (Exception ex)
        {
            rootPage.NotifyOperationError(
                "Retrieving region characteristics",
                ex);
        }
    }

    private static string ReportRegionData(GeographicRegion region)
    {
        return
            $"Display name: {region.DisplayName}{Environment.NewLine}" +
            $"Native name: {region.NativeName}{Environment.NewLine}" +
            $"Currencies in use: {string.Join(", ", region.CurrenciesInUse)}" +
            Environment.NewLine +
            $"Codes: {region.CodeTwoLetter}, {region.CodeThreeLetter}, " +
            region.CodeThreeDigit;
    }
}
