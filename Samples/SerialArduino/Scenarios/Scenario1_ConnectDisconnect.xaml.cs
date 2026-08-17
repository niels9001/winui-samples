using System.Collections.ObjectModel;
using System.Collections.Specialized;
using System.Linq;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Navigation;

namespace SDKTemplate;

public sealed partial class Scenario1_ConnectDisconnect : Page
{
    private readonly MainPage _rootPage = MainPage.Current;
    private readonly SerialArduinoService _serialService = MainPage.Current.SerialService;
    private bool _isActive;
    private bool _isOperationInProgress;
    private int _navigationVersion;

    public Scenario1_ConnectDisconnect()
    {
        InitializeComponent();
    }

    internal ReadOnlyObservableCollection<DeviceListEntry> Devices =>
        _serialService.Devices;

    protected override void OnNavigatedTo(NavigationEventArgs e)
    {
        _isActive = true;
        _navigationVersion++;
        ((INotifyCollectionChanged)Devices).CollectionChanged +=
            Devices_CollectionChanged;
        _serialService.ConnectionChanged += SerialService_ConnectionChanged;
        _serialService.DiscoveryCompleted += SerialService_DiscoveryCompleted;
        UpdateViewState();
    }

    protected override void OnNavigatedFrom(NavigationEventArgs e)
    {
        _isActive = false;
        _navigationVersion++;
        ((INotifyCollectionChanged)Devices).CollectionChanged -=
            Devices_CollectionChanged;
        _serialService.ConnectionChanged -= SerialService_ConnectionChanged;
        _serialService.DiscoveryCompleted -= SerialService_DiscoveryCompleted;
    }

    private async void ConnectButton_Click(object sender, RoutedEventArgs e)
    {
        if (DevicesListView.SelectedItem is not DeviceListEntry device)
        {
            _rootPage.NotifyUser(
                Strings.Get("SelectDeviceFirst"),
                NotifyType.ErrorMessage);
            return;
        }

        int navigationVersion = _navigationVersion;
        _isOperationInProgress = true;
        UpdateViewState();

        try
        {
            SerialConnectResult result = await _serialService.ConnectAsync(device);
            if (!IsCurrentNavigation(navigationVersion))
            {
                return;
            }

            switch (result)
            {
                case SerialConnectResult.AlreadyConnected:
                    _rootPage.NotifyUser(
                        Strings.Format("AlreadyConnectedFormat", device.DisplayName),
                        NotifyType.StatusMessage);
                    break;
                case SerialConnectResult.AnotherDeviceConnected:
                    _rootPage.NotifyUser(
                        Strings.Get("DisconnectCurrentDeviceFirst"),
                        NotifyType.ErrorMessage);
                    break;
                case SerialConnectResult.Unavailable:
                    _rootPage.NotifyUser(
                        Strings.Format(
                            "UnableToOpenDeviceFormat",
                            device.DisplayName),
                        NotifyType.ErrorMessage);
                    break;
            }
        }
        finally
        {
            if (IsCurrentNavigation(navigationVersion))
            {
                _isOperationInProgress = false;
                UpdateViewState();
            }
        }
    }

    private async void DisconnectButton_Click(object sender, RoutedEventArgs e)
    {
        int navigationVersion = _navigationVersion;
        _isOperationInProgress = true;
        UpdateViewState();

        try
        {
            await _serialService.DisconnectAsync();
        }
        finally
        {
            if (IsCurrentNavigation(navigationVersion))
            {
                _isOperationInProgress = false;
                UpdateViewState();
            }
        }
    }

    private void DevicesListView_SelectionChanged(
        object sender,
        SelectionChangedEventArgs e)
    {
        UpdateViewState();
    }

    private void Devices_CollectionChanged(
        object? sender,
        NotifyCollectionChangedEventArgs e)
    {
        if (_isActive && _serialService.IsDiscoveryComplete)
        {
            if (e.Action == NotifyCollectionChangedAction.Add &&
                e.NewItems?[0] is DeviceListEntry addedDevice)
            {
                _rootPage.NotifyUser(
                    Strings.Format(
                        "DeviceAddedFormat",
                        addedDevice.DisplayName),
                    NotifyType.StatusMessage);
            }
            else if (e.Action == NotifyCollectionChangedAction.Remove &&
                     e.OldItems?[0] is DeviceListEntry removedDevice)
            {
                _rootPage.NotifyUser(
                    Strings.Format(
                        "DeviceRemovedFormat",
                        removedDevice.DisplayName),
                    NotifyType.StatusMessage);
            }
        }

        UpdateViewState();
    }

    private void SerialService_ConnectionChanged(
        object? sender,
        SerialConnectionChangedEventArgs e)
    {
        UpdateViewState();
    }

    private void SerialService_DiscoveryCompleted(
        object? sender,
        SerialDiscoveryCompletedEventArgs e)
    {
        if (!_isActive)
        {
            return;
        }

        string message = e.DeviceCount switch
        {
            0 => Strings.Get("NoDevicesFound"),
            1 => Strings.Get("OneDeviceFound"),
            _ => Strings.Format("DevicesFoundFormat", e.DeviceCount),
        };
        _rootPage.NotifyUser(
            message,
            e.DeviceCount == 0
                ? NotifyType.ErrorMessage
                : NotifyType.StatusMessage);
        UpdateViewState();
    }

    private void UpdateViewState()
    {
        if (!_isActive)
        {
            return;
        }

        bool isConnected = _serialService.IsConnected;
        bool hasSelection = DevicesListView.SelectedItem is DeviceListEntry;
        ConnectButton.IsEnabled =
            !_isOperationInProgress && !isConnected && hasSelection;
        DisconnectButton.IsEnabled =
            !_isOperationInProgress && isConnected;
        DevicesListView.IsEnabled =
            !_isOperationInProgress && !isConnected;

        SearchingPanel.Visibility =
            !_serialService.IsDiscoveryComplete && Devices.Count == 0
                ? Visibility.Visible
                : Visibility.Collapsed;
        DiscoveryProgressRing.IsActive =
            SearchingPanel.Visibility == Visibility.Visible;
        EmptyDevicesTextBlock.Visibility =
            _serialService.IsDiscoveryComplete && Devices.Count == 0
                ? Visibility.Visible
                : Visibility.Collapsed;

        DeviceListEntry? connectedDevice = _serialService.ConnectedDevice;
        ConnectionStateTextBlock.Text = connectedDevice is null
            ? Strings.Get("ConnectionStateDisconnected")
            : Strings.Format(
                "ConnectionStateConnectedFormat",
                connectedDevice.DisplayName);

        if (connectedDevice is not null &&
            (DevicesListView.SelectedItem as DeviceListEntry)?.Id !=
                connectedDevice.Id)
        {
            DevicesListView.SelectedItem = Devices.FirstOrDefault(device =>
                device.Id == connectedDevice.Id);
        }
    }

    private bool IsCurrentNavigation(int navigationVersion)
    {
        return _isActive && navigationVersion == _navigationVersion;
    }
}
