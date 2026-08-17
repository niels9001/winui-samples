using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Navigation;
using Windows.Networking.Sockets;
using Windows.Security.Cryptography.Certificates;
using Windows.Storage.Streams;

namespace SDKTemplate;

public sealed partial class PartialMessagesPage : Page
{
    private readonly MainPage _rootPage = MainPage.Current;
    private MessageWebSocket? _messageWebSocket;
    private bool _hasCustomValidationHandler;
    private bool _isBusy;
    private bool _isNavigatedAway;

    public PartialMessagesPage()
    {
        InitializeComponent();
        ServerAddressField.Text =
            App.LoopbackServer?.PlainPartialMessageUri.AbsoluteUri ??
            string.Empty;
        UpdateControls();
    }

    protected override void OnNavigatedFrom(NavigationEventArgs e)
    {
        _isNavigatedAway = true;
        CloseSocket(reportErrors: false);
        base.OnNavigatedFrom(e);
    }

    private async void OnConnect(object sender, RoutedEventArgs e)
    {
        SetBusy(true);
        try
        {
            await ConnectAsync();
        }
        finally
        {
            if (!_isNavigatedAway)
            {
                SetBusy(false);
            }
        }
    }

    private async Task ConnectAsync()
    {
        Uri? server = _rootPage.TryGetUri(ServerAddressField.Text);
        if (server is null)
        {
            return;
        }

        var socket = new MessageWebSocket();
        socket.Control.MessageType = SocketMessageType.Utf8;
        socket.Control.ReceiveMode =
            MessageWebSocketReceiveMode.PartialMessage;
        socket.MessageReceived += OnMessageReceived;
        socket.Closed += OnClosed;
        _messageWebSocket = socket;

        if (server.Scheme == "wss" &&
            App.LoopbackServer?.IsGeneratedSecureEndpoint(server) == true)
        {
            socket.Control.IgnorableServerCertificateErrors.Add(
                ChainValidationResult.Untrusted);
            socket.Control.IgnorableServerCertificateErrors.Add(
                ChainValidationResult.InvalidName);
            socket.ServerCustomValidationRequested +=
                OnServerCustomValidationRequested;
            _hasCustomValidationHandler = true;
        }
        else if (server.Scheme == "wss" &&
            SecureWebSocketCheckBox.IsChecked == true)
        {
            AppendOutputLine(
                AppResources.Get("ExternalCertificateValidation"));
        }

        AppendOutputLine(AppResources.Format("ConnectingLog", server));
        try
        {
            await socket.ConnectAsync(server);
        }
        catch (Exception exception)
        {
            ReleaseSocket(socket, sendClose: false, reportErrors: false);
            ReportError(exception);
            return;
        }

        if (!ReferenceEquals(_messageWebSocket, socket))
        {
            socket.Dispose();
            return;
        }

        _rootPage.NotifyUser(
            AppResources.Get("ConnectedStatus"),
            NotifyType.StatusMessage);
    }

    private async void OnServerCustomValidationRequested(
        MessageWebSocket sender,
        WebSocketServerCustomValidationRequestedEventArgs args)
    {
        bool isValid =
            await WebSocketUtilities.ValidateServerCertificateAsync(args);
        DispatcherQueue.TryEnqueue(() =>
        {
            if (!_isNavigatedAway)
            {
                AppendOutputLine(
                    AppResources.Get(
                        isValid
                            ? "CustomValidationPassed"
                            : "CustomValidationFailed"));
            }
        });
    }

    private async void OnSend(object sender, RoutedEventArgs e)
    {
        SetBusy(true);
        try
        {
            await SendAsync();
        }
        finally
        {
            if (!_isNavigatedAway)
            {
                SetBusy(false);
            }
        }
    }

    private async Task SendAsync()
    {
        MessageWebSocket? socket = _messageWebSocket;
        if (socket is null)
        {
            _rootPage.NotifyUser(
                AppResources.Get("SocketNotConnected"),
                NotifyType.ErrorMessage);
            return;
        }

        string message = InputField.Text;
        if (string.IsNullOrWhiteSpace(message))
        {
            _rootPage.NotifyUser(
                AppResources.Get("TextRequired"),
                NotifyType.ErrorMessage);
            return;
        }

        bool isFinal = EndOfMessageCheckBox.IsChecked == true;
        AppendOutputLine(
            AppResources.Format(
                isFinal ? "SendingFinalFrameLog" : "SendingPartialFrameLog",
                message));

        try
        {
            using var writer = new DataWriter();
            writer.WriteString(message);
            IBuffer buffer = writer.DetachBuffer();
            if (isFinal)
            {
                await socket.SendFinalFrameAsync(buffer);
            }
            else
            {
                await socket.SendNonfinalFrameAsync(buffer);
            }
        }
        catch (Exception exception)
        {
            ReportError(exception);
            return;
        }

        _rootPage.NotifyUser(
            AppResources.Get("SendCompleteStatus"),
            NotifyType.StatusMessage);
    }

    private void OnMessageReceived(
        MessageWebSocket sender,
        MessageWebSocketMessageReceivedEventArgs args)
    {
        string output;
        try
        {
            using DataReader reader = args.GetDataReader();
            reader.UnicodeEncoding = UnicodeEncoding.Utf8;
            string message = reader.ReadString(reader.UnconsumedBufferLength);
            output = AppResources.Format(
                args.IsMessageComplete
                    ? "CompleteFrameReceivedLog"
                    : "PartialFrameReceivedLog",
                args.MessageType,
                message);
        }
        catch (Exception exception)
        {
            output =
                $"{MainPage.BuildWebSocketError(exception)}{Environment.NewLine}" +
                exception.Message;
        }

        DispatcherQueue.TryEnqueue(() =>
        {
            if (!_isNavigatedAway)
            {
                AppendOutputLine(output);
            }
        });
    }

    private void OnDisconnect(object sender, RoutedEventArgs e)
    {
        SetBusy(true);
        _rootPage.NotifyUser(
            AppResources.Get("ClosingStatus"),
            NotifyType.StatusMessage);
        CloseSocket(reportErrors: true);
        SetBusy(false);
        _rootPage.NotifyUser(
            AppResources.Get("ClosedStatus"),
            NotifyType.StatusMessage);
    }

    private void OnClosed(IWebSocket sender, WebSocketClosedEventArgs args)
    {
        ushort code = args.Code;
        string reason = args.Reason;
        DispatcherQueue.TryEnqueue(() =>
        {
            if (_isNavigatedAway)
            {
                return;
            }

            AppendOutputLine(AppResources.Format("ClosedLog", code, reason));
            if (ReferenceEquals(_messageWebSocket, sender))
            {
                ReleaseSocket(
                    (MessageWebSocket)sender,
                    sendClose: false,
                    reportErrors: false);
            }
        });
    }

    private void OnSecureEndpointChanged(object sender, RoutedEventArgs e)
    {
        if (App.LoopbackServer is null)
        {
            return;
        }

        ServerAddressField.Text =
            (SecureWebSocketCheckBox.IsChecked == true
                ? App.LoopbackServer.SecurePartialMessageUri
                : App.LoopbackServer.PlainPartialMessageUri).AbsoluteUri;
    }

    private void CloseSocket(bool reportErrors)
    {
        if (_messageWebSocket is not null)
        {
            ReleaseSocket(
                _messageWebSocket,
                sendClose: true,
                reportErrors);
        }
    }

    private void ReleaseSocket(
        MessageWebSocket socket,
        bool sendClose,
        bool reportErrors)
    {
        if (ReferenceEquals(_messageWebSocket, socket))
        {
            _messageWebSocket = null;
        }

        WebSocketUtilities.TryUnsubscribe(
            () => socket.MessageReceived -= OnMessageReceived);
        WebSocketUtilities.TryUnsubscribe(
            () => socket.Closed -= OnClosed);
        if (_hasCustomValidationHandler)
        {
            WebSocketUtilities.TryUnsubscribe(
                () => socket.ServerCustomValidationRequested -=
                    OnServerCustomValidationRequested);
            _hasCustomValidationHandler = false;
        }

        if (sendClose)
        {
            try
            {
                socket.Close(1000, AppResources.Get("UserRequestedCloseReason"));
            }
            catch (Exception exception)
            {
                if (reportErrors)
                {
                    ReportError(exception);
                }
            }
        }

        socket.Dispose();
        UpdateControls();
    }

    private void ReportError(Exception exception)
    {
        string summary = MainPage.BuildWebSocketError(exception);
        AppendOutputLine(summary);
        AppendOutputLine(exception.Message);
        _rootPage.NotifyUser(summary, NotifyType.ErrorMessage);
    }

    private void SetBusy(bool value)
    {
        _isBusy = value;
        UpdateControls();
    }

    private void UpdateControls()
    {
        bool isConnected = _messageWebSocket is not null;
        ServerAddressField.IsEnabled = !_isBusy && !isConnected;
        SecureWebSocketCheckBox.IsEnabled = !_isBusy && !isConnected;
        ConnectButton.IsEnabled = !_isBusy && !isConnected;
        DisconnectButton.IsEnabled = !_isBusy && isConnected;
        InputField.IsEnabled = !_isBusy && isConnected;
        EndOfMessageCheckBox.IsEnabled = !_isBusy && isConnected;
        SendButton.IsEnabled = !_isBusy && isConnected;
    }

    private void AppendOutputLine(string value)
    {
        OutputField.Text += value + Environment.NewLine;
    }
}
