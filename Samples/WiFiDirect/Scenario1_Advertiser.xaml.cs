using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading.Tasks;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Navigation;
using Windows.Devices.Enumeration;
using Windows.Devices.WiFiDirect;
using Windows.Networking.Sockets;
using Windows.Security.Credentials;
using Windows.Security.Cryptography;
using Windows.Storage.Streams;

namespace SDKTemplate;

public sealed partial class Scenario1_Advertiser : Page
{
    private const int InformationElementPayloadLimit = 240;

    private readonly List<WiFiDirectInformationElement> _informationElements = [];
    private readonly ConcurrentDictionary<StreamSocketListener, WiFiDirectDevice>
        _pendingConnections = new();
    private readonly List<ConnectedDevice> _openingConnections = [];
    private readonly MainPage _rootPage = MainPage.Current;

    private bool _isActive;
    private bool _listenerSubscribed;
    private WiFiDirectConnectionListener? _listener;
    private WiFiDirectAdvertisementPublisher? _publisher;

    public Scenario1_Advertiser()
    {
        InitializeComponent();
    }

    public ObservableCollection<ConnectedDevice> ConnectedDevices { get; } = [];

    protected override void OnNavigatedTo(NavigationEventArgs e)
    {
        _isActive = true;
        base.OnNavigatedTo(e);
    }

    protected override void OnNavigatedFrom(NavigationEventArgs e)
    {
        _isActive = false;
        StopAdvertisement(resetConfiguration: true);
        CloseAllConnectedDevices();
        base.OnNavigatedFrom(e);
    }

    private void AddInformationElementButton_Click(object sender, RoutedEventArgs e)
    {
        string value = InformationElementTextBox.Text.Trim();
        int payloadSize = sizeof(uint) + Encoding.UTF8.GetByteCount(value);
        if (payloadSize > InformationElementPayloadLimit)
        {
            _rootPage.NotifyUser(
                $"The information element payload must be {InformationElementPayloadLimit} bytes or less.",
                NotifyType.ErrorMessage);
            return;
        }

        using var writer = new DataWriter
        {
            ByteOrder = ByteOrder.LittleEndian,
            UnicodeEncoding = Windows.Storage.Streams.UnicodeEncoding.Utf8,
        };
        writer.WriteUInt32(writer.MeasureString(value));
        writer.WriteString(value);

        var informationElement = new WiFiDirectInformationElement
        {
            Oui = CryptographicBuffer.CreateFromByteArray(Globals.CustomOui),
            OuiType = Globals.CustomOuiType,
            Value = writer.DetachBuffer(),
        };

        _informationElements.Add(informationElement);
        InformationElementTextBox.Text = string.Empty;
        _rootPage.NotifyUser("The information element was added.", NotifyType.StatusMessage);
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
        UpdateConnectionButtons();
        _rootPage.NotifyUser("The selected connection was closed.", NotifyType.StatusMessage);
    }

    private void ClosePendingConnections()
    {
        foreach (KeyValuePair<StreamSocketListener, WiFiDirectDevice> pending in _pendingConnections)
        {
            TryClosePendingConnection(pending.Key);
        }

        while (_openingConnections.Count > 0)
        {
            ConnectedDevice openingConnection = _openingConnections[0];
            _openingConnections.RemoveAt(0);
            DisposeConnectedDevice(openingConnection);
        }
    }

    private void ConnectedDevicesListView_SelectionChanged(
        object sender,
        SelectionChangedEventArgs e)
    {
        UpdateConnectionButtons();
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

    private void EnableLegacyModeCheckBox_Changed(object sender, RoutedEventArgs e)
    {
        LegacyCredentialsPanel.Visibility = EnableLegacyModeCheckBox.IsChecked == true
            ? Visibility.Visible
            : Visibility.Collapsed;
    }

    private async Task<bool> HandleConnectionRequestAsync(
        WiFiDirectConnectionRequest connectionRequest)
    {
        WiFiDirectAdvertisementPublisher? requestPublisher = _publisher;
        if (requestPublisher is null || !IsAdvertisementActive(requestPublisher))
        {
            return false;
        }

        DeviceInformation deviceInformation = connectionRequest.DeviceInformation;
        string deviceName = string.IsNullOrWhiteSpace(deviceInformation.Name)
            ? "Unnamed device"
            : deviceInformation.Name;

        bool isPaired = deviceInformation.Pairing.IsPaired
            || await IsAssociationEndpointPairedAsync(deviceInformation.Id);
        if (!IsAdvertisementActive(requestPublisher))
        {
            return false;
        }

        bool legacyModeEnabled = requestPublisher.Advertisement.LegacySettings.IsEnabled;

        if ((isPaired || legacyModeEnabled)
            && !await ShowConnectionRequestDialogAsync(deviceName))
        {
            return false;
        }

        if (!IsAdvertisementActive(requestPublisher))
        {
            return false;
        }

        _rootPage.NotifyUser($"Connecting to {deviceName}...", NotifyType.StatusMessage);

        if (!isPaired
            && !legacyModeEnabled
            && !await ConnectionSettingsPanel.RequestPairDeviceAsync(deviceInformation.Pairing))
        {
            return false;
        }

        if (!IsAdvertisementActive(requestPublisher))
        {
            return false;
        }

        WiFiDirectDevice? wiFiDirectDevice;
        try
        {
            wiFiDirectDevice = await WiFiDirectDevice.FromIdAsync(deviceInformation.Id);
        }
        catch (TaskCanceledException)
        {
            _rootPage.NotifyUser(
                "The connection was canceled by the user.",
                NotifyType.StatusMessage);
            return false;
        }
        catch (COMException exception)
        {
            _rootPage.NotifyUser(
                $"The Wi-Fi Direct device could not be opened: {exception.Message}",
                NotifyType.ErrorMessage);
            return false;
        }

        if (wiFiDirectDevice is null)
        {
            _rootPage.NotifyUser(
                "The Wi-Fi Direct device is no longer available.",
                NotifyType.StatusMessage);
            return false;
        }

        if (!IsAdvertisementActive(requestPublisher))
        {
            wiFiDirectDevice.Dispose();
            return false;
        }

        IReadOnlyList<Windows.Networking.EndpointPair> endpointPairs;
        try
        {
            endpointPairs = wiFiDirectDevice.GetConnectionEndpointPairs();
        }
        catch (COMException exception)
        {
            wiFiDirectDevice.ConnectionStatusChanged -= OnConnectionStatusChanged;
            wiFiDirectDevice.Dispose();
            _rootPage.NotifyUser(
                $"The peer endpoints could not be read: {exception.Message}",
                NotifyType.ErrorMessage);
            return false;
        }
        if (endpointPairs.Count == 0)
        {
            wiFiDirectDevice.ConnectionStatusChanged -= OnConnectionStatusChanged;
            wiFiDirectDevice.Dispose();
            _rootPage.NotifyUser(
                "The peer did not provide a usable Wi-Fi Direct endpoint.",
                NotifyType.ErrorMessage);
            return false;
        }

        var socketListener = new StreamSocketListener();
        socketListener.ConnectionReceived += OnSocketConnectionReceived;
        _pendingConnections[socketListener] = wiFiDirectDevice;
        wiFiDirectDevice.ConnectionStatusChanged += OnConnectionStatusChanged;

        if (wiFiDirectDevice.ConnectionStatus == WiFiDirectConnectionStatus.Disconnected)
        {
            TryClosePendingConnection(socketListener);
            _rootPage.NotifyUser(
                "The peer disconnected before its TCP listener was ready.",
                NotifyType.StatusMessage);
            return false;
        }

        try
        {
            await socketListener.BindEndpointAsync(
                endpointPairs[0].LocalHostName,
                Globals.ServerPort);
        }
        catch (Exception exception) when (Utils.IsExpectedSocketException(exception))
        {
            TryClosePendingConnection(socketListener);
            if (IsAdvertisementActive(requestPublisher))
            {
                _rootPage.NotifyUser(
                    $"The TCP listener could not start: {exception.Message}",
                    NotifyType.ErrorMessage);
            }

            return false;
        }

        if (!IsAdvertisementActive(requestPublisher)
            || !_pendingConnections.ContainsKey(socketListener))
        {
            TryClosePendingConnection(socketListener);
            return false;
        }

        _rootPage.NotifyUser(
            $"Connected on Wi-Fi Direct. Listening on {endpointPairs[0].LocalHostName}:{Globals.ServerPort}.",
            NotifyType.StatusMessage);
        return true;
    }

    private void InformationElementTextBox_TextChanged(
        object sender,
        TextChangedEventArgs e)
    {
        AddInformationElementButton.IsEnabled =
            !string.IsNullOrWhiteSpace(InformationElementTextBox.Text);
    }

    private bool IsAdvertisementActive(WiFiDirectAdvertisementPublisher publisher)
    {
        return _isActive && ReferenceEquals(_publisher, publisher);
    }

    private async Task<bool> IsAssociationEndpointPairedAsync(string deviceId)
    {
        string[] properties = ["System.Devices.Aep.DeviceAddress"];
        DeviceInformation? endpoint;

        try
        {
            endpoint = await DeviceInformation.CreateFromIdAsync(deviceId, properties);
        }
        catch (COMException)
        {
            return false;
        }

        if (endpoint is null
            || !endpoint.Properties.TryGetValue(
                "System.Devices.Aep.DeviceAddress",
                out object? addressValue)
            || addressValue is not string address)
        {
            return false;
        }

        string selector = $"System.Devices.Aep.DeviceAddress:=\"{address}\"";
        DeviceInformationCollection pairedDevices = await DeviceInformation.FindAllAsync(
            selector,
            null,
            DeviceInformationKind.Device);
        return pairedDevices.Count > 0;
    }

    private async void OnConnectionRequested(
        WiFiDirectConnectionListener sender,
        WiFiDirectConnectionRequestedEventArgs args)
    {
        using WiFiDirectConnectionRequest connectionRequest = args.GetConnectionRequest();

        if (!_isActive)
        {
            return;
        }

        bool accepted;
        try
        {
            accepted = await Utils.RunOnDispatcherAsync(
                DispatcherQueue,
                () => HandleConnectionRequestAsync(connectionRequest));
        }
        catch (InvalidOperationException) when (!_isActive)
        {
            return;
        }
        catch (InvalidOperationException exception)
        {
            _rootPage.NotifyUser(
                $"The connection request could not be presented: {exception.Message}",
                NotifyType.ErrorMessage);
            accepted = false;
        }
        catch (COMException exception)
        {
            _rootPage.NotifyUser(
                $"The connection request could not be processed: {exception.Message}",
                NotifyType.ErrorMessage);
            accepted = false;
        }

        if (!accepted)
        {
            _rootPage.NotifyUser(
                $"The connection request from {connectionRequest.DeviceInformation.Name} was not accepted.",
                NotifyType.StatusMessage);
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

        foreach (KeyValuePair<StreamSocketListener, WiFiDirectDevice> pending in _pendingConnections)
        {
            if (!ReferenceEquals(pending.Value, sender))
            {
                continue;
            }

            if (TryClosePendingConnection(pending.Key))
            {
                _rootPage.NotifyUser(
                    "The pending peer disconnected before opening its TCP connection.",
                    NotifyType.StatusMessage);
                return;
            }
        }

        DispatcherQueue.TryEnqueue(() =>
        {
            for (int index = 0; index < _openingConnections.Count; index++)
            {
                ConnectedDevice openingConnection = _openingConnections[index];
                if (ReferenceEquals(openingConnection.WiFiDirectDevice, sender))
                {
                    _openingConnections.RemoveAt(index);
                    DisposeConnectedDevice(openingConnection);
                    return;
                }
            }

            for (int index = 0; index < ConnectedDevices.Count; index++)
            {
                ConnectedDevice connectedDevice = ConnectedDevices[index];
                if (ReferenceEquals(connectedDevice.WiFiDirectDevice, sender))
                {
                    ConnectedDevices.RemoveAt(index);
                    DisposeConnectedDevice(connectedDevice);
                    UpdateConnectionButtons();
                    break;
                }
            }
        });
    }

    private async void OnSocketConnectionReceived(
        StreamSocketListener sender,
        StreamSocketListenerConnectionReceivedEventArgs args)
    {
        if (!_pendingConnections.TryRemove(sender, out WiFiDirectDevice? wiFiDirectDevice))
        {
            args.Socket.Dispose();
            return;
        }

        sender.ConnectionReceived -= OnSocketConnectionReceived;
        sender.Dispose();

        if (!_isActive)
        {
            args.Socket.Dispose();
            wiFiDirectDevice.ConnectionStatusChanged -= OnConnectionStatusChanged;
            wiFiDirectDevice.Dispose();
            return;
        }

        try
        {
            await Utils.RunOnDispatcherAsync(DispatcherQueue, async () =>
            {
                await ProcessSocketConnectionAsync(wiFiDirectDevice, args.Socket);
                return true;
            });
        }
        catch (InvalidOperationException) when (!_isActive)
        {
            args.Socket.Dispose();
            wiFiDirectDevice.ConnectionStatusChanged -= OnConnectionStatusChanged;
            wiFiDirectDevice.Dispose();
        }
    }

    private void OnStatusChanged(
        WiFiDirectAdvertisementPublisher sender,
        WiFiDirectAdvertisementPublisherStatusChangedEventArgs args)
    {
        DispatcherQueue.TryEnqueue(() => UpdatePublisherStatus(sender, args.Error));
    }

    private void PreferGroupOwnerCheckBox_Changed(object sender, RoutedEventArgs e)
    {
        LegacySettingsPanel.Visibility = PreferGroupOwnerCheckBox.IsChecked == true
            ? Visibility.Visible
            : Visibility.Collapsed;
    }

    private async Task ProcessSocketConnectionAsync(
        WiFiDirectDevice wiFiDirectDevice,
        StreamSocket socket)
    {
        if (!_isActive)
        {
            socket.Dispose();
            wiFiDirectDevice.ConnectionStatusChanged -= OnConnectionStatusChanged;
            wiFiDirectDevice.Dispose();
            return;
        }

        var socketReaderWriter = new SocketReaderWriter(socket, _rootPage);
        var connectedDevice = new ConnectedDevice(
            "(connecting)",
            wiFiDirectDevice,
            socketReaderWriter);
        bool isListed = false;
        _openingConnections.Add(connectedDevice);

        try
        {
            _rootPage.NotifyUser(
                "The peer connected to the TCP listener.",
                NotifyType.StatusMessage);

            string? connectionName = await socketReaderWriter.ReadMessageAsync();
            if (connectionName is null || !_isActive)
            {
                return;
            }

            _openingConnections.Remove(connectedDevice);
            connectedDevice.Rename(connectionName);
            ConnectedDevices.Add(connectedDevice);
            isListed = true;
            UpdateConnectionButtons();

            while (_isActive && await socketReaderWriter.ReadMessageAsync() is not null)
            {
            }
        }
        finally
        {
            _openingConnections.Remove(connectedDevice);
            if (isListed)
            {
                ConnectedDevices.Remove(connectedDevice);
                UpdateConnectionButtons();
            }

            DisposeConnectedDevice(connectedDevice);
        }
    }

    private void SendMessageTextBox_TextChanged(object sender, TextChangedEventArgs e)
    {
        UpdateConnectionButtons();
    }

    private async void SendMessageButton_Click(object sender, RoutedEventArgs e)
    {
        if (ConnectedDevicesListView.SelectedItem is ConnectedDevice connectedDevice)
        {
            await connectedDevice.SocketReaderWriter.WriteMessageAsync(
                SendMessageTextBox.Text);
        }
    }

    private async Task<bool> ShowConnectionRequestDialogAsync(string deviceName)
    {
        var dialog = new ContentDialog
        {
            XamlRoot = XamlRoot,
            Title = "Connection request",
            Content = $"Accept the Wi-Fi Direct connection request from {deviceName}?",
            PrimaryButtonText = "Accept",
            CloseButtonText = "Decline",
            DefaultButton = ContentDialogButton.Close,
        };

        return await dialog.ShowAsync() == ContentDialogResult.Primary;
    }

    private void StartAdvertisementButton_Click(object sender, RoutedEventArgs e)
    {
        if (_publisher is not null || !ValidateLegacySettings())
        {
            return;
        }

        var publisher = new WiFiDirectAdvertisementPublisher();
        _publisher = publisher;
        publisher.StatusChanged += OnStatusChanged;

        if (EnableListenerCheckBox.IsChecked == true)
        {
            try
            {
                _listener = new WiFiDirectConnectionListener();
                _listener.ConnectionRequested += OnConnectionRequested;
                _listenerSubscribed = true;
            }
            catch (COMException exception)
            {
                StopAdvertisement(resetConfiguration: false);
                _rootPage.NotifyUser(
                    $"Wi-Fi Direct advertising is not available on this PC: {exception.Message}",
                    NotifyType.StatusMessage);
                return;
            }
        }

        try
        {
            publisher.Advertisement.ListenStateDiscoverability =
                Utils.GetSelectedItemTag<WiFiDirectAdvertisementListenStateDiscoverability>(
                    ListenStateComboBox);
            publisher.Advertisement.IsAutonomousGroupOwnerEnabled =
                PreferGroupOwnerCheckBox.IsChecked == true;

            ConfigureLegacySettings(publisher.Advertisement);

            foreach (WiFiDirectInformationElement informationElement in _informationElements)
            {
                publisher.Advertisement.InformationElements.Add(informationElement);
            }

            publisher.Start();
        }
        catch (ArgumentException exception)
        {
            StopAdvertisement(resetConfiguration: false);
            _rootPage.NotifyUser(
                $"The advertisement settings are not supported: {exception.Message}",
                NotifyType.ErrorMessage);
            return;
        }
        catch (COMException exception)
        {
            StopAdvertisement(resetConfiguration: false);
            _rootPage.NotifyUser(
                $"Wi-Fi Direct advertising is not available on this PC: {exception.Message}",
                NotifyType.StatusMessage);
            return;
        }

        StartAdvertisementButton.IsEnabled = false;
        StopAdvertisementButton.IsEnabled = true;
        UpdatePublisherStatus(publisher, WiFiDirectError.Success);
    }

    private void StopAdvertisement(bool resetConfiguration)
    {
        WiFiDirectAdvertisementPublisher? publisher = _publisher;
        _publisher = null;

        if (publisher is not null)
        {
            publisher.StatusChanged -= OnStatusChanged;
            if (publisher.Status is WiFiDirectAdvertisementPublisherStatus.Created
                or WiFiDirectAdvertisementPublisherStatus.Started)
            {
                publisher.Stop();
            }
        }

        if (_listenerSubscribed && _listener is not null)
        {
            _listener.ConnectionRequested -= OnConnectionRequested;
        }

        _listenerSubscribed = false;
        _listener = null;
        ClosePendingConnections();

        if (resetConfiguration)
        {
            ConnectionSettingsPanel.Reset();
            _informationElements.Clear();
        }

        StartAdvertisementButton.IsEnabled = true;
        StopAdvertisementButton.IsEnabled = false;
    }

    private void StopAdvertisementButton_Click(object sender, RoutedEventArgs e)
    {
        StopAdvertisement(resetConfiguration: true);
        _rootPage.NotifyUser("The advertisement was stopped.", NotifyType.StatusMessage);
    }

    private bool TryClosePendingConnection(StreamSocketListener listener)
    {
        if (!_pendingConnections.TryRemove(listener, out WiFiDirectDevice? device))
        {
            return false;
        }

        listener.ConnectionReceived -= OnSocketConnectionReceived;
        listener.Dispose();
        device.ConnectionStatusChanged -= OnConnectionStatusChanged;
        device.Dispose();
        return true;
    }

    private void UpdateConnectionButtons()
    {
        bool hasSelection = ConnectedDevicesListView.SelectedItem is ConnectedDevice;
        CloseDeviceButton.IsEnabled = hasSelection;
        SendMessageButton.IsEnabled =
            hasSelection && !string.IsNullOrWhiteSpace(SendMessageTextBox.Text);
    }

    private void UpdatePublisherStatus(
        WiFiDirectAdvertisementPublisher sender,
        WiFiDirectError error)
    {
        if (!ReferenceEquals(sender, _publisher))
        {
            return;
        }

        if (sender.Status == WiFiDirectAdvertisementPublisherStatus.Started)
        {
            if (sender.Advertisement.LegacySettings.IsEnabled)
            {
                if (string.IsNullOrEmpty(PassphraseBox.Password))
                {
                    PassphraseBox.Password =
                        sender.Advertisement.LegacySettings.Passphrase.Password;
                }

                if (string.IsNullOrEmpty(SsidTextBox.Text))
                {
                    SsidTextBox.Text = sender.Advertisement.LegacySettings.Ssid;
                }
            }

            _rootPage.NotifyUser("The Wi-Fi Direct advertisement started.", NotifyType.StatusMessage);
            return;
        }

        if (sender.Status == WiFiDirectAdvertisementPublisherStatus.Aborted)
        {
            StopAdvertisement(resetConfiguration: false);

            if (error is WiFiDirectError.RadioNotAvailable or WiFiDirectError.ResourceInUse)
            {
                _rootPage.NotifyUser(
                    $"Wi-Fi Direct advertising is unavailable on this PC ({error}).",
                    NotifyType.StatusMessage);
            }
            else
            {
                _rootPage.NotifyUser(
                    $"The advertisement stopped unexpectedly: {error}.",
                    NotifyType.ErrorMessage);
            }

            return;
        }

        if (sender.Status == WiFiDirectAdvertisementPublisherStatus.Stopped)
        {
            StopAdvertisement(resetConfiguration: false);
            _rootPage.NotifyUser("The Wi-Fi Direct advertisement stopped.", NotifyType.StatusMessage);
            return;
        }

        _rootPage.NotifyUser("Starting the Wi-Fi Direct advertisement...", NotifyType.StatusMessage);
    }

    private bool ValidateLegacySettings()
    {
        if (PreferGroupOwnerCheckBox.IsChecked != true
            || EnableLegacyModeCheckBox.IsChecked != true)
        {
            return true;
        }

        if (!string.IsNullOrEmpty(PassphraseBox.Password)
            && PassphraseBox.Password.Length is < 8 or > 63)
        {
            _rootPage.NotifyUser(
                "A legacy Wi-Fi passphrase must contain 8 to 63 characters.",
                NotifyType.ErrorMessage);
            return false;
        }

        if (Encoding.UTF8.GetByteCount(SsidTextBox.Text) > 32)
        {
            _rootPage.NotifyUser(
                "A legacy Wi-Fi SSID must be 32 bytes or less.",
                NotifyType.ErrorMessage);
            return false;
        }

        return true;
    }

    private void ConfigureLegacySettings(WiFiDirectAdvertisement advertisement)
    {
        if (!advertisement.IsAutonomousGroupOwnerEnabled
            || EnableLegacyModeCheckBox.IsChecked != true)
        {
            return;
        }

        advertisement.LegacySettings.IsEnabled = true;

        if (!string.IsNullOrEmpty(PassphraseBox.Password))
        {
            advertisement.LegacySettings.Passphrase = new PasswordCredential
            {
                Password = PassphraseBox.Password,
            };
        }

        if (!string.IsNullOrWhiteSpace(SsidTextBox.Text))
        {
            advertisement.LegacySettings.Ssid = SsidTextBox.Text.Trim();
        }
    }
}
