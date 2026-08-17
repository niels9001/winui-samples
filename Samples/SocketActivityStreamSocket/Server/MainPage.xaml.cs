using System.Text;
using Microsoft.UI.Dispatching;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Navigation;
using Windows.Networking.Sockets;
using Windows.Storage.Streams;

namespace SDKTemplate;

public sealed partial class MainPage : Page
{
    private const string Port = "40404";

    private StreamSocket? _connectedSocket;
    private StreamSocketListener? _listener;

    public MainPage()
    {
        InitializeComponent();
    }

    protected override async void OnNavigatedTo(NavigationEventArgs e)
    {
        _listener = new StreamSocketListener();
        _listener.ConnectionReceived += Listener_ConnectionReceived;

        try
        {
            await _listener.BindServiceNameAsync(Port);
            NotifyUser(Strings.Format("ListeningStatusFormat", Port), InfoBarSeverity.Informational);
        }
        catch (Exception exception)
        {
            _listener.ConnectionReceived -= Listener_ConnectionReceived;
            _listener.Dispose();
            _listener = null;
            NotifyOperationError(Strings.Get("StartListenerOperation"), exception);
        }
    }

    protected override void OnNavigatedFrom(NavigationEventArgs e)
    {
        if (_listener is not null)
        {
            _listener.ConnectionReceived -= Listener_ConnectionReceived;
            _listener.Dispose();
            _listener = null;
        }

        Interlocked.Exchange(ref _connectedSocket, null)?.Dispose();
    }

    private void Listener_ConnectionReceived(
        StreamSocketListener sender,
        StreamSocketListenerConnectionReceivedEventArgs args)
    {
        Interlocked.Exchange(ref _connectedSocket, args.Socket)?.Dispose();

        DispatcherQueue.TryEnqueue(DispatcherQueuePriority.Normal, () =>
        {
            MessageTextBox.IsEnabled = true;
            SendButton.IsEnabled = true;
            NotifyUser(Strings.Get("ClientConnectedStatus"), InfoBarSeverity.Success);
            MessageTextBox.Focus(FocusState.Programmatic);
        });
    }

    private async void SendButton_Click(object sender, RoutedEventArgs e)
    {
        string message = MessageTextBox.Text;
        if (string.IsNullOrWhiteSpace(message))
        {
            NotifyUser(Strings.Get("MessageRequiredError"), InfoBarSeverity.Error);
            MessageTextBox.Focus(FocusState.Programmatic);
            return;
        }

        StreamSocket? socket = _connectedSocket;
        if (socket is null)
        {
            NotifyUser(Strings.Get("NoClientError"), InfoBarSeverity.Error);
            return;
        }

        SetSendingState(true);

        try
        {
            using var writer = new DataWriter(socket.OutputStream);
            writer.WriteBytes(Encoding.UTF8.GetBytes(message));
            await writer.StoreAsync();
            writer.DetachStream();

            MessageTextBox.Text = string.Empty;
            NotifyUser(Strings.Get("MessageSentStatus"), InfoBarSeverity.Success);
            MessageTextBox.Focus(FocusState.Programmatic);
        }
        catch (Exception exception)
        {
            NotifyOperationError(Strings.Get("SendMessageOperation"), exception);
        }
        finally
        {
            SetSendingState(false);
        }
    }

    private void SetSendingState(bool isSending)
    {
        MessageTextBox.IsEnabled = !isSending;
        SendButton.IsEnabled = !isSending;
        SendProgressRing.IsActive = isSending;
        SendProgressRing.Visibility = isSending ? Visibility.Visible : Visibility.Collapsed;
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
