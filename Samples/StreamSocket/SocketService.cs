using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Windows.Networking;
using Windows.Networking.Connectivity;
using Windows.Networking.Sockets;
using Windows.Storage.Streams;

namespace SDKTemplate;

internal enum ListenerBindMode
{
    AnyAddress,
    SpecificAddress,
    Adapter,
}

internal sealed class LocalHostItem
{
    internal LocalHostItem(HostName hostName)
    {
        HostName = hostName;
        NetworkAdapter adapter = hostName.IPInformation?.NetworkAdapter
            ?? throw new ArgumentException(
                "The host name has no network adapter.",
                nameof(hostName));
        DisplayName =
            $"Address: {hostName.DisplayName}   Adapter: {adapter.NetworkAdapterId}";
    }

    internal HostName HostName { get; }

    public string DisplayName { get; }
}

internal sealed class SocketStatusEventArgs(
    string message,
    NotifyType type) : EventArgs
{
    internal string Message { get; } = message;

    internal NotifyType Type { get; } = type;
}

internal sealed class SocketService : IDisposable
{
    private readonly object _serverSocketsGate = new();
    private readonly List<Windows.Networking.Sockets.StreamSocket> _serverSockets = [];
    private StreamSocketListener? _listener;
    private Windows.Networking.Sockets.StreamSocket? _clientSocket;
    private DataWriter? _clientWriter;

    internal event EventHandler<SocketStatusEventArgs>? StatusChanged;

    internal bool IsListening => _listener is not null;

    internal bool IsConnected => _clientSocket is not null;

    internal string? ListenerServiceName { get; private set; }

    internal string? ServerAddress { get; private set; }

    internal NetworkAdapter? SelectedAdapter { get; private set; }

    internal IReadOnlyList<LocalHostItem> GetLocalHosts()
    {
        return NetworkInformation.GetHostNames()
            .Where(hostName => hostName.IPInformation?.NetworkAdapter is not null)
            .Select(hostName => new LocalHostItem(hostName))
            .OrderBy(item => item.DisplayName)
            .ToList();
    }

    internal async Task StartListenerAsync(
        string serviceName,
        ListenerBindMode bindMode,
        LocalHostItem? selectedHost)
    {
        if (_listener is not null)
        {
            throw new InvalidOperationException(
                "A listener is already running. Close the sockets before starting another listener.");
        }

        if (string.IsNullOrWhiteSpace(serviceName))
        {
            throw new ArgumentException(
                "Provide a service name or TCP port.",
                nameof(serviceName));
        }

        if (bindMode != ListenerBindMode.AnyAddress && selectedHost is null)
        {
            throw new ArgumentException(
                "Select a local address or adapter.",
                nameof(selectedHost));
        }

        var listener = new StreamSocketListener();
        listener.Control.KeepAlive = false;
        listener.ConnectionReceived += Listener_ConnectionReceived;
        _listener = listener;

        try
        {
            ServerAddress = null;
            SelectedAdapter = null;

            switch (bindMode)
            {
                case ListenerBindMode.AnyAddress:
                    await listener.BindServiceNameAsync(serviceName);
                    break;

                case ListenerBindMode.SpecificAddress:
                    ServerAddress = selectedHost!.HostName.CanonicalName;
                    await listener.BindEndpointAsync(
                        selectedHost.HostName,
                        serviceName);
                    break;

                case ListenerBindMode.Adapter:
                    ServerAddress = selectedHost!.HostName.CanonicalName;
                    SelectedAdapter =
                        selectedHost.HostName.IPInformation!.NetworkAdapter;
                    await listener.BindServiceNameAsync(
                        serviceName,
                        SocketProtectionLevel.PlainSocket,
                        SelectedAdapter);
                    break;

                default:
                    throw new InvalidOperationException(
                        $"Unknown listener bind mode '{bindMode}'.");
            }

            ListenerServiceName = serviceName;
            Report(
                ServerAddress is null
                    ? $"Listening on TCP port {serviceName}."
                    : $"Listening on {ServerAddress}:{serviceName}.",
                NotifyType.StatusMessage);
        }
        catch
        {
            listener.ConnectionReceived -= Listener_ConnectionReceived;
            listener.Dispose();
            _listener = null;
            ListenerServiceName = null;
            ServerAddress = null;
            SelectedAdapter = null;
            throw;
        }
    }

    internal async Task ConnectAsync(string hostName, string serviceName)
    {
        if (_clientSocket is not null)
        {
            throw new InvalidOperationException(
                "A client socket is already connected. Close the sockets before reconnecting.");
        }

        if (string.IsNullOrWhiteSpace(serviceName))
        {
            throw new ArgumentException(
                "Provide a service name or TCP port.",
                nameof(serviceName));
        }

        var remoteHost = new HostName(hostName);
        var socket = new Windows.Networking.Sockets.StreamSocket();
        socket.Control.KeepAlive = false;

        try
        {
            Report($"Connecting to {remoteHost.DisplayName}:{serviceName}...", NotifyType.StatusMessage);

            if (SelectedAdapter is null)
            {
                await socket.ConnectAsync(remoteHost, serviceName);
            }
            else
            {
                await socket.ConnectAsync(
                    remoteHost,
                    serviceName,
                    SocketProtectionLevel.PlainSocket,
                    SelectedAdapter);
            }

            _clientSocket = socket;
            Report("Connected.", NotifyType.StatusMessage);
        }
        catch
        {
            socket.Dispose();
            throw;
        }
    }

    internal async Task SendAsync(string message)
    {
        if (_clientSocket is null)
        {
            throw new InvalidOperationException(
                "Connect the client socket before sending data.");
        }

        if (string.IsNullOrEmpty(message))
        {
            throw new ArgumentException(
                "Enter a message to send.",
                nameof(message));
        }

        _clientWriter ??= new DataWriter(_clientSocket.OutputStream)
        {
            UnicodeEncoding = UnicodeEncoding.Utf8,
            ByteOrder = ByteOrder.LittleEndian,
        };

        _clientWriter.WriteUInt32(_clientWriter.MeasureString(message));
        _clientWriter.WriteString(message);
        await _clientWriter.StoreAsync();
        Report($"\"{message}\" sent successfully.", NotifyType.StatusMessage);
    }

    internal void CloseAll()
    {
        if (_clientWriter is not null)
        {
            _clientWriter.DetachStream();
            _clientWriter.Dispose();
            _clientWriter = null;
        }

        _clientSocket?.Dispose();
        _clientSocket = null;

        if (_listener is not null)
        {
            _listener.ConnectionReceived -= Listener_ConnectionReceived;
            _listener.Dispose();
            _listener = null;
        }

        Windows.Networking.Sockets.StreamSocket[] serverSockets;
        lock (_serverSocketsGate)
        {
            serverSockets = [.. _serverSockets];
            _serverSockets.Clear();
        }

        foreach (Windows.Networking.Sockets.StreamSocket socket in serverSockets)
        {
            socket.Dispose();
        }

        ListenerServiceName = null;
        ServerAddress = null;
        SelectedAdapter = null;
        Report("Client socket, accepted sockets, and listener closed.", NotifyType.StatusMessage);
    }

    public void Dispose()
    {
        CloseAll();
    }

    private void Listener_ConnectionReceived(
        StreamSocketListener sender,
        StreamSocketListenerConnectionReceivedEventArgs args)
    {
        lock (_serverSocketsGate)
        {
            _serverSockets.Add(args.Socket);
        }

        _ = ReceiveMessagesAsync(args.Socket);
    }

    private async Task ReceiveMessagesAsync(
        Windows.Networking.Sockets.StreamSocket socket)
    {
        var reader = new DataReader(socket.InputStream)
        {
            UnicodeEncoding = UnicodeEncoding.Utf8,
            ByteOrder = ByteOrder.LittleEndian,
        };

        try
        {
            while (true)
            {
                uint sizeBytes = await reader.LoadAsync(sizeof(uint));
                if (sizeBytes != sizeof(uint))
                {
                    return;
                }

                uint stringLength = reader.ReadUInt32();
                uint loadedBytes = await reader.LoadAsync(stringLength);
                if (loadedBytes != stringLength)
                {
                    return;
                }

                string message = reader.ReadString(loadedBytes);
                Report($"Server received: \"{message}\"", NotifyType.StatusMessage);
            }
        }
        catch (Exception exception)
        {
            bool isTracked;
            lock (_serverSocketsGate)
            {
                isTracked = _serverSockets.Contains(socket);
            }

            if (isTracked)
            {
                Report(
                    $"Read failed (0x{exception.HResult:X8}): {exception.Message}",
                    NotifyType.ErrorMessage);
            }
        }
        finally
        {
            reader.DetachStream();
            reader.Dispose();

            lock (_serverSocketsGate)
            {
                _serverSockets.Remove(socket);
            }

            socket.Dispose();
        }
    }

    private void Report(string message, NotifyType type)
    {
        StatusChanged?.Invoke(this, new SocketStatusEventArgs(message, type));
    }
}
