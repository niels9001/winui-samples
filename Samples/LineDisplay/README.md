# LineDisplay

Ported to WinUI 3 / Windows App SDK from the UWP
[LineDisplay](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/LineDisplay)
sample.

## What it shows

This sample provides seven scenarios that discover and claim a point-of-service line
display, then demonstrate text, windows, device attributes, custom glyphs, cursor
configuration, and marquee scrolling.

## APIs featured

- `Windows.Devices.PointOfService.LineDisplay`
- `Windows.Devices.PointOfService.ClaimedLineDisplay`
- `Windows.Devices.PointOfService.LineDisplayWindow`
- `Windows.Devices.Enumeration.DeviceWatcher`

## Learn docs this serves

- [ClaimedLineDisplay class](https://learn.microsoft.com/uwp/api/windows.devices.pointofservice.claimedlinedisplay)
- [LineDisplay class](https://learn.microsoft.com/uwp/api/windows.devices.pointofservice.linedisplay)
- [Windows.Devices.PointOfService namespace](https://learn.microsoft.com/uwp/api/windows.devices.pointofservice)

## Build & run

```powershell
dotnet build -c Debug -p:Platform=x64
dotnet run -c Debug -p:Platform=x64
```

## Migration notes

The seven upstream scenarios are retained. UWP `CoreDispatcher` event marshalling was
replaced with `DispatcherQueue`, the sample uses the standard WinUI title bar and
NavigationView shell, and watcher/device lifetimes are cleaned up when navigating.

The package retains the `pointOfService` device capability. A compatible line display is
required to exercise operations beyond hardware discovery; without one, the selection page
reports that no devices were found. This documentation update does not claim validation on
line-display hardware.
