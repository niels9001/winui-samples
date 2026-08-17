using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Navigation;
using Windows.ApplicationModel.Background;
using Windows.Foundation;
using Windows.Networking;
using Windows.Networking.Sockets;
using Windows.Storage;
using Windows.Storage.Streams;

namespace SDKTemplate;

public sealed partial class MainPage : Page
{
    private const int ElementNotFoundHResult = unchecked((int)0x80070490);
    private const string BackgroundTaskEntryPoint = "SocketActivityBackgroundTask.SocketActivityTask";
    private const string BackgroundTaskName = "SocketActivityBackgroundTask";
    private const string HostNameSetting = "hostname";
    private const string Port = "40404";
    private const string PortSetting = "port";
    private const string SocketId = "SampleSocket";

    private IBackgroundTaskRegistration? _backgroundTask;
    private StreamSocket? _socket;

    public MainPage()
    {
        InitializeComponent();
    }

    protected override async void OnNavigatedTo(NavigationEventArgs e)
    {
        string? savedHostName = ApplicationData.Current.LocalSettings.Values[HostNameSetting] as string;
        if (!string.IsNullOrWhiteSpace(savedHostName))
        {
            TargetServerTextBox.Text = savedHostName;
        }

        try
        {
            BackgroundAccessStatus accessStatus = await BackgroundExecutionManager.RequestAccessAsync();
            if (accessStatus is BackgroundAccessStatus.DeniedBySystemPolicy
                or BackgroundAccessStatus.DeniedByUser
                or BackgroundAccessStatus.Denied)
            {
                throw new InvalidOperationException(
                    Strings.Format("BackgroundAccessDeniedFormat", accessStatus));
            }

            _backgroundTask = GetOrRegisterBackgroundTask();

            if (SocketActivityInformation.AllSockets.TryGetValue(SocketId, out SocketActivityInformation? socketInformation))
            {
                StreamSocket existingSocket = socketInformation.StreamSocket;
                existingSocket.TransferOwnership(SocketId);
                SetConnectedState();
                NotifyUser(Strings.Get("ExistingConnectionStatus"), InfoBarSeverity.Success);
            }
            else
            {
                NotifyUser(Strings.Get("ReadyStatus"), InfoBarSeverity.Informational);
            }
        }
        catch (Exception exception)
        {
            SetConnectingState(false);
            NotifyOperationError(Strings.Get("BackgroundTaskSetupOperation"), exception);
        }
    }

    protected override void OnNavigatedFrom(NavigationEventArgs e)
    {
        _socket?.Dispose();
        _socket = null;
    }

    private async void ConnectButton_Click(object sender, RoutedEventArgs e)
    {
        string hostName = TargetServerTextBox.Text.Trim();
        if (string.IsNullOrEmpty(hostName))
        {
            NotifyUser(Strings.Get("HostNameRequiredError"), InfoBarSeverity.Error);
            TargetServerTextBox.Focus(FocusState.Programmatic);
            return;
        }

        if (_backgroundTask is null)
        {
            NotifyUser(Strings.Get("BackgroundTaskUnavailableError"), InfoBarSeverity.Error);
            return;
        }

        SetConnectingState(true);
        NotifyUser(Strings.Format("ConnectingStatusFormat", hostName, Port), InfoBarSeverity.Informational);

        try
        {
            if (!SocketActivityInformation.AllSockets.ContainsKey(SocketId))
            {
                _socket = new StreamSocket();
                bool canWakeFromConnectedStandby = EnableTransferOwnership(_socket, _backgroundTask.TaskId);

                await _socket.ConnectAsync(new HostName(hostName), Port);

                ApplicationData.Current.LocalSettings.Values[HostNameSetting] = hostName;
                ApplicationData.Current.LocalSettings.Values[PortSetting] = Port;

                using var reader = new DataReader(_socket.InputStream)
                {
                    InputStreamOptions = InputStreamOptions.Partial,
                };

                IAsyncOperation<uint> pendingRead = reader.LoadAsync(250);
                await _socket.CancelIOAsync();
                pendingRead.Close();
                reader.DetachStream();

                _socket.TransferOwnership(SocketId);
                _socket = null;

                string statusKey = canWakeFromConnectedStandby
                    ? "ConnectedStatusFormat"
                    : "ConnectedWithoutWakeStatusFormat";
                NotifyUser(Strings.Format(statusKey, hostName, Port), InfoBarSeverity.Success);
            }

            SetConnectedState();
        }
        catch (Exception exception)
        {
            _socket?.Dispose();
            _socket = null;
            SetConnectingState(false);
            NotifyOperationError(Strings.Get("ConnectOperation"), exception);
        }
    }

    private static bool EnableTransferOwnership(StreamSocket socket, Guid backgroundTaskId)
    {
        try
        {
            socket.EnableTransferOwnership(backgroundTaskId, SocketActivityConnectedStandbyAction.Wake);
            return true;
        }
        catch (Exception exception) when (exception.HResult == ElementNotFoundHResult)
        {
            socket.EnableTransferOwnership(backgroundTaskId, SocketActivityConnectedStandbyAction.DoNotWake);
            return false;
        }
    }

    private static IBackgroundTaskRegistration GetOrRegisterBackgroundTask()
    {
        foreach (KeyValuePair<Guid, IBackgroundTaskRegistration> current in BackgroundTaskRegistration.AllTasks)
        {
            if (current.Value.Name == BackgroundTaskName)
            {
                return current.Value;
            }
        }

        var builder = new BackgroundTaskBuilder
        {
            IsNetworkRequested = true,
            Name = BackgroundTaskName,
            TaskEntryPoint = BackgroundTaskEntryPoint,
        };
        builder.SetTrigger(new SocketActivityTrigger());
        return builder.Register();
    }

    private void SetConnectingState(bool isConnecting)
    {
        TargetServerTextBox.IsEnabled = !isConnecting;
        ConnectButton.IsEnabled = !isConnecting;
        ConnectionProgressRing.IsActive = isConnecting;
        ConnectionProgressRing.Visibility = isConnecting ? Visibility.Visible : Visibility.Collapsed;
    }

    private void SetConnectedState()
    {
        TargetServerTextBox.IsEnabled = false;
        ConnectButton.IsEnabled = false;
        ConnectionProgressRing.IsActive = false;
        ConnectionProgressRing.Visibility = Visibility.Collapsed;
    }

    private void NotifyOperationError(string operation, Exception exception)
    {
        NotifyUser(
            Strings.Format("OperationFailedFormat", operation, exception.HResult, exception.Message),
            InfoBarSeverity.Error);
    }

    private void NotifyUser(string message, InfoBarSeverity severity)
    {
        StatusInfoBar.Message = message;
        StatusInfoBar.Severity = severity;
        StatusInfoBar.IsOpen = true;
    }
}
