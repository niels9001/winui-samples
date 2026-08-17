using System;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Windows.Security.ExchangeActiveSyncProvisioning;

namespace SDKTemplate;

public sealed partial class Scenario1_GetDeviceInformation : Page
{
    public Scenario1_GetDeviceInformation()
    {
        InitializeComponent();
    }

    private void GetInformation_Click(object sender, RoutedEventArgs e)
    {
        try
        {
            var deviceInformation = new EasClientDeviceInformation();

            DeviceIdTextBox.Text = deviceInformation.Id.ToString();
            OperatingSystemTextBox.Text = DisplayValue(deviceInformation.OperatingSystem);
            FriendlyNameTextBox.Text = DisplayValue(deviceInformation.FriendlyName);
            SystemManufacturerTextBox.Text =
                DisplayValue(deviceInformation.SystemManufacturer);
            SystemProductNameTextBox.Text =
                DisplayValue(deviceInformation.SystemProductName);
            SystemSkuTextBox.Text = DisplayValue(deviceInformation.SystemSku);

            ShowStatus(
                "Device information retrieved.",
                InfoBarSeverity.Success);
        }
        catch (Exception ex)
        {
            ShowStatus(
                $"Retrieving device information failed (0x{ex.HResult:X8}): {ex.Message}",
                InfoBarSeverity.Error);
        }
    }

    private void Reset_Click(object sender, RoutedEventArgs e)
    {
        DeviceIdTextBox.Text = string.Empty;
        OperatingSystemTextBox.Text = string.Empty;
        FriendlyNameTextBox.Text = string.Empty;
        SystemManufacturerTextBox.Text = string.Empty;
        SystemProductNameTextBox.Text = string.Empty;
        SystemSkuTextBox.Text = string.Empty;
        StatusInfoBar.IsOpen = false;
    }

    private void ShowStatus(string message, InfoBarSeverity severity)
    {
        StatusInfoBar.Message = message;
        StatusInfoBar.Severity = severity;
        StatusInfoBar.IsOpen = true;
    }

    private static string DisplayValue(string? value)
    {
        return string.IsNullOrWhiteSpace(value) ? "(not reported)" : value;
    }
}
