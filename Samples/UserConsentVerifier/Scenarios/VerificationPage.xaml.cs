using System;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Windows.Security.Credentials.UI;

namespace SDKTemplate.Scenarios;

public sealed partial class VerificationPage : Page
{
    public VerificationPage()
    {
        InitializeComponent();
    }

    private async void RequestVerificationButton_Click(
        object sender,
        RoutedEventArgs e)
    {
        string message = VerificationMessageTextBox.Text.Trim();
        if (string.IsNullOrEmpty(message))
        {
            MainPage.Current.NotifyUser(
                "Enter a message for the Windows verification prompt.",
                InfoBarSeverity.Warning);
            return;
        }

        RequestVerificationButton.IsEnabled = false;
        VerificationMessageTextBox.IsEnabled = false;

        try
        {
            nint hwnd = WinRT.Interop.WindowNative.GetWindowHandle(
                App.MainWindow);
            UserConsentVerificationResult result =
                await UserConsentVerifierInterop
                    .RequestVerificationForWindowAsync(hwnd, message);
            string resultMessage = ConsentResultFormatter.Format(result);
            VerificationResultTextBlock.Text = resultMessage;
            MainPage.Current.NotifyUser(
                resultMessage,
                result == UserConsentVerificationResult.Verified
                    ? InfoBarSeverity.Success
                    : InfoBarSeverity.Warning);
        }
        catch (Exception exception)
        {
            VerificationResultTextBlock.Text =
                "Verification request failed.";
            MainPage.Current.NotifyOperationError(
                "Requesting user verification",
                exception);
        }
        finally
        {
            VerificationMessageTextBox.IsEnabled = true;
            RequestVerificationButton.IsEnabled = true;
        }
    }
}
