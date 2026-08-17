# CustomUsbDeviceAccess

Ported to WinUI 3 / Windows App SDK from the UWP
[CustomUsbDeviceAccess](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/CustomUsbDeviceAccess) sample.

## What it shows

Discovering, connecting to, and communicating with the OSR USB-FX2 Learning Kit board and Microsoft SuperMUTT USB test device across six scenarios:

1. Connecting and disconnecting.
2. Sending USB control transfers.
3. Reading and writing interrupt pipes.
4. Reading and writing bulk pipes.
5. Inspecting USB device and configuration descriptors.
6. Selecting alternate interface settings.

## APIs featured

- `Windows.Devices.Usb.UsbDevice` and `UsbSetupPacket`
- `Windows.Devices.Usb.UsbInterruptInPipe` and `UsbInterruptOutPipe`
- `Windows.Devices.Usb.UsbBulkInPipe` and `UsbBulkOutPipe`
- `Windows.Devices.Usb.UsbInterfaceSetting`
- `Windows.Devices.Enumeration.DeviceWatcher` and `DeviceInformation`

## Learn docs this serves

- [Usb namespace](https://learn.microsoft.com/uwp/api/windows.devices.usb)
- [UsbDevice class](https://learn.microsoft.com/uwp/api/windows.devices.usb.usbdevice)
- [Enumerate devices](https://learn.microsoft.com/windows/uwp/devices-sensors/enumerate-devices)
- [App capability declarations](https://learn.microsoft.com/windows/uwp/packaging/app-capability-declarations)

## Hardware and initial state

The active code watches for the OSR USB-FX2 board with VID `0547` and PID `1002`, and SuperMUTT with VID `045E`, PID `0611`, and interface class `875d47fc-d331-4663-b339-624001a2dc5e`.

The manifest also contains an inherited `045E`/`078E` filter, but that PID appears only in a commented-out constant and is not used by an active scenario.

The initial **Connect/Disconnect** state enables **Connect to device**, disables **Disconnect from device**, and shows an empty list until a supported device is enumerated. No device is needed to build, launch, or view this state.

## Build & run

```powershell
dotnet build -c Debug -p:Platform=x64
dotnet run -c Debug -p:Platform=x64
```

## Migration notes

Six scenarios were ported. The original `Scenario7_SyncDevice` background-task synchronization scenario was dropped because this WinUI 3 desktop shell does not provide the original background activation model. Shared device types were consolidated into `UsbSampleTypes.cs`.

## Known differences / limitations

- Only OSR USB-FX2 and SuperMUTT are actively discoverable; the inherited `045E`/`078E` manifest filter is unused.
- The original background-task device-sync scenario is not included.
- Real control, interrupt, bulk, descriptor, and interface behavior remains unverified without the required hardware.
