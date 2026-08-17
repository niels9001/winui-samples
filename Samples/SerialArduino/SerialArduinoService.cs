using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Globalization;
using System.Linq;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.UI.Dispatching;
using Windows.Devices.Enumeration;
using Windows.Devices.SerialCommunication;
using Windows.Storage.Streams;

namespace SDKTemplate;

internal sealed class SerialArduinoService : IDisposable
{
    private static readonly TimeSpan ConnectionTimeout = TimeSpan.FromSeconds(10);
    private static readonly TimeSpan IoTimeout = TimeSpan.FromSeconds(5);
    private static readonly TimeSpan IoCancellationGracePeriod = TimeSpan.FromSeconds(2);

    private readonly DispatcherQueue _dispatcherQueue;
    private readonly ObservableCollection<DeviceListEntry> _devices = [];
    private readonly ReadOnlyObservableCollection<DeviceListEntry> _readOnlyDevices;
    private readonly HashSet<string> _knownDeviceIds =
        new(StringComparer.OrdinalIgnoreCase);
    private readonly SemaphoreSlim _connectionGate = new(1, 1);
    private readonly SemaphoreSlim _ioGate = new(1, 1);
    private readonly CancellationTokenSource _shutdownCancellation = new();

    private DeviceWatcher? _deviceWatcher;
    private SerialDevice? _serialDevice;
    private CancellationTokenSource? _connectionCancellation;
    private DeviceListEntry? _connectedDevice;
    private bool _isDisposed;

    internal SerialArduinoService(DispatcherQueue dispatcherQueue)
    {
        _dispatcherQueue = dispatcherQueue;
        _readOnlyDevices = new ReadOnlyObservableCollection<DeviceListEntry>(_devices);
    }

    internal event EventHandler<SerialConnectionChangedEventArgs>? ConnectionChanged;

    internal event EventHandler<SerialDiscoveryCompletedEventArgs>? DiscoveryCompleted;

    internal event EventHandler<SerialOperationFailedEventArgs>? OperationFailed;

    internal ReadOnlyObservableCollection<DeviceListEntry> Devices => _readOnlyDevices;

    internal bool IsConnected => _serialDevice is not null;

    internal bool IsDiscoveryComplete { get; private set; }

    internal DeviceListEntry? ConnectedDevice => _connectedDevice;

    internal void StartDiscovery()
    {
        ObjectDisposedException.ThrowIf(_isDisposed, this);

        if (_deviceWatcher is not null)
        {
            return;
        }

        if (!_dispatcherQueue.HasThreadAccess)
        {
            _dispatcherQueue.TryEnqueue(StartDiscovery);
            return;
        }

        DeviceWatcher? watcher = null;

        try
        {
            IsDiscoveryComplete = false;
            _devices.Clear();
            lock (_knownDeviceIds)
            {
                _knownDeviceIds.Clear();
            }

            string selector = SerialDevice.GetDeviceSelectorFromUsbVidPid(
                ArduinoDevice.VendorId,
                ArduinoDevice.ProductId);
            watcher = DeviceInformation.CreateWatcher(
                selector,
                [ArduinoDevice.DeviceInstanceIdProperty]);
            watcher.Added += DeviceWatcher_Added;
            watcher.Removed += DeviceWatcher_Removed;
            watcher.EnumerationCompleted += DeviceWatcher_EnumerationCompleted;
            watcher.Stopped += DeviceWatcher_Stopped;
            _deviceWatcher = watcher;
            watcher.Start();
        }
        catch (Exception exception)
        {
            if (watcher is not null)
            {
                DetachWatcher(watcher);
            }

            _deviceWatcher = null;
            RaiseOperationFailed(SerialOperation.DiscoverDevices, exception);
        }
    }

    internal async Task<SerialConnectResult> ConnectAsync(DeviceListEntry device)
    {
        ArgumentNullException.ThrowIfNull(device);

        try
        {
            await _connectionGate.WaitAsync(_shutdownCancellation.Token);
        }
        catch (OperationCanceledException)
        {
            return SerialConnectResult.Canceled;
        }

        try
        {
            if (_serialDevice is not null)
            {
                return string.Equals(
                    _connectedDevice?.Id,
                    device.Id,
                    StringComparison.OrdinalIgnoreCase)
                    ? SerialConnectResult.AlreadyConnected
                    : SerialConnectResult.AnotherDeviceConnected;
            }

            if (!IsKnownDevice(device.Id))
            {
                return SerialConnectResult.Unavailable;
            }

            using var timeoutCancellation = new CancellationTokenSource(ConnectionTimeout);
            using var linkedCancellation = CancellationTokenSource.CreateLinkedTokenSource(
                _shutdownCancellation.Token,
                timeoutCancellation.Token);

            SerialDevice? candidate;
            try
            {
                candidate = await SerialDevice
                    .FromIdAsync(device.Id)
                    .AsTask(linkedCancellation.Token);
            }
            catch (OperationCanceledException) when (
                timeoutCancellation.IsCancellationRequested &&
                !_shutdownCancellation.IsCancellationRequested)
            {
                RaiseOperationFailed(
                    SerialOperation.Connect,
                    new SerialOperationTimedOutException());
                return SerialConnectResult.Failed;
            }
            catch (OperationCanceledException)
            {
                return SerialConnectResult.Canceled;
            }
            catch (Exception exception)
            {
                RaiseOperationFailed(SerialOperation.Connect, exception);
                return SerialConnectResult.Failed;
            }

            if (candidate is null)
            {
                return SerialConnectResult.Unavailable;
            }

            if (_isDisposed || !IsKnownDevice(device.Id))
            {
                candidate.Dispose();
                return SerialConnectResult.Unavailable;
            }

            try
            {
                ConfigureDevice(candidate);
            }
            catch (Exception exception)
            {
                candidate.Dispose();
                RaiseOperationFailed(SerialOperation.Connect, exception);
                return SerialConnectResult.Failed;
            }

            _connectionCancellation = CancellationTokenSource.CreateLinkedTokenSource(
                _shutdownCancellation.Token);
            _connectedDevice = device;
            _serialDevice = candidate;
            RaiseConnectionChanged(
                device,
                SerialConnectionChangeReason.Connected);
            return SerialConnectResult.Connected;
        }
        finally
        {
            _connectionGate.Release();
        }
    }

    internal Task<bool> DisconnectAsync()
    {
        return DisconnectAsync(SerialConnectionChangeReason.UserDisconnected);
    }

    internal async Task<SerialWriteResult> SetLedAsync(int pin, bool isOn)
    {
        string command = ArduinoProtocol.CreateLedCommand(pin, isOn);
        IoExecutionResult<uint> execution = await ExecuteIoAsync(
            SerialOperation.SetLed,
            (device, cancellationToken) =>
                WriteCommandAsync(device, command, cancellationToken));

        return new SerialWriteResult(execution.Status, execution.Value);
    }

    internal async Task<TemperatureReadResult> ReadTemperatureAsync()
    {
        IoExecutionResult<TemperaturePayload> execution = await ExecuteIoAsync(
            SerialOperation.ReadTemperature,
            ReadTemperatureCoreAsync);

        TemperaturePayload payload = execution.Value;
        return new TemperatureReadResult(
            execution.Status,
            payload.TemperatureCelsius,
            payload.BytesWritten,
            payload.BytesRead,
            payload.IsSensorError);
    }

    public void Dispose()
    {
        if (_isDisposed)
        {
            return;
        }

        _isDisposed = true;
        _shutdownCancellation.Cancel();
        StopDiscovery();

        CancellationTokenSource? connectionCancellation =
            Interlocked.Exchange(ref _connectionCancellation, null);
        connectionCancellation?.Cancel();

        SerialDevice? device = Interlocked.Exchange(ref _serialDevice, null);
        _connectedDevice = null;
        try
        {
            device?.Dispose();
        }
        catch (Exception exception)
        {
            RaiseOperationFailed(SerialOperation.Disconnect, exception);
        }

        connectionCancellation?.Dispose();
        _shutdownCancellation.Dispose();
    }

    private static void ConfigureDevice(SerialDevice device)
    {
        device.BaudRate = ArduinoProtocol.BaudRate;
        device.Parity = SerialParity.None;
        device.StopBits = SerialStopBitCount.One;
        device.Handshake = SerialHandshake.None;
        device.DataBits = ArduinoProtocol.DataBits;
    }

    private static async Task<uint> WriteCommandAsync(
        SerialDevice device,
        string command,
        CancellationToken cancellationToken)
    {
        using var writer = new DataWriter(device.OutputStream)
        {
            UnicodeEncoding = Windows.Storage.Streams.UnicodeEncoding.Utf8,
        };

        try
        {
            writer.WriteString(command);
            return await writer.StoreAsync().AsTask(cancellationToken);
        }
        finally
        {
            writer.DetachStream();
        }
    }

    private static async Task<TemperaturePayload> ReadTemperatureCoreAsync(
        SerialDevice device,
        CancellationToken cancellationToken)
    {
        uint bytesWritten = await WriteCommandAsync(
            device,
            ArduinoProtocol.TemperatureCommand,
            cancellationToken);

        using var reader = new DataReader(device.InputStream)
        {
            InputStreamOptions = InputStreamOptions.Partial,
            UnicodeEncoding = Windows.Storage.Streams.UnicodeEncoding.Utf8,
        };

        var response = new StringBuilder((int)ArduinoProtocol.TemperatureResponseLength);
        uint bytesRead = 0;

        try
        {
            while (bytesRead < ArduinoProtocol.TemperatureResponseLength)
            {
                uint remaining = ArduinoProtocol.TemperatureResponseLength - bytesRead;
                uint loaded = await reader.LoadAsync(remaining).AsTask(cancellationToken);
                if (loaded == 0)
                {
                    throw new SerialProtocolException(SanitizeResponse(response.ToString()));
                }

                bytesRead += loaded;
                response.Append(reader.ReadString(loaded));

                if (response.ToString().EndsWith('\n'))
                {
                    break;
                }
            }
        }
        finally
        {
            reader.DetachStream();
        }

        string rawResponse = response.ToString();
        if (bytesRead != ArduinoProtocol.TemperatureResponseLength ||
            !rawResponse.EndsWith("\r\n", StringComparison.Ordinal))
        {
            throw new SerialProtocolException(SanitizeResponse(rawResponse));
        }

        string valueText = rawResponse[..^2];
        const NumberStyles ProtocolNumberStyles =
            NumberStyles.AllowLeadingSign | NumberStyles.AllowDecimalPoint;
        if (valueText.Length != 5 ||
            !decimal.TryParse(
                valueText,
                ProtocolNumberStyles,
                CultureInfo.InvariantCulture,
                out decimal temperature) ||
            (temperature != ArduinoProtocol.SensorErrorValue &&
             (temperature < 0 || temperature > 99.99m)))
        {
            throw new SerialProtocolException(SanitizeResponse(rawResponse));
        }

        return new TemperaturePayload(
            temperature,
            bytesWritten,
            bytesRead,
            temperature == ArduinoProtocol.SensorErrorValue);
    }

    private static string SanitizeResponse(string response)
    {
        return string.Concat(response.Select(character =>
            char.IsControl(character) ? '\uFFFD' : character));
    }

    private async Task<IoExecutionResult<T>> ExecuteIoAsync<T>(
        SerialOperation operation,
        Func<SerialDevice, CancellationToken, Task<T>> action)
        where T : struct
    {
        try
        {
            await _ioGate.WaitAsync(_shutdownCancellation.Token);
        }
        catch (OperationCanceledException)
        {
            return new IoExecutionResult<T>(SerialOperationStatus.Canceled, default);
        }

        Exception? failure = null;
        SerialOperationStatus status = SerialOperationStatus.Canceled;
        T value = default;

        try
        {
            SerialDevice? device = _serialDevice;
            CancellationTokenSource? connectionCancellation = _connectionCancellation;
            if (device is null || connectionCancellation is null)
            {
                return new IoExecutionResult<T>(
                    SerialOperationStatus.NotConnected,
                    default);
            }

            using var timeoutCancellation = new CancellationTokenSource(IoTimeout);
            using var linkedCancellation = CancellationTokenSource.CreateLinkedTokenSource(
                _shutdownCancellation.Token,
                connectionCancellation.Token,
                timeoutCancellation.Token);

            try
            {
                value = await action(device, linkedCancellation.Token);
                status = SerialOperationStatus.Succeeded;
            }
            catch (OperationCanceledException) when (
                timeoutCancellation.IsCancellationRequested &&
                !_shutdownCancellation.IsCancellationRequested &&
                !connectionCancellation.IsCancellationRequested)
            {
                failure = new SerialOperationTimedOutException();
                status = SerialOperationStatus.Failed;
            }
            catch (OperationCanceledException) when (
                _shutdownCancellation.IsCancellationRequested ||
                connectionCancellation.IsCancellationRequested)
            {
                status = SerialOperationStatus.Canceled;
            }
            catch (Exception exception)
            {
                failure = exception;
                status = SerialOperationStatus.Failed;
            }
        }
        finally
        {
            _ioGate.Release();
        }

        if (failure is not null)
        {
            RaiseOperationFailed(operation, failure);
            await DisconnectAsync(SerialConnectionChangeReason.IoFailure);
        }

        return new IoExecutionResult<T>(status, value);
    }

    private async Task<bool> DisconnectAsync(SerialConnectionChangeReason reason)
    {
        try
        {
            await _connectionGate.WaitAsync(_shutdownCancellation.Token);
        }
        catch (OperationCanceledException)
        {
            return false;
        }

        try
        {
            SerialDevice? device = _serialDevice;
            DeviceListEntry? connectedDevice = _connectedDevice;
            CancellationTokenSource? connectionCancellation = _connectionCancellation;
            if (device is null || connectedDevice is null)
            {
                return false;
            }

            connectionCancellation?.Cancel();
            bool ioGateAcquired = await _ioGate.WaitAsync(IoCancellationGracePeriod);

            try
            {
                _serialDevice = null;
                _connectedDevice = null;
                _connectionCancellation = null;
                device.Dispose();
            }
            catch (Exception exception)
            {
                RaiseOperationFailed(SerialOperation.Disconnect, exception);
            }
            finally
            {
                connectionCancellation?.Dispose();
                if (ioGateAcquired)
                {
                    _ioGate.Release();
                }
            }

            RaiseConnectionChanged(connectedDevice, reason);
            return true;
        }
        finally
        {
            _connectionGate.Release();
        }
    }

    private bool IsKnownDevice(string id)
    {
        lock (_knownDeviceIds)
        {
            return _knownDeviceIds.Contains(id);
        }
    }

    private void DeviceWatcher_Added(
        DeviceWatcher sender,
        DeviceInformation deviceInformation)
    {
        EnqueueWatcherEvent(sender, () =>
        {
            if (_devices.Any(device => string.Equals(
                device.Id,
                deviceInformation.Id,
                StringComparison.OrdinalIgnoreCase)))
            {
                return;
            }

            string instanceId =
                deviceInformation.Properties.TryGetValue(
                    ArduinoDevice.DeviceInstanceIdProperty,
                    out object? propertyValue) &&
                propertyValue is string value &&
                !string.IsNullOrWhiteSpace(value)
                    ? value
                    : deviceInformation.Id;

            var entry = new DeviceListEntry(
                deviceInformation.Id,
                deviceInformation.Name,
                instanceId);
            lock (_knownDeviceIds)
            {
                _knownDeviceIds.Add(entry.Id);
            }

            _devices.Add(entry);
        });
    }

    private void DeviceWatcher_Removed(
        DeviceWatcher sender,
        DeviceInformationUpdate deviceInformationUpdate)
    {
        EnqueueWatcherEvent(sender, () =>
        {
            lock (_knownDeviceIds)
            {
                _knownDeviceIds.Remove(deviceInformationUpdate.Id);
            }

            DeviceListEntry? entry = _devices.FirstOrDefault(device =>
                string.Equals(
                    device.Id,
                    deviceInformationUpdate.Id,
                    StringComparison.OrdinalIgnoreCase));
            if (entry is not null)
            {
                _devices.Remove(entry);
            }

            if (string.Equals(
                _connectedDevice?.Id,
                deviceInformationUpdate.Id,
                StringComparison.OrdinalIgnoreCase))
            {
                _ = DisconnectAsync(SerialConnectionChangeReason.DeviceRemoved);
            }
        });
    }

    private void DeviceWatcher_EnumerationCompleted(DeviceWatcher sender, object args)
    {
        EnqueueWatcherEvent(sender, () =>
        {
            IsDiscoveryComplete = true;
            DiscoveryCompleted?.Invoke(
                this,
                new SerialDiscoveryCompletedEventArgs(_devices.Count));
        });
    }

    private void DeviceWatcher_Stopped(DeviceWatcher sender, object args)
    {
        EnqueueWatcherEvent(sender, () =>
        {
            IsDiscoveryComplete = true;
            RaiseOperationFailed(
                SerialOperation.DiscoverDevices,
                new SerialWatcherStoppedException());
        });
    }

    private void EnqueueWatcherEvent(DeviceWatcher sender, Action action)
    {
        _dispatcherQueue.TryEnqueue(() =>
        {
            if (_isDisposed || !ReferenceEquals(sender, _deviceWatcher))
            {
                return;
            }

            action();
        });
    }

    private void StopDiscovery()
    {
        DeviceWatcher? watcher = _deviceWatcher;
        _deviceWatcher = null;
        if (watcher is null)
        {
            return;
        }

        DetachWatcher(watcher);

        try
        {
            if (watcher.Status is DeviceWatcherStatus.Started or
                DeviceWatcherStatus.EnumerationCompleted)
            {
                watcher.Stop();
            }
        }
        catch (Exception exception)
        {
            RaiseOperationFailed(SerialOperation.DiscoverDevices, exception);
        }
    }

    private void DetachWatcher(DeviceWatcher watcher)
    {
        watcher.Added -= DeviceWatcher_Added;
        watcher.Removed -= DeviceWatcher_Removed;
        watcher.EnumerationCompleted -= DeviceWatcher_EnumerationCompleted;
        watcher.Stopped -= DeviceWatcher_Stopped;
    }

    private void RaiseConnectionChanged(
        DeviceListEntry device,
        SerialConnectionChangeReason reason)
    {
        RaiseOnDispatcher(() =>
            ConnectionChanged?.Invoke(
                this,
                new SerialConnectionChangedEventArgs(
                    reason == SerialConnectionChangeReason.Connected,
                    reason,
                    device)));
    }

    private void RaiseOperationFailed(SerialOperation operation, Exception exception)
    {
        RaiseOnDispatcher(() =>
            OperationFailed?.Invoke(
                this,
                new SerialOperationFailedEventArgs(operation, exception)));
    }

    private void RaiseOnDispatcher(Action action)
    {
        if (_dispatcherQueue.HasThreadAccess)
        {
            action();
        }
        else
        {
            _dispatcherQueue.TryEnqueue(() => action());
        }
    }

    private readonly record struct IoExecutionResult<T>(
        SerialOperationStatus Status,
        T Value)
        where T : struct;

    private readonly record struct TemperaturePayload(
        decimal TemperatureCelsius,
        uint BytesWritten,
        uint BytesRead,
        bool IsSensorError);
}

internal enum SerialConnectResult
{
    Connected,
    AlreadyConnected,
    AnotherDeviceConnected,
    Unavailable,
    Canceled,
    Failed,
}

internal enum SerialOperationStatus
{
    Succeeded,
    NotConnected,
    Canceled,
    Failed,
}

internal enum SerialOperation
{
    DiscoverDevices,
    Connect,
    Disconnect,
    SetLed,
    ReadTemperature,
}

internal enum SerialConnectionChangeReason
{
    Connected,
    UserDisconnected,
    DeviceRemoved,
    IoFailure,
}

internal readonly record struct SerialWriteResult(
    SerialOperationStatus Status,
    uint BytesWritten);

internal readonly record struct TemperatureReadResult(
    SerialOperationStatus Status,
    decimal TemperatureCelsius,
    uint BytesWritten,
    uint BytesRead,
    bool IsSensorError);

internal sealed class SerialConnectionChangedEventArgs(
    bool isConnected,
    SerialConnectionChangeReason reason,
    DeviceListEntry device) : EventArgs
{
    internal bool IsConnected { get; } = isConnected;

    internal SerialConnectionChangeReason Reason { get; } = reason;

    internal DeviceListEntry Device { get; } = device;
}

internal sealed class SerialDiscoveryCompletedEventArgs(int deviceCount) : EventArgs
{
    internal int DeviceCount { get; } = deviceCount;
}

internal sealed class SerialOperationFailedEventArgs(
    SerialOperation operation,
    Exception exception) : EventArgs
{
    internal SerialOperation Operation { get; } = operation;

    internal Exception Exception { get; } = exception;
}

internal sealed class SerialOperationTimedOutException : Exception;

internal sealed class SerialWatcherStoppedException : Exception;

internal sealed class SerialProtocolException(string response) : Exception
{
    internal string Response { get; } = response;
}
