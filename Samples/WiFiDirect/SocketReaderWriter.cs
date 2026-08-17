using System;
using System.ComponentModel;
using System.Threading;
using System.Threading.Tasks;
using Windows.Devices.Enumeration;
using Windows.Devices.WiFiDirect;
using Windows.Networking.Sockets;
using Windows.Storage.Streams;

namespace SDKTemplate;

public sealed class SocketReaderWriter : IDisposable
{
    private const uint MaxMessageSize = 64 * 1024;

    private readonly DataReader _dataReader;
    private readonly DataWriter _dataWriter;
    private readonly MainPage _rootPage;
    private readonly StreamSocket _streamSocket;
    private readonly SemaphoreSlim _writeLock = new(1, 1);
    private bool _isDisposed;

    public SocketReaderWriter(StreamSocket socket, MainPage mainPage)
    {
        _streamSocket = socket;
        _rootPage = mainPage;

        _dataReader = new DataReader(socket.InputStream)
        {
            ByteOrder = ByteOrder.LittleEndian,
            UnicodeEncoding = UnicodeEncoding.Utf8,
        };

        _dataWriter = new DataWriter(socket.OutputStream)
        {
            ByteOrder = ByteOrder.LittleEndian,
            UnicodeEncoding = UnicodeEncoding.Utf8,
        };
    }

    public void Dispose()
    {
        if (_isDisposed)
        {
            return;
        }

        _isDisposed = true;
        _dataReader.Dispose();
        _dataWriter.Dispose();
        _streamSocket.Dispose();
    }

    public async Task<string?> ReadMessageAsync()
    {
        try
        {
            uint bytesRead = await _dataReader.LoadAsync(sizeof(uint));
            if (bytesRead < sizeof(uint))
            {
                return null;
            }

            uint messageLength = _dataReader.ReadUInt32();
            if (messageLength > MaxMessageSize)
            {
                _rootPage.NotifyUser(
                    $"The remote message exceeded the {MaxMessageSize / 1024} KB sample limit.",
                    NotifyType.ErrorMessage);
                return null;
            }

            bytesRead = await _dataReader.LoadAsync(messageLength);
            if (bytesRead < messageLength)
            {
                return null;
            }

            string message = _dataReader.ReadString(messageLength);
            _rootPage.NotifyUser($"Received message: {message}", NotifyType.StatusMessage);
            return message;
        }
        catch (Exception exception) when (Utils.IsExpectedSocketException(exception))
        {
            _rootPage.NotifyUser("The socket was closed.", NotifyType.StatusMessage);
            return null;
        }
        catch (Exception exception) when (Utils.IsTextDecodingException(exception))
        {
            _rootPage.NotifyUser(
                "The peer sent a malformed UTF-8 message. The connection was closed.",
                NotifyType.ErrorMessage);
            return null;
        }
    }

    public async Task WriteMessageAsync(string message)
    {
        await _writeLock.WaitAsync();
        try
        {
            uint messageLength = _dataWriter.MeasureString(message);
            if (messageLength > MaxMessageSize)
            {
                _rootPage.NotifyUser(
                    $"Messages are limited to {MaxMessageSize / 1024} KB.",
                    NotifyType.ErrorMessage);
                return;
            }

            _dataWriter.WriteUInt32(messageLength);
            _dataWriter.WriteString(message);
            await _dataWriter.StoreAsync();
            _rootPage.NotifyUser($"Sent message: {message}", NotifyType.StatusMessage);
        }
        catch (Exception exception) when (Utils.IsExpectedSocketException(exception))
        {
            _rootPage.NotifyUser(
                $"The message could not be sent because the socket closed: {exception.Message}",
                NotifyType.ErrorMessage);
        }
        finally
        {
            _writeLock.Release();
        }
    }
}

public sealed class DiscoveredDevice : INotifyPropertyChanged
{
    public DiscoveredDevice(DeviceInformation deviceInformation)
    {
        DeviceInformation = deviceInformation;
    }

    public event PropertyChangedEventHandler? PropertyChanged;

    public DeviceInformation DeviceInformation { get; }

    public string DisplayName =>
        $"{DeviceInformation.Name} - " +
        (DeviceInformation.Pairing.IsPaired ? "Paired" : "Unpaired");

    public void Update(DeviceInformationUpdate update)
    {
        DeviceInformation.Update(update);
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(nameof(DisplayName)));
    }
}

public sealed class ConnectedDevice : IDisposable
{
    private bool _isDisposed;

    public ConnectedDevice(
        string displayName,
        WiFiDirectDevice wiFiDirectDevice,
        SocketReaderWriter socketReaderWriter)
    {
        DisplayName = displayName;
        WiFiDirectDevice = wiFiDirectDevice;
        SocketReaderWriter = socketReaderWriter;
    }

    public string DisplayName { get; private set; }

    internal bool IsDisposed => _isDisposed;

    public SocketReaderWriter SocketReaderWriter { get; }

    public WiFiDirectDevice WiFiDirectDevice { get; }

    internal void Rename(string displayName)
    {
        DisplayName = displayName;
    }

    public void Dispose()
    {
        if (_isDisposed)
        {
            return;
        }

        _isDisposed = true;
        SocketReaderWriter.Dispose();
        WiFiDirectDevice.Dispose();
    }
}
