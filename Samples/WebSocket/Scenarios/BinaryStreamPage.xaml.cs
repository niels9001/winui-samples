using System.Globalization;
using System.IO;
using System.Runtime.InteropServices.WindowsRuntime;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Navigation;
using Windows.Networking.Sockets;
using Windows.Security.Cryptography.Certificates;
using Windows.Web;

namespace SDKTemplate;

public sealed partial class BinaryStreamPage : Page
{
    private readonly MainPage _rootPage = MainPage.Current;
    private StreamWebSocket? _streamWebSocket;
    private CancellationTokenSource? _operationCancellation;
    private Stream? _readStream;
    private Task? _sendTask;
    private Task? _receiveTask;
    private bool _hasCustomValidationHandler;
    private bool _isBusy;
    private bool _isNavigatedAway;

    public BinaryStreamPage()
    {
        InitializeComponent();
        ServerAddressField.Text =
            App.LoopbackServer?.PlainStreamUri.AbsoluteUri ?? string.Empty;
        DataSentField.Text = 0.ToString(CultureInfo.CurrentCulture);
        DataReceivedField.Text = 0.ToString(CultureInfo.CurrentCulture);
        UpdateControls();
    }

    protected override void OnNavigatedFrom(NavigationEventArgs e)
    {
        _isNavigatedAway = true;
        _ = CloseSocketAsync(sendClose: true, reportErrors: false);
        base.OnNavigatedFrom(e);
    }

    private async void OnStart(object sender, RoutedEventArgs e)
    {
        SetBusy(true);
        try
        {
            await StartAsync();
        }
        finally
        {
            if (!_isNavigatedAway)
            {
                SetBusy(false);
            }
        }
    }

    private async Task StartAsync()
    {
        Uri? server = _rootPage.TryGetUri(ServerAddressField.Text);
        if (server is null)
        {
            return;
        }

        var socket = new StreamWebSocket();
        socket.Closed += OnClosed;
        _streamWebSocket = socket;

        if (SecureWebSocketCheckBox.IsChecked == true &&
            server.Scheme == "wss" &&
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
        else if (SecureWebSocketCheckBox.IsChecked == true)
        {
            AppendOutputLine(
                AppResources.Get(
                    server.Scheme == "wss"
                        ? "ExternalCertificateValidation"
                        : "CertificateValidationRequiresWss"));
        }

        AppendOutputLine(AppResources.Format("ConnectingLog", server));
        try
        {
            await socket.ConnectAsync(server);
        }
        catch (Exception exception)
        {
            await ReleaseSocketAsync(
                socket,
                sendClose: false,
                reportErrors: false);
            ReportError(exception);
            return;
        }

        if (!ReferenceEquals(_streamWebSocket, socket))
        {
            socket.Dispose();
            return;
        }

        _operationCancellation = new CancellationTokenSource();
        _readStream = socket.InputStream.AsStreamForRead();
        _receiveTask = ReceiveDataAsync(
            socket,
            _readStream,
            _operationCancellation.Token);
        _sendTask = SendDataAsync(
            socket,
            _operationCancellation.Token);

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

    private async Task SendDataAsync(
        StreamWebSocket activeSocket,
        CancellationToken cancellationToken)
    {
        byte[] data =
        [
            0x00,
            0x01,
            0x02,
            0x03,
            0x04,
            0x05,
            0x06,
            0x07,
            0x08,
            0x09,
        ];
        int bytesSent = 0;
        EnqueueOutput(
            AppResources.Format("BinarySendingStartedLog", data.Length));

        try
        {
            while (!cancellationToken.IsCancellationRequested &&
                ReferenceEquals(_streamWebSocket, activeSocket))
            {
                await activeSocket.OutputStream.WriteAsync(data.AsBuffer());
                bytesSent += data.Length;
                int displayValue = bytesSent;
                DispatcherQueue.TryEnqueue(() =>
                {
                    if (!_isNavigatedAway)
                    {
                        DataSentField.Text = displayValue.ToString(
                            CultureInfo.CurrentCulture);
                    }
                });
                await Task.Delay(TimeSpan.FromSeconds(1), cancellationToken);
            }

            EnqueueOutput(AppResources.Get("BinaryWriteStoppedLog"));
        }
        catch (OperationCanceledException)
            when (cancellationToken.IsCancellationRequested)
        {
            EnqueueOutput(AppResources.Get("BinaryWriteCanceledLog"));
        }
        catch (Exception exception)
        {
            ReportBackgroundError(exception);
        }
    }

    private async Task ReceiveDataAsync(
        StreamWebSocket activeSocket,
        Stream readStream,
        CancellationToken cancellationToken)
    {
        int bytesReceived = 0;
        byte[] readBuffer = new byte[1000];
        EnqueueOutput(AppResources.Get("BinaryReadStartedLog"));

        try
        {
            while (!cancellationToken.IsCancellationRequested &&
                ReferenceEquals(_streamWebSocket, activeSocket))
            {
                int read = await readStream.ReadAsync(
                    readBuffer.AsMemory(),
                    cancellationToken);
                if (read == 0)
                {
                    break;
                }

                bytesReceived += read;
                int displayValue = bytesReceived;
                DispatcherQueue.TryEnqueue(() =>
                {
                    if (!_isNavigatedAway)
                    {
                        DataReceivedField.Text = displayValue.ToString(
                            CultureInfo.CurrentCulture);
                    }
                });
            }

            EnqueueOutput(AppResources.Get("BinaryReadStoppedLog"));
        }
        catch (OperationCanceledException)
            when (cancellationToken.IsCancellationRequested)
        {
            EnqueueOutput(AppResources.Get("BinaryReadCanceledLog"));
        }
        catch (Exception exception)
        {
            ReportBackgroundError(exception);
        }
    }

    private async void OnStop(object sender, RoutedEventArgs e)
    {
        SetBusy(true);
        _rootPage.NotifyUser(
            AppResources.Get("StoppingStatus"),
            NotifyType.StatusMessage);
        await CloseSocketAsync(sendClose: true, reportErrors: true);
        SetBusy(false);
        _rootPage.NotifyUser(
            AppResources.Get("StoppedStatus"),
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
                _ = ReleaseSocketAsync(
                    (StreamWebSocket)sender,
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
                ? App.LoopbackServer.SecureStreamUri
                : App.LoopbackServer.PlainStreamUri).AbsoluteUri;
    }

    private Task CloseSocketAsync(bool sendClose, bool reportErrors)
    {
        return _streamWebSocket is null
            ? Task.CompletedTask
            : ReleaseSocketAsync(
                _streamWebSocket,
                sendClose,
                reportErrors);
    }

    private async Task ReleaseSocketAsync(
        StreamWebSocket socket,
        bool sendClose,
        bool reportErrors)
    {
        bool isCurrent = ReferenceEquals(_streamWebSocket, socket);
        CancellationTokenSource? operationCancellation = null;
        Stream? readStream = null;
        Task? sendTask = null;
        Task? receiveTask = null;

        if (isCurrent)
        {
            _streamWebSocket = null;
            operationCancellation = _operationCancellation;
            readStream = _readStream;
            sendTask = _sendTask;
            receiveTask = _receiveTask;
            _operationCancellation = null;
            _readStream = null;
            _sendTask = null;
            _receiveTask = null;
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
        operationCancellation?.Cancel();

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

        readStream?.Dispose();
        socket.Dispose();
        UpdateControls();

        var tasks = new List<Task>(2);
        if (sendTask is not null)
        {
            tasks.Add(sendTask);
        }

        if (receiveTask is not null)
        {
            tasks.Add(receiveTask);
        }

        if (tasks.Count > 0)
        {
            await Task.WhenAll(tasks);
        }

        operationCancellation?.Dispose();
    }

    private void ReportBackgroundError(Exception exception)
    {
        WebErrorStatus status = WebSocketError.GetStatus(
            exception.GetBaseException().HResult);
        string summary = status == WebErrorStatus.OperationCanceled
            ? AppResources.Get("BinaryOperationCanceledLog")
            : MainPage.BuildWebSocketError(exception);
        DispatcherQueue.TryEnqueue(() =>
        {
            if (_isNavigatedAway)
            {
                return;
            }

            AppendOutputLine(summary);
            if (status != WebErrorStatus.OperationCanceled)
            {
                AppendOutputLine(exception.Message);
                _rootPage.NotifyUser(summary, NotifyType.ErrorMessage);
            }
        });
    }

    private void ReportError(Exception exception)
    {
        string summary = MainPage.BuildWebSocketError(exception);
        AppendOutputLine(summary);
        AppendOutputLine(exception.Message);
        _rootPage.NotifyUser(summary, NotifyType.ErrorMessage);
    }

    private void EnqueueOutput(string value)
    {
        DispatcherQueue.TryEnqueue(() =>
        {
            if (!_isNavigatedAway)
            {
                AppendOutputLine(value);
            }
        });
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
        SecureWebSocketCheckBox.IsEnabled = !_isBusy && !isConnected;
        StartButton.IsEnabled = !_isBusy && !isConnected;
        StopButton.IsEnabled = !_isBusy && isConnected;
    }

    private void AppendOutputLine(string value)
    {
        OutputField.Text += value + Environment.NewLine;
    }
}
