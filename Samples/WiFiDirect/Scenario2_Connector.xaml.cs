using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.IO;
using System.Runtime.InteropServices;
using System.Runtime.InteropServices.WindowsRuntime;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Automation;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Navigation;
using Windows.Devices.Enumeration;
using Windows.Devices.WiFiDirect;
using Windows.Networking;
using Windows.Networking.Sockets;
using Windows.Security.Cryptography;
using Windows.Storage.Streams;

namespace SDKTemplate;

public sealed partial class Scenario2_Connector : Page
{
    private readonly MainPage _rootPage = MainPage.Current;

    private DeviceWatcher? _deviceWatcher;
    private bool _isActive;
    private bool _isConnecting;
    private WiFiDirectDevice? _connectingDevice;
    private StreamSocket? _connectingSocket;
    private CancellationTokenSource? _lifetimeCancellation;
    private WiFiDirectAdvertisementPublisher? _publisher;

    public Scenario2_Connector()
    {
        InitializeComponent();
    }

    public ObservableCollection<ConnectedDevice> ConnectedDevices { get; } = [];

    public ObservableCollection<DiscoveredDevice> DiscoveredDevices { get; } = [];

    protected override void OnNavigatedTo(NavigationEventArgs e)
    {
        _isActive = true;
        _lifetimeCancellation = new CancellationTokenSource();
        base.OnNavigatedTo(e);
    }

    protected override void OnNavigatedFrom(NavigationEventArgs e)
    {
        _isActive = false;
        _lifetimeCancellation?.Cancel();
        _lifetimeCancellation?.Dispose();
        _lifetimeCancellation = null;

        ClosePendingConnection();
        StopWatcher(showStatus: false);
        CloseAllConnectedDevices();
        ConnectionSettingsPanel.Reset();
        base.OnNavigatedFrom(e);
    }

    private void CloseAllConnectedDevices()
    {
        while (ConnectedDevices.Count > 0)
        {
            ConnectedDevice connectedDevice = ConnectedDevices[0];
            ConnectedDevices.RemoveAt(0);
            DisposeConnectedDevice(connectedDevice);
        }
    }

    private void CloseDeviceButton_Click(object sender, RoutedEventArgs e)
    {
        if (ConnectedDevicesListView.SelectedItem is not ConnectedDevice connectedDevice)
        {
            return;
        }

        ConnectedDevices.Remove(connectedDevice);
        DisposeConnectedDevice(connectedDevice);
        UpdateConnectedDeviceButtons();
        _rootPage.NotifyUser("The selected connection was closed.", NotifyType.StatusMessage);
    }

    private void ClosePendingConnection()
    {
        StreamSocket? socket = _connectingSocket;
        _connectingSocket = null;
        socket?.Dispose();

        WiFiDirectDevice? device = _connectingDevice;
        _connectingDevice = null;
        if (device is not null)
        {
            device.ConnectionStatusChanged -= OnConnectionStatusChanged;
            device.Dispose();
        }
    }

    private void ConnectedDevicesListView_SelectionChanged(
        object sender,
        SelectionChangedEventArgs e)
    {
        UpdateConnectedDeviceButtons();
    }

    private async void ConnectButton_Click(object sender, RoutedEventArgs e)
    {
        if (DiscoveredDevicesListView.SelectedItem is not DiscoveredDevice discoveredDevice)
        {
            _rootPage.NotifyUser("Select a device before connecting.", NotifyType.ErrorMessage);
            return;
        }

        if (_isConnecting)
        {
            return;
        }

        _isConnecting = true;
        ConnectButton.IsEnabled = false;
        DeviceInformation deviceInformation = discoveredDevice.DeviceInformation;
        _rootPage.NotifyUser(
            $"Connecting to {deviceInformation.Name}...",
            NotifyType.StatusMessage);

        try
        {
            if (!deviceInformation.Pairing.IsPaired
                && !await ConnectionSettingsPanel.RequestPairDeviceAsync(
                    deviceInformation.Pairing))
            {
                return;
            }

            if (!_isActive)
            {
                return;
            }

            try
            {
                _connectingDevice = await WiFiDirectDevice.FromIdAsync(deviceInformation.Id);
            }
            catch (TaskCanceledException)
            {
                _rootPage.NotifyUser(
                    "The connection was canceled by the user.",
                    NotifyType.StatusMessage);
                return;
            }
            catch (COMException exception)
            {
                _rootPage.NotifyUser(
                    $"The Wi-Fi Direct device could not be opened: {exception.Message}",
                    NotifyType.ErrorMessage);
                return;
            }

            if (_connectingDevice is null)
            {
                _rootPage.NotifyUser(
                    "The selected Wi-Fi Direct device is no longer available.",
                    NotifyType.StatusMessage);
                return;
            }

            if (!_isActive)
            {
                return;
            }

            _connectingDevice.ConnectionStatusChanged += OnConnectionStatusChanged;
            IReadOnlyList<EndpointPair> endpointPairs =
                _connectingDevice.GetConnectionEndpointPairs();
            if (endpointPairs.Count == 0)
            {
                _rootPage.NotifyUser(
                    "The peer did not provide a usable Wi-Fi Direct endpoint.",
                    NotifyType.ErrorMessage);
                return;
            }

            HostName remoteHostName = endpointPairs[0].RemoteHostName;
            _rootPage.NotifyUser(
                $"Connected on Wi-Fi Direct. Opening TCP {remoteHostName}:{Globals.ServerPort}...",
                NotifyType.StatusMessage);

            try
            {
                await Task.Delay(
                    TimeSpan.FromSeconds(2),
                    _lifetimeCancellation?.Token ?? CancellationToken.None);
            }
            catch (OperationCanceledException)
            {
                return;
            }

            if (!_isActive)
            {
                return;
            }

            _connectingSocket = new StreamSocket();
            try
            {
                await _connectingSocket.ConnectAsync(remoteHostName, Globals.ServerPort);
            }
            catch (OperationCanceledException)
            {
                if (_isActive)
                {
                    _rootPage.NotifyUser(
                        "The TCP connection was canceled.",
                        NotifyType.StatusMessage);
                }

                return;
            }
            catch (Exception exception) when (Utils.IsExpectedSocketException(exception))
            {
                if (_isActive)
                {
                    _rootPage.NotifyUser(
                        $"The TCP connection could not be opened: {exception.Message}",
                        NotifyType.ErrorMessage);
                }

                return;
            }

            if (!_isActive || _connectingDevice is null || _connectingSocket is null)
            {
                return;
            }

            WiFiDirectDevice connectedDevice = _connectingDevice;
            StreamSocket connectedSocket = _connectingSocket;
            _connectingDevice = null;
            _connectingSocket = null;
            await ProcessConnectedSocketAsync(connectedDevice, connectedSocket);
        }
        catch (COMException exception)
        {
            _rootPage.NotifyUser(
                $"The Wi-Fi Direct connection could not complete: {exception.Message}",
                NotifyType.ErrorMessage);
        }
        finally
        {
            ClosePendingConnection();
            _isConnecting = false;
            UpdateDiscoveredDeviceButtons();
        }
    }

    private void DiscoveredDevicesListView_SelectionChanged(
        object sender,
        SelectionChangedEventArgs e)
    {
        UpdateDiscoveredDeviceButtons();
    }

    private void DisposeConnectedDevice(ConnectedDevice connectedDevice)
    {
        if (connectedDevice.IsDisposed)
        {
            return;
        }

        connectedDevice.WiFiDirectDevice.ConnectionStatusChanged -= OnConnectionStatusChanged;
        connectedDevice.Dispose();
    }

    private static string ReadCustomInformationElement(WiFiDirectInformationElement element)
    {
        using DataReader reader = DataReader.FromBuffer(element.Value);
        reader.UnicodeEncoding = UnicodeEncoding.Utf8;
        reader.ByteOrder = ByteOrder.LittleEndian;

        if (reader.UnconsumedBufferLength < sizeof(uint))
        {
            return "(Unable to parse)";
        }

        uint length = reader.ReadUInt32();
        if (length > reader.UnconsumedBufferLength)
        {
            return "(Unable to parse)";
        }

        try
        {
            return $"Data: {reader.ReadString(length)}";
        }
        catch (Exception exception) when (Utils.IsTextDecodingException(exception))
        {
            return "(Unable to parse)";
        }
    }

    private void OnConnectionStatusChanged(WiFiDirectDevice sender, object args)
    {
        _rootPage.NotifyUser(
            $"Connection status changed: {sender.ConnectionStatus}.",
            NotifyType.StatusMessage);

        if (sender.ConnectionStatus != WiFiDirectConnectionStatus.Disconnected)
        {
            return;
        }

        DispatcherQueue.TryEnqueue(() =>
        {
            for (int index = 0; index < ConnectedDevices.Count; index++)
            {
                ConnectedDevice connectedDevice = ConnectedDevices[index];
                if (ReferenceEquals(connectedDevice.WiFiDirectDevice, sender))
                {
                    ConnectedDevices.RemoveAt(index);
                    DisposeConnectedDevice(connectedDevice);
                    UpdateConnectedDeviceButtons();
                    break;
                }
            }
        });
    }

    private void OnDeviceAdded(DeviceWatcher sender, DeviceInformation deviceInformation)
    {
        DispatcherQueue.TryEnqueue(() =>
        {
            if (ReferenceEquals(sender, _deviceWatcher))
            {
                DiscoveredDevices.Add(new DiscoveredDevice(deviceInformation));
                _rootPage.NotifyUser(
                    $"{DiscoveredDevices.Count} Wi-Fi Direct device(s) found.",
                    NotifyType.StatusMessage);
            }
        });
    }

    private void OnDeviceRemoved(
        DeviceWatcher sender,
        DeviceInformationUpdate deviceInformationUpdate)
    {
        DispatcherQueue.TryEnqueue(() =>
        {
            if (!ReferenceEquals(sender, _deviceWatcher))
            {
                return;
            }

            for (int index = 0; index < DiscoveredDevices.Count; index++)
            {
                DiscoveredDevice discoveredDevice = DiscoveredDevices[index];
                if (discoveredDevice.DeviceInformation.Id == deviceInformationUpdate.Id)
                {
                    DiscoveredDevices.RemoveAt(index);
                    UpdateDiscoveredDeviceButtons();
                    break;
                }
            }
        });
    }

    private void OnDeviceUpdated(
        DeviceWatcher sender,
        DeviceInformationUpdate deviceInformationUpdate)
    {
        DispatcherQueue.TryEnqueue(() =>
        {
            if (!ReferenceEquals(sender, _deviceWatcher))
            {
                return;
            }

            foreach (DiscoveredDevice discoveredDevice in DiscoveredDevices)
            {
                if (discoveredDevice.DeviceInformation.Id == deviceInformationUpdate.Id)
                {
                    discoveredDevice.Update(deviceInformationUpdate);
                    UpdateDiscoveredDeviceButtons();
                    break;
                }
            }
        });
    }

    private void OnEnumerationCompleted(DeviceWatcher sender, object args)
    {
        DispatcherQueue.TryEnqueue(() =>
        {
            if (!ReferenceEquals(sender, _deviceWatcher))
            {
                return;
            }

            string message = DiscoveredDevices.Count == 0
                ? "Discovery completed successfully. No compatible Wi-Fi Direct peers were found."
                : $"Discovery completed. {DiscoveredDevices.Count} Wi-Fi Direct device(s) found; watching for updates.";
            _rootPage.NotifyUser(message, NotifyType.StatusMessage);
        });
    }

    private void OnPublisherStatusChanged(
        WiFiDirectAdvertisementPublisher sender,
        WiFiDirectAdvertisementPublisherStatusChangedEventArgs args)
    {
        if (args.Status != WiFiDirectAdvertisementPublisherStatus.Aborted)
        {
            return;
        }

        DispatcherQueue.TryEnqueue(() =>
        {
            if (!ReferenceEquals(sender, _publisher))
            {
                return;
            }

            StopWatcher(showStatus: false);
            _rootPage.NotifyUser(
                args.Error is WiFiDirectError.RadioNotAvailable or WiFiDirectError.ResourceInUse
                    ? $"Wi-Fi Direct discovery is unavailable on this PC ({args.Error})."
                    : $"Wi-Fi Direct discovery stopped unexpectedly: {args.Error}.",
                args.Error is WiFiDirectError.RadioNotAvailable or WiFiDirectError.ResourceInUse
                    ? NotifyType.StatusMessage
                    : NotifyType.ErrorMessage);
        });
    }

    private void OnWatcherStopped(DeviceWatcher sender, object args)
    {
        DispatcherQueue.TryEnqueue(() =>
        {
            if (ReferenceEquals(sender, _deviceWatcher))
            {
                DeviceWatcherStatus status = sender.Status;
                StopWatcher(showStatus: false);
                _rootPage.NotifyUser(
                    status == DeviceWatcherStatus.Aborted
                        ? "Discovery ended because the watcher was aborted. The Wi-Fi Direct adapter may be unavailable."
                        : "The device watcher stopped.",
                    NotifyType.StatusMessage);
            }
        });
    }

    private async Task ProcessConnectedSocketAsync(
        WiFiDirectDevice wiFiDirectDevice,
        StreamSocket socket)
    {
        var socketReaderWriter = new SocketReaderWriter(socket, _rootPage);
        string sessionId = Path.GetRandomFileName();
        var connectedDevice = new ConnectedDevice(
            sessionId,
            wiFiDirectDevice,
            socketReaderWriter);

        ConnectedDevices.Add(connectedDevice);
        UpdateConnectedDeviceButtons();
        _rootPage.NotifyUser("The TCP connection is open.", NotifyType.StatusMessage);

        try
        {
            await socketReaderWriter.WriteMessageAsync(sessionId);
            while (_isActive && await socketReaderWriter.ReadMessageAsync() is not null)
            {
            }
        }
        finally
        {
            ConnectedDevices.Remove(connectedDevice);
            DisposeConnectedDevice(connectedDevice);
            UpdateConnectedDeviceButtons();
        }
    }

    private void SendMessageTextBox_TextChanged(object sender, TextChangedEventArgs e)
    {
        UpdateConnectedDeviceButtons();
    }

    private async void SendMessageButton_Click(object sender, RoutedEventArgs e)
    {
        if (ConnectedDevicesListView.SelectedItem is ConnectedDevice connectedDevice)
        {
            await connectedDevice.SocketReaderWriter.WriteMessageAsync(
                SendMessageTextBox.Text);
        }
    }

    private void ShowInformationElementsButton_Click(object sender, RoutedEventArgs e)
    {
        if (DiscoveredDevicesListView.SelectedItem is not DiscoveredDevice discoveredDevice)
        {
            return;
        }

        IList<WiFiDirectInformationElement> informationElements;
        try
        {
            informationElements =
                WiFiDirectInformationElement.CreateFromDeviceInformation(
                    discoveredDevice.DeviceInformation);
        }
        catch (ArgumentException exception)
        {
            _rootPage.NotifyUser(
                $"No information elements were available: {exception.Message}",
                NotifyType.StatusMessage);
            return;
        }
        catch (COMException exception)
        {
            _rootPage.NotifyUser(
                $"No information elements were available: {exception.Message}",
                NotifyType.StatusMessage);
            return;
        }

        using var message = new StringWriter();
        foreach (WiFiDirectInformationElement informationElement in informationElements)
        {
            string ouiName = CryptographicBuffer.EncodeToHexString(informationElement.Oui);
            string value = string.Empty;
            byte[] oui = informationElement.Oui.ToArray();

            if (oui.AsSpan().SequenceEqual(Globals.MicrosoftOui))
            {
                ouiName += " (Microsoft)";
            }
            else if (oui.AsSpan().SequenceEqual(Globals.WfaOui))
            {
                ouiName += " (WFA)";
            }
            else if (oui.AsSpan().SequenceEqual(Globals.CustomOui))
            {
                ouiName += " (Custom)";
                if (informationElement.OuiType == Globals.CustomOuiType)
                {
                    value = ReadCustomInformationElement(informationElement);
                }
            }

            message.WriteLine(
                $"OUI {ouiName}, Type {informationElement.OuiType} {value}");
        }

        message.Write($"Information elements found: {informationElements.Count}.");
        _rootPage.NotifyUser(message.ToString(), NotifyType.StatusMessage);
    }

    private void StartWatcher()
    {
        var publisher = new WiFiDirectAdvertisementPublisher();
        _publisher = publisher;
        publisher.StatusChanged += OnPublisherStatusChanged;

        try
        {
            publisher.Start();
        }
        catch (COMException exception)
        {
            publisher.StatusChanged -= OnPublisherStatusChanged;
            _publisher = null;
            _rootPage.NotifyUser(
                $"Wi-Fi Direct discovery is not available on this PC: {exception.Message}",
                NotifyType.StatusMessage);
            return;
        }

        if (publisher.Status == WiFiDirectAdvertisementPublisherStatus.Aborted)
        {
            publisher.StatusChanged -= OnPublisherStatusChanged;
            _publisher = null;
            _rootPage.NotifyUser(
                "Wi-Fi Direct discovery is not available because no usable adapter or radio was found.",
                NotifyType.StatusMessage);
            return;
        }

        DiscoveredDevices.Clear();
        WiFiDirectDeviceSelectorType selectorType =
            Utils.GetSelectedItemTag<WiFiDirectDeviceSelectorType>(
                DeviceSelectorComboBox);
        string selector = WiFiDirectDevice.GetDeviceSelector(selectorType);

        DeviceWatcher watcher;
        try
        {
            watcher = DeviceInformation.CreateWatcher(
                selector,
                ["System.Devices.WiFiDirect.InformationElements"]);
        }
        catch (COMException exception)
        {
            StopPublisher();
            _rootPage.NotifyUser(
                $"Wi-Fi Direct discovery is not available on this PC: {exception.Message}",
                NotifyType.StatusMessage);
            return;
        }

        _deviceWatcher = watcher;
        watcher.Added += OnDeviceAdded;
        watcher.Removed += OnDeviceRemoved;
        watcher.Updated += OnDeviceUpdated;
        watcher.EnumerationCompleted += OnEnumerationCompleted;
        watcher.Stopped += OnWatcherStopped;

        try
        {
            watcher.Start();
        }
        catch (COMException exception)
        {
            DetachWatcher(watcher);
            _deviceWatcher = null;
            StopPublisher();
            _rootPage.NotifyUser(
                $"Wi-Fi Direct discovery is not available on this PC: {exception.Message}",
                NotifyType.StatusMessage);
            return;
        }

        WatcherButton.Content = "Stop watcher";
        AutomationProperties.SetName(
            WatcherButton,
            "Stop Wi-Fi Direct device discovery");
        _rootPage.NotifyUser("Searching for Wi-Fi Direct devices...", NotifyType.StatusMessage);
    }

    private void DetachWatcher(DeviceWatcher watcher)
    {
        watcher.Added -= OnDeviceAdded;
        watcher.Removed -= OnDeviceRemoved;
        watcher.Updated -= OnDeviceUpdated;
        watcher.EnumerationCompleted -= OnEnumerationCompleted;
        watcher.Stopped -= OnWatcherStopped;
    }

    private void StopPublisher()
    {
        WiFiDirectAdvertisementPublisher? publisher = _publisher;
        _publisher = null;
        if (publisher is not null)
        {
            publisher.StatusChanged -= OnPublisherStatusChanged;
        }

        if (publisher?.Status is WiFiDirectAdvertisementPublisherStatus.Created
            or WiFiDirectAdvertisementPublisherStatus.Started)
        {
            publisher.Stop();
        }
    }

    private void StopWatcher(bool showStatus)
    {
        DeviceWatcher? watcher = _deviceWatcher;
        _deviceWatcher = null;

        if (watcher is not null)
        {
            watcher.Added -= OnDeviceAdded;
            watcher.Removed -= OnDeviceRemoved;
            watcher.Updated -= OnDeviceUpdated;
            watcher.EnumerationCompleted -= OnEnumerationCompleted;
            watcher.Stopped -= OnWatcherStopped;

            if (watcher.Status is DeviceWatcherStatus.Started
                or DeviceWatcherStatus.EnumerationCompleted)
            {
                watcher.Stop();
            }
        }

        StopPublisher();
        WatcherButton.Content = "Start watcher";
        AutomationProperties.SetName(
            WatcherButton,
            "Start Wi-Fi Direct device discovery");

        if (showStatus)
        {
            _rootPage.NotifyUser("The device watcher was stopped.", NotifyType.StatusMessage);
        }
    }

    private async void UnpairButton_Click(object sender, RoutedEventArgs e)
    {
        if (DiscoveredDevicesListView.SelectedItem is not DiscoveredDevice discoveredDevice)
        {
            return;
        }

        DeviceUnpairingResult result =
            await discoveredDevice.DeviceInformation.Pairing.UnpairAsync();
        _rootPage.NotifyUser(
            $"Unpair result: {result.Status}.",
            result.Status is DeviceUnpairingResultStatus.Unpaired
                or DeviceUnpairingResultStatus.AlreadyUnpaired
                ? NotifyType.StatusMessage
                : NotifyType.ErrorMessage);
        UpdateDiscoveredDeviceButtons();
    }

    private void UpdateConnectedDeviceButtons()
    {
        bool hasSelection = ConnectedDevicesListView.SelectedItem is ConnectedDevice;
        CloseDeviceButton.IsEnabled = hasSelection;
        SendMessageButton.IsEnabled =
            hasSelection && !string.IsNullOrWhiteSpace(SendMessageTextBox.Text);
    }

    private void UpdateDiscoveredDeviceButtons()
    {
        if (DiscoveredDevicesListView.SelectedItem is not DiscoveredDevice discoveredDevice)
        {
            ConnectButton.IsEnabled = false;
            UnpairButton.IsEnabled = false;
            ShowInformationElementsButton.IsEnabled = false;
            return;
        }

        ShowInformationElementsButton.IsEnabled = true;
        ConnectButton.IsEnabled = !_isConnecting;
        UnpairButton.IsEnabled = discoveredDevice.DeviceInformation.Pairing.IsPaired;
    }

    private void WatcherButton_Click(object sender, RoutedEventArgs e)
    {
        if (_deviceWatcher is null)
        {
            StartWatcher();
        }
        else
        {
            StopWatcher(showStatus: true);
        }
    }
}
