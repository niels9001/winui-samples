# RadioManager

Ported to WinUI 3 / Windows App SDK from the UWP
[RadioManager](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/RadioManager)
sample.

## What it shows

This sample requests access to system radios, enumerates the radios exposed by the
current device, and binds each supported state to a `ToggleSwitch`. It also tracks
hardware state changes while the page is open.

## Scenario

**Toggle Radios** - Call `Radio.RequestAccessAsync`, enumerate radios with
`GetRadiosAsync`, update state with `SetStateAsync`, and marshal `StateChanged`
notifications back to the WinUI thread.

## APIs featured

- `Windows.Devices.Radios.Radio`
- `Windows.Devices.Radios.RadioAccessStatus`
- `Windows.Devices.Radios.RadioKind`
- `Windows.Devices.Radios.RadioState`
- `Microsoft.UI.Dispatching.DispatcherQueue`

## Requirements

- The package declares the `radios` device capability.
- At least one Windows radio is needed to display a device. The list and supported
  state changes depend on current hardware and the access status returned by Windows.

## Learn docs this serves

- [Radio API reference](https://learn.microsoft.com/uwp/api/windows.devices.radios.radio)
- [RadioAccessStatus API reference](https://learn.microsoft.com/uwp/api/windows.devices.radios.radioaccessstatus)
- [DispatcherQueue API reference](https://learn.microsoft.com/windows/windows-app-sdk/api/winrt/microsoft.ui.dispatching.dispatcherqueue)

## Build & run

```powershell
dotnet build -c Debug -p:Platform=x64
dotnet run -c Debug -p:Platform=x64
```

## Migration notes

The Windows radio APIs are unchanged. `CoreDispatcher` was replaced with
`DispatcherQueue` so `StateChanged` events can update WinUI-bound properties on the
UI thread.

## Known differences / limitations

- `RadioKind.MobileBroadband` entries are enumerated but their switches are disabled.
  The package does not declare the restricted `cellularDeviceControl` capability.
- Access can be denied by Windows, and an empty list is valid on hardware without
  exposed radios.
- No successful radio state change is claimed without compatible hardware and an
  allowed access status.
