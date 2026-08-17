# CustomHidDeviceAccess

Ported to WinUI 3 / Windows App SDK from the UWP
[CustomHidDeviceAccess](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/CustomHidDeviceAccess) sample.

## What it shows

Discovering, connecting to, and communicating with a vendor-defined HID device across four scenarios:

1. Connecting to the device.
2. Getting and setting feature reports.
3. Handling input report events.
4. Reading and writing input and output reports.

## APIs featured

- `Windows.Devices.HumanInterfaceDevice.HidDevice`
- `Windows.Devices.HumanInterfaceDevice.HidInputReportReceivedEventArgs`
- `Windows.Devices.HumanInterfaceDevice.HidFeatureReport` and `HidOutputReport`
- `Windows.Devices.Enumeration.DeviceWatcher` and `DeviceInformation`

## Learn docs this serves

- [HumanInterfaceDevice namespace](https://learn.microsoft.com/uwp/api/windows.devices.humaninterfacedevice)
- [HidDevice class](https://learn.microsoft.com/uwp/api/windows.devices.humaninterfacedevice.hiddevice)
- [Enumerate devices](https://learn.microsoft.com/windows/uwp/devices-sensors/enumerate-devices)
- [DeviceCapability manifest element](https://learn.microsoft.com/uwp/schemas/appxpackage/uapmanifestschema/element-devicecapability)

## Hardware and initial state

The package and `HidSampleTypes.cs` target the Microsoft SuperMUTT HID test device with VID `045E`, PID `0610`, usage page `FFAA`, and usage `0001`. SuperMUTT is Microsoft test hardware rather than a typical retail device.

The initial **Connecting To Device** state enables **Connect to device**, disables **Disconnect from device**, and shows an empty list until a matching device is enumerated. No device is needed to build, launch, or view this state.

## Build & run

```powershell
dotnet build -c Debug -p:Platform=x64
dotnet run -c Debug -p:Platform=x64
```

## Migration notes

The four device scenarios were ported. UWP suspend and resume lifecycle handling was removed, and shared device and report types were restored in `HidSampleTypes.cs`.

## Known differences / limitations

- Only the specified SuperMUTT device is discoverable; there is no generic HID fallback.
- Real feature, input, and output report behavior remains unverified without that hardware.
- The original UWP suspend and resume behavior is not included.
