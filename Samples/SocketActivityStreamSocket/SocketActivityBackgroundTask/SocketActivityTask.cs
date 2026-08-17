using System.Text;
using Windows.ApplicationModel.Background;
using Windows.Networking;
using Windows.Networking.Sockets;
using Windows.Storage;
using Windows.Storage.Streams;
using Windows.UI.Notifications;

namespace SocketActivityBackgroundTask;

public sealed class SocketActivityTask : IBackgroundTask
{
    private const int ElementNotFoundHResult = unchecked((int)0x80070490);
    private const string HostNameSetting = "hostname";
    private const string PortSetting = "port";
    private const string SocketId = "SampleSocket";

    public async void Run(IBackgroundTaskInstance taskInstance)
    {
        BackgroundTaskDeferral deferral = taskInstance.GetDeferral();

        try
        {
            if (taskInstance.TriggerDetails is not SocketActivityTriggerDetails details)
            {
                throw new InvalidOperationException("Socket activity details were not available.");
            }

            switch (details.Reason)
            {
                case SocketActivityTriggerReason.SocketActivity:
                    await ReadMessageAsync(details.SocketInformation);
                    break;

                case SocketActivityTriggerReason.KeepAliveTimerExpired:
                    await SendKeepAliveAsync(details.SocketInformation);
                    break;

                case SocketActivityTriggerReason.SocketClosed:
                    await ReconnectAsync(taskInstance.Task.TaskId);
                    break;
            }
        }
        catch (Exception exception)
        {
            ShowToast("Socket activity error", exception.Message);
        }
        finally
        {
            deferral.Complete();
        }
    }

    private static async Task ReadMessageAsync(SocketActivityInformation socketInformation)
    {
        StreamSocket socket = socketInformation.StreamSocket;

        using (var reader = new DataReader(socket.InputStream)
        {
            InputStreamOptions = InputStreamOptions.Partial,
        })
        {
            await reader.LoadAsync(250);
            string message = reader.ReadString(reader.UnconsumedBufferLength);
            reader.DetachStream();

            ShowToast("Socket activity", string.IsNullOrEmpty(message)
                ? "An empty message was received."
                : message);
        }

        socket.TransferOwnership(socketInformation.Id);
    }

    private static async Task SendKeepAliveAsync(SocketActivityInformation socketInformation)
    {
        StreamSocket socket = socketInformation.StreamSocket;

        using (var writer = new DataWriter(socket.OutputStream))
        {
            writer.WriteBytes(Encoding.UTF8.GetBytes("Keep alive"));
            await writer.StoreAsync();
            writer.DetachStream();
        }

        socket.TransferOwnership(socketInformation.Id);
    }

    private static async Task ReconnectAsync(Guid backgroundTaskId)
    {
        string? hostName = ApplicationData.Current.LocalSettings.Values[HostNameSetting] as string;
        string? port = ApplicationData.Current.LocalSettings.Values[PortSetting] as string;
        if (string.IsNullOrWhiteSpace(hostName) || string.IsNullOrWhiteSpace(port))
        {
            return;
        }

        StreamSocket? socket = new();

        try
        {
            EnableTransferOwnership(socket, backgroundTaskId);
            await socket.ConnectAsync(new HostName(hostName), port);
            socket.TransferOwnership(SocketId);
            socket = null;
        }
        finally
        {
            socket?.Dispose();
        }
    }

    private static void EnableTransferOwnership(StreamSocket socket, Guid backgroundTaskId)
    {
        try
        {
            socket.EnableTransferOwnership(backgroundTaskId, SocketActivityConnectedStandbyAction.Wake);
        }
        catch (Exception exception) when (exception.HResult == ElementNotFoundHResult)
        {
            socket.EnableTransferOwnership(backgroundTaskId, SocketActivityConnectedStandbyAction.DoNotWake);
        }
    }

    private static void ShowToast(string title, string message)
    {
        var toastXml = ToastNotificationManager.GetTemplateContent(ToastTemplateType.ToastText02);
        var textNodes = toastXml.GetElementsByTagName("text");
        textNodes[0].AppendChild(toastXml.CreateTextNode(title));
        textNodes[1].AppendChild(toastXml.CreateTextNode(message));

        ToastNotificationManager.CreateToastNotifier().Show(new ToastNotification(toastXml));
    }
}
