using System.Collections.Generic;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Navigation;

namespace SDKTemplate;

public sealed partial class Scenario2_LEDTemperature : Page
{
    private readonly MainPage _rootPage = MainPage.Current;
    private readonly SerialArduinoService _serialService = MainPage.Current.SerialService;
    private readonly HashSet<int> _pendingLedPins = [];
    private bool _isActive;
    private bool _isUpdatingSwitches;
    private bool _isTemperaturePending;
    private int _navigationVersion;

    public Scenario2_LEDTemperature()
    {
        InitializeComponent();
    }

    protected override void OnNavigatedTo(NavigationEventArgs e)
    {
        _isActive = true;
        _navigationVersion++;
        _serialService.ConnectionChanged += SerialService_ConnectionChanged;
        UpdateViewState();

        if (_serialService.ConnectedDevice is DeviceListEntry connectedDevice)
        {
            _rootPage.NotifyUser(
                Strings.Format(
                    "ConnectedToDeviceFormat",
                    connectedDevice.DisplayName),
                NotifyType.StatusMessage);
        }
        else
        {
            _rootPage.NotifyUser(
                Strings.Get("ConnectDeviceFirst"),
                NotifyType.ErrorMessage);
        }
    }

    protected override void OnNavigatedFrom(NavigationEventArgs e)
    {
        _isActive = false;
        _navigationVersion++;
        _serialService.ConnectionChanged -= SerialService_ConnectionChanged;
    }

    private void SerialService_ConnectionChanged(
        object? sender,
        SerialConnectionChangedEventArgs e)
    {
        UpdateViewState();
    }

    private async void Led3Switch_Toggled(object sender, RoutedEventArgs e)
    {
        await SetLedAsync(3, (ToggleSwitch)sender);
    }

    private async void Led4Switch_Toggled(object sender, RoutedEventArgs e)
    {
        await SetLedAsync(4, (ToggleSwitch)sender);
    }

    private async void Led5Switch_Toggled(object sender, RoutedEventArgs e)
    {
        await SetLedAsync(5, (ToggleSwitch)sender);
    }

    private async void Led6Switch_Toggled(object sender, RoutedEventArgs e)
    {
        await SetLedAsync(6, (ToggleSwitch)sender);
    }

    private async void ReadTemperatureButton_Click(
        object sender,
        RoutedEventArgs e)
    {
        if (!_serialService.IsConnected)
        {
            _rootPage.NotifyUser(
                Strings.Get("ConnectDeviceFirst"),
                NotifyType.ErrorMessage);
            return;
        }

        int navigationVersion = _navigationVersion;
        _isTemperaturePending = true;
        TemperatureValueTextBox.Text = Strings.Get("TemperatureReadingInProgress");
        UpdateViewState();

        try
        {
            TemperatureReadResult result =
                await _serialService.ReadTemperatureAsync();
            if (!IsCurrentNavigation(navigationVersion))
            {
                return;
            }

            switch (result.Status)
            {
                case SerialOperationStatus.Succeeded:
                    TemperatureValueTextBox.Text = Strings.Format(
                        "TemperatureValueFormat",
                        result.TemperatureCelsius);
                    _rootPage.NotifyUser(
                        result.IsSensorError
                            ? Strings.Format(
                                "TemperatureSensorErrorFormat",
                                result.TemperatureCelsius)
                            : Strings.Format(
                                "TemperatureReadCompletedFormat",
                                result.BytesRead),
                        result.IsSensorError
                            ? NotifyType.ErrorMessage
                            : NotifyType.StatusMessage);
                    break;
                case SerialOperationStatus.NotConnected:
                    TemperatureValueTextBox.Text =
                        Strings.Get("TemperatureUnavailable");
                    _rootPage.NotifyUser(
                        Strings.Get("ConnectDeviceFirst"),
                        NotifyType.ErrorMessage);
                    break;
                case SerialOperationStatus.Failed:
                    TemperatureValueTextBox.Text =
                        Strings.Get("TemperatureUnavailable");
                    break;
                case SerialOperationStatus.Canceled:
                    if (!_serialService.IsConnected)
                    {
                        TemperatureValueTextBox.Text =
                            Strings.Get("TemperatureUnavailable");
                    }

                    break;
            }
        }
        finally
        {
            if (IsCurrentNavigation(navigationVersion))
            {
                _isTemperaturePending = false;
                UpdateViewState();
            }
        }
    }

    private async System.Threading.Tasks.Task SetLedAsync(
        int pin,
        ToggleSwitch toggleSwitch)
    {
        if (_isUpdatingSwitches || !_isActive)
        {
            return;
        }

        bool requestedState = toggleSwitch.IsOn;
        if (!_serialService.IsConnected)
        {
            RestoreToggleState(toggleSwitch, !requestedState);
            _rootPage.NotifyUser(
                Strings.Get("ConnectDeviceFirst"),
                NotifyType.ErrorMessage);
            return;
        }

        int navigationVersion = _navigationVersion;
        _pendingLedPins.Add(pin);
        UpdateViewState();

        try
        {
            SerialWriteResult result =
                await _serialService.SetLedAsync(pin, requestedState);
            if (!IsCurrentNavigation(navigationVersion))
            {
                return;
            }

            switch (result.Status)
            {
                case SerialOperationStatus.Succeeded:
                    _rootPage.NotifyUser(
                        Strings.Format(
                            "LedCommandCompletedFormat",
                            pin,
                            Strings.Get(
                                requestedState
                                    ? "LedStateOn"
                                    : "LedStateOff"),
                            result.BytesWritten),
                        NotifyType.StatusMessage);
                    break;
                case SerialOperationStatus.NotConnected:
                    RestoreToggleState(toggleSwitch, !requestedState);
                    _rootPage.NotifyUser(
                        Strings.Get("ConnectDeviceFirst"),
                        NotifyType.ErrorMessage);
                    break;
                case SerialOperationStatus.Failed:
                    RestoreToggleState(toggleSwitch, !requestedState);
                    break;
            }
        }
        finally
        {
            _pendingLedPins.Remove(pin);
            if (IsCurrentNavigation(navigationVersion))
            {
                UpdateViewState();
            }
        }
    }

    private void RestoreToggleState(ToggleSwitch toggleSwitch, bool isOn)
    {
        _isUpdatingSwitches = true;
        try
        {
            toggleSwitch.IsOn = isOn;
        }
        finally
        {
            _isUpdatingSwitches = false;
        }
    }

    private void UpdateViewState()
    {
        if (!_isActive)
        {
            return;
        }

        bool isConnected = _serialService.IsConnected;
        Led3Switch.IsEnabled = isConnected && !_pendingLedPins.Contains(3);
        Led4Switch.IsEnabled = isConnected && !_pendingLedPins.Contains(4);
        Led5Switch.IsEnabled = isConnected && !_pendingLedPins.Contains(5);
        Led6Switch.IsEnabled = isConnected && !_pendingLedPins.Contains(6);
        ReadTemperatureButton.IsEnabled =
            isConnected && !_isTemperaturePending;
        TemperatureProgressRing.IsActive = _isTemperaturePending;
        TemperatureProgressRing.Visibility = _isTemperaturePending
            ? Visibility.Visible
            : Visibility.Collapsed;

        DeviceListEntry? connectedDevice = _serialService.ConnectedDevice;
        ConnectionStateTextBlock.Text = connectedDevice is null
            ? Strings.Get("ConnectionStateDisconnected")
            : Strings.Format(
                "ConnectionStateConnectedFormat",
                connectedDevice.DisplayName);
    }

    private bool IsCurrentNavigation(int navigationVersion)
    {
        return _isActive && navigationVersion == _navigationVersion;
    }
}
