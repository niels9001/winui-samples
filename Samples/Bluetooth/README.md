# Bluetooth

Ported to WinUI 3 / Windows App SDK from the UWP
[BluetoothLE](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/BluetoothLE) and
[BluetoothRfcommChat](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/BluetoothRfcommChat) samples.

## What it shows

Discovering, pairing, and communicating with nearby Bluetooth devices across two feature groups:

1. **Client: Discover servers** watches for nearby Bluetooth LE GATT servers and pairs the selected device.
2. **Client: Connect to a server** enumerates the selected device's GATT services and characteristics, then reads, writes, and subscribes to characteristic values.
3. **Chat client** discovers a custom RFCOMM chat service and exchanges text over a `StreamSocket`.
4. **Foreground chat server** advertises the same RFCOMM service and accepts an incoming client connection.

Run the BLE discovery scenario first to select and pair a device for the BLE client scenario. The RFCOMM scenarios instead require peer devices running complementary client and server roles.

## APIs featured

- `Windows.Devices.Enumeration.DeviceWatcher` and `DeviceInformation`
- `Windows.Devices.Bluetooth.BluetoothLEDevice`
- `Windows.Devices.Bluetooth.GenericAttributeProfile.GattDeviceService` and `GattCharacteristic`
- `Windows.Devices.Bluetooth.BluetoothDevice`
- `Windows.Devices.Bluetooth.Rfcomm.RfcommDeviceService` and `RfcommServiceProvider`
- `Windows.Networking.Sockets.StreamSocket` and `StreamSocketListener`

## Learn docs this serves

- [Bluetooth Low Energy overview](https://learn.microsoft.com/windows/uwp/devices-sensors/bluetooth-low-energy-overview)
- [GATT client](https://learn.microsoft.com/windows/uwp/devices-sensors/gatt-client)
- [Bluetooth RFCOMM](https://learn.microsoft.com/windows/apps/develop/devices-sensors/send-or-receive-files-with-rfcomm)
- [Enumerate and pair devices](https://learn.microsoft.com/windows/uwp/devices-sensors/enumerate-devices)

## Hardware and initial state

A Bluetooth radio or adapter must be enabled on the host PC. The BLE scenarios need a nearby BLE peripheral, while RFCOMM chat needs a second Bluetooth device running the complementary role.

The BLE discovery page initially has an empty results list and its pairing action disabled. Its list is populated only after enumeration starts. Other device-specific controls remain hidden or unavailable until the corresponding connection workflow supplies a device.

## Build & run

```powershell
dotnet build -c Debug -p:Platform=x64
dotnet run -c Debug -p:Platform=x64
```

## Migration notes

- The `BluetoothLE` discovery and client scenarios were ported. Its foreground GATT server was dropped because its extended-advertising secondary-PHY APIs are absent from the 10.0.26100 SDK. `Constants.cs` and `PresentationFormats.cs` remain because the client still uses their calculator-service identifiers when formatting values.
- The `BluetoothRfcommChat` client and foreground server were ported. Its background-task server was dropped because this WinUI 3 desktop shell does not provide the original background activation model.
- `CoreDispatcher` was replaced with `DispatcherQueue`, `Window.Current` with `App.MainWindow`, and UWP XAML namespaces with WinUI namespaces.
- The separate UWP `BluetoothLEClient` project was not ported because its client role is covered by this project's BLE client scenario.

## Known differences / limitations

- All four scenarios require real Bluetooth hardware; there is no simulator fallback.
- Only the GATT client role is available. The original local GATT server role is not included.
- RFCOMM chat provides only a foreground server, which must remain active to receive connections.
