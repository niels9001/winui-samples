using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Navigation;
using Windows.Networking.Sockets;
using Windows.Security.Cryptography.Certificates;

namespace SDKTemplate;

public sealed partial class ClientAuthenticationPage : Page
{
    private readonly MainPage _rootPage = MainPage.Current;
    private StreamWebSocket? _streamWebSocket;
    private bool _hasCustomValidationHandler;
    private bool _isBusy;
    private bool _isNavigatedAway;

    public ClientAuthenticationPage()
    {
        InitializeComponent();
        ServerAddressField.Text =
            App.LoopbackServer?.ClientAuthenticationUri.AbsoluteUri ??
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

        if (server.Scheme != "wss")
        {
            string error =
                AppResources.Get("ClientAuthenticationRequiresWss");
            AppendOutputLine(error);
            _rootPage.NotifyUser(error, NotifyType.ErrorMessage);
            return;
        }

        LoopbackWebSocketServer? loopbackServer = App.LoopbackServer;
        ClientCertificateService? certificateService =
            App.ClientCertificateService;
        if (loopbackServer is null || certificateService is null)
        {
            _rootPage.NotifyUser(
                AppResources.Get("LoopbackServerUnavailable"),
                NotifyType.ErrorMessage);
            return;
        }

        if (!loopbackServer.IsClientAuthenticationEndpoint(server))
        {
            string error =
                AppResources.Get("ClientAuthenticationLoopbackOnly");
            AppendOutputLine(error);
            _rootPage.NotifyUser(error, NotifyType.ErrorMessage);
            return;
        }

        var socket = new StreamWebSocket();
        socket.Closed += OnClosed;
        socket.ServerCustomValidationRequested +=
            OnServerCustomValidationRequested;
        _hasCustomValidationHandler = true;
        _streamWebSocket = socket;

        try
        {
            AppendOutputLine(
                AppResources.Get("InstallingClientCertificateLog"));
            Certificate certificate =
                await certificateService.GetClientCertificateAsync();
            socket.Control.ClientCertificate = certificate;
            AppendOutputLine(
                AppResources.Format(
                    "ClientCertificateReadyLog",
                    certificate.Subject,
                    certificate.Issuer));

            socket.Control.IgnorableServerCertificateErrors.Add(
                ChainValidationResult.Untrusted);
            socket.Control.IgnorableServerCertificateErrors.Add(
                ChainValidationResult.InvalidName);

            AppendOutputLine(AppResources.Format("ConnectingLog", server));
            await socket.ConnectAsync(server);
        }
        catch (Exception exception)
        {
            ReleaseSocket(socket, sendClose: false, reportErrors: false);
            ReportError(exception);
            return;
        }

        if (!ReferenceEquals(_streamWebSocket, socket))
        {
            socket.Dispose();
            return;
        }

        AppendOutputLine(AppResources.Get("ClientAuthenticatedLog"));
        _rootPage.NotifyUser(
            AppResources.Get("ConnectedStatus"),
            NotifyType.StatusMessage);
    }

    private async void OnServerCustomValidationRequested(
        StreamWebSocket sender,
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
            if (ReferenceEquals(_streamWebSocket, sender))
            {
                ReleaseSocket(
                    (StreamWebSocket)sender,
                    sendClose: false,
                    reportErrors: false);
            }
        });
    }

    private void CloseSocket(bool reportErrors)
    {
        if (_streamWebSocket is not null)
        {
            ReleaseSocket(
                _streamWebSocket,
                sendClose: true,
                reportErrors);
        }
    }

    private void ReleaseSocket(
        StreamWebSocket socket,
        bool sendClose,
        bool reportErrors)
    {
        if (ReferenceEquals(_streamWebSocket, socket))
        {
            _streamWebSocket = null;
        }

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
        bool isConnected = _streamWebSocket is not null;
        ServerAddressField.IsEnabled = !_isBusy && !isConnected;
        ConnectButton.IsEnabled = !_isBusy && !isConnected;
        DisconnectButton.IsEnabled = !_isBusy && isConnected;
    }

    private void AppendOutputLine(string value)
    {
        OutputField.Text += value + Environment.NewLine;
    }
}
