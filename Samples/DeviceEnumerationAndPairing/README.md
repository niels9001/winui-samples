# DeviceEnumerationAndPairing

Ported to WinUI 3 / Windows App SDK from the UWP
[DeviceEnumerationAndPairing](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/DeviceEnumerationAndPairing)
sample.

## What it shows

The eight foreground scenarios demonstrate how to:

1. Pick a device with the system `DevicePicker`.
2. enumerate devices incrementally and watch for changes;
3. retrieve a snapshot with `DeviceInformation.FindAllAsync`;
4. recreate one device from its id;
5. apply an AQS filter and request additional properties;
6. request specific `DeviceInformationKind` values;
7. use Windows-managed basic pairing; and
8. participate in custom confirmation, PIN, and credential pairing ceremonies.

## APIs featured

- `Windows.Devices.Enumeration.DevicePicker`
- `Windows.Devices.Enumeration.DeviceWatcher`
- `Windows.Devices.Enumeration.DeviceInformation`
- `Windows.Devices.Enumeration.DeviceInformationKind`
- `Windows.Devices.Enumeration.DeviceInformationPairing`
- `Windows.Devices.Enumeration.DeviceInformationCustomPairing`

## Learn docs this serves

- [Enumerate devices](https://learn.microsoft.com/windows/uwp/devices-sensors/enumerate-devices)
- [DevicePicker class](https://learn.microsoft.com/uwp/api/windows.devices.enumeration.devicepicker)
- [DeviceWatcher class](https://learn.microsoft.com/uwp/api/windows.devices.enumeration.devicewatcher)
- [DeviceInformationPairing class](https://learn.microsoft.com/uwp/api/windows.devices.enumeration.deviceinformationpairing)

## Requirements

- Windows 10 version 1809 (10.0.17763.0) or later.
- Connected or discoverable hardware is required for meaningful enumeration results.
- Pairing requires a pairable `DeviceInformationKind.AssociationEndpoint`; available
  ceremonies depend on the device, transport, and driver.
- The packaged desktop app declares `runFullTrust`. It does not declare a device-specific
  manifest capability because the scenarios use general device enumeration.

## Build & run

```powershell
dotnet build -c Debug -p:Platform=x64
dotnet run -c Debug -p:Platform=x64
```

## Migration notes

The foreground enumeration and pairing APIs remain available to WinUI 3. `DevicePicker`
is associated with `App.MainWindow` through `InitializeWithWindow`, and watcher and pairing
callbacks marshal UI changes through `DispatcherQueue`.

The original UWP scenario 3, **Enumerate and Watch Devices in a Background Task**, is not
included because it requires a separate WinUI 3 desktop background-activation design.

## Known differences / limitations

The sample covers foreground discovery and pairing only. Device names, counts, selectors,
pairing options, and results vary with the machine's installed hardware and drivers.
