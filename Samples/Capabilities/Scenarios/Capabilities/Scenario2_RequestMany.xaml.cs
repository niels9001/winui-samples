using System;
using System.Collections.Generic;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Windows.Security.Authorization.AppCapabilityAccess;

namespace SDKTemplate;

public sealed partial class Scenario2_RequestMany : Page
{
    private readonly MainPage rootPage = MainPage.Current;

    public Scenario2_RequestMany()
    {
        InitializeComponent();
    }

    private async void RequestAccessButton_Click(object sender, RoutedEventArgs e)
    {
        RequestAccessButton.IsEnabled = false;

        try
        {
            IReadOnlyDictionary<string, AppCapabilityAccessStatus> results =
                await AppCapability.RequestAccessForCapabilitiesAsync(
                    ["location", "webcam"]);

            AppCapabilityAccessStatus locationStatus = results["location"];
            AppCapabilityAccessStatus webcamStatus = results["webcam"];

            rootPage.NotifyUser(
                $"Location: {locationStatus}. Webcam: {webcamStatus}.",
                NotifyType.StatusMessage);
        }
        catch (Exception ex)
        {
            rootPage.NotifyOperationError("Requesting capability access", ex);
        }
        finally
        {
            RequestAccessButton.IsEnabled = true;
        }
    }
}
