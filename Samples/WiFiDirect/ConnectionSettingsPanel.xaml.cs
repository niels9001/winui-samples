using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Threading.Tasks;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Windows.Devices.Enumeration;
using Windows.Devices.WiFiDirect;

namespace SDKTemplate;

public sealed partial class ConnectionSettingsPanel : UserControl
{
    private readonly MainPage _rootPage = MainPage.Current;
    private readonly List<WiFiDirectConfigurationMethod> _supportedConfigurationMethods = [];

    public ConnectionSettingsPanel()
    {
        InitializeComponent();

        GroupOwnerIntentComboBox.Items.Add(new ComboBoxItem { Content = "Default" });
        for (short intent = 0; intent <= 15; intent++)
        {
            GroupOwnerIntentComboBox.Items.Add(new ComboBoxItem
            {
                Content = intent.ToString(),
                Tag = intent,
            });
        }

        GroupOwnerIntentComboBox.SelectedIndex = 0;
    }

    internal void Reset()
    {
        _supportedConfigurationMethods.Clear();
    }

    internal async Task<bool> RequestPairDeviceAsync(DeviceInformationPairing pairing)
    {
        var connectionParameters = new WiFiDirectConnectionParameters();

        short? groupOwnerIntent =
            Utils.GetSelectedItemTag<short?>(GroupOwnerIntentComboBox);
        if (groupOwnerIntent.HasValue)
        {
            connectionParameters.GroupOwnerIntent = groupOwnerIntent.Value;
        }

        DevicePairingKinds pairingKinds = DevicePairingKinds.None;
        if (_supportedConfigurationMethods.Count > 0)
        {
            foreach (WiFiDirectConfigurationMethod method in _supportedConfigurationMethods)
            {
                connectionParameters.PreferenceOrderedConfigurationMethods.Add(method);
                pairingKinds |= WiFiDirectConnectionParameters.GetDevicePairingKinds(method);
            }
        }
        else
        {
            pairingKinds = DevicePairingKinds.ConfirmOnly
                | DevicePairingKinds.DisplayPin
                | DevicePairingKinds.ProvidePin;
        }

        connectionParameters.PreferredPairingProcedure =
            Utils.GetSelectedItemTag<WiFiDirectPairingProcedure>(PairingProcedureComboBox);

        DeviceInformationCustomPairing customPairing = pairing.Custom;
        customPairing.PairingRequested += OnPairingRequested;

        try
        {
            DevicePairingResult result = await customPairing.PairAsync(
                pairingKinds,
                DevicePairingProtectionLevel.Default,
                connectionParameters);

            bool paired = result.Status is DevicePairingResultStatus.Paired
                or DevicePairingResultStatus.AlreadyPaired;
            if (!paired)
            {
                _rootPage.NotifyUser(
                    $"Pairing did not complete. Status: {result.Status}.",
                    NotifyType.ErrorMessage);
            }

            return paired;
        }
        finally
        {
            customPairing.PairingRequested -= OnPairingRequested;
        }
    }

    private void AddConfigurationMethodButton_Click(object sender, RoutedEventArgs e)
    {
        WiFiDirectConfigurationMethod method =
            Utils.GetSelectedItemTag<WiFiDirectConfigurationMethod>(
                ConfigurationMethodComboBox);

        _supportedConfigurationMethods.Add(method);
        _rootPage.NotifyUser(
            $"Added configuration method {method}.",
            NotifyType.StatusMessage);
    }

    private async void OnPairingRequested(
        DeviceInformationCustomPairing sender,
        DevicePairingRequestedEventArgs args)
    {
        try
        {
            await Utils.HandlePairingAsync(DispatcherQueue, args);
        }
        catch (InvalidOperationException exception)
        {
            _rootPage.NotifyUser(
                $"The pairing dialog could not be shown: {exception.Message}",
                NotifyType.ErrorMessage);
        }
        catch (COMException exception)
        {
            _rootPage.NotifyUser(
                $"Pairing could not continue: {exception.Message}",
                NotifyType.ErrorMessage);
        }
    }
}
