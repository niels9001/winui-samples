# CustomSerialDeviceAccess

Ported to WinUI 3 / Windows App SDK from the UWP
[CustomSerialDeviceAccess](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/CustomSerialDeviceAccess) sample.

## What it shows

Discovering, connecting to, configuring, and exchanging data with serial port devices across four scenarios:

1. Connecting and disconnecting.
2. Configuring baud rate, parity, stop bits, data bits, handshake, break, DTR, and RTS.
3. Reading and writing data with configurable timeouts.
4. Handling pin-changed and error-received events.

## APIs featured

- `Windows.Devices.SerialCommunication.SerialDevice`
- `Windows.Storage.Streams.DataReader` and `DataWriter`
- `Windows.Devices.Enumeration.DeviceWatcher` and `DeviceInformation`

## Learn docs this serves

- [SerialCommunication namespace](https://learn.microsoft.com/uwp/api/windows.devices.serialcommunication)
- [SerialDevice class](https://learn.microsoft.com/uwp/api/windows.devices.serialcommunication.serialdevice)
- [Enumerate devices](https://learn.microsoft.com/windows/uwp/devices-sensors/enumerate-devices)
- [App capability declarations](https://learn.microsoft.com/windows/uwp/packaging/app-capability-declarations)

## Hardware and initial state

The package allows any device exposing the `serialPort` function, and the code uses the unfiltered `SerialDevice.GetDeviceSelector()`. A USB-to-serial adapter, Arduino, or virtual COM port can therefore supply the required device.

The initial **Connect/Disconnect** state enables **Connect to device**, disables **Disconnect from device**, and shows an empty list until Windows enumerates a serial port. No device is needed to build, launch, or view this state.

## Build & run

```powershell
dotnet build -c Debug -p:Platform=x64
dotnet run -c Debug -p:Platform=x64
```

## Migration notes

The four scenarios were ported. UWP suspend and resume lifecycle handling was removed, and a brace imbalance introduced while stripping that code was repaired.

## Known differences / limitations

- The original UWP suspend and resume behavior is not included.
- Real configuration, I/O, and event behavior remains unverified without a serial device.
