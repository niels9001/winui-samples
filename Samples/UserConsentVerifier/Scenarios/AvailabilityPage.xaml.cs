using System;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Windows.Security.Credentials.UI;

namespace SDKTemplate.Scenarios;

public sealed partial class AvailabilityPage : Page
{
    public AvailabilityPage()
    {
        InitializeComponent();
    }

    private async void CheckAvailabilityButton_Click(
        object sender,
        RoutedEventArgs e)
    {
        CheckAvailabilityButton.IsEnabled = false;

        try
        {
            UserConsentVerifierAvailability availability =
                await UserConsentVerifier.CheckAvailabilityAsync();
            string message = ConsentResultFormatter.Format(availability);
            AvailabilityResultTextBlock.Text = message;
            MainPage.Current.NotifyUser(
                message,
                availability == UserConsentVerifierAvailability.Available
                    ? InfoBarSeverity.Success
                    : InfoBarSeverity.Warning);
        }
        catch (Exception exception)
        {
            AvailabilityResultTextBlock.Text =
                "Availability check failed.";
            MainPage.Current.NotifyOperationError(
                "Checking verification availability",
                exception);
        }
        finally
        {
            CheckAvailabilityButton.IsEnabled = true;
        }
    }
}
