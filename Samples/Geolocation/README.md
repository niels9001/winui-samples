# Geolocation

Ported to WinUI 3 / Windows App SDK from the UWP
[Geolocation](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/Geolocation)
sample.

## What it shows

The five foreground scenarios demonstrate how to:

1. track position and provider status changes;
2. retrieve one cancellable position with a requested accuracy;
3. create, list, remove, and monitor foreground geofences;
4. retrieve the most recent significant visit; and
5. monitor significant visits while the app is running.

## APIs featured

- `Windows.Devices.Geolocation.Geolocator`
- `Windows.Devices.Geolocation.Geoposition`
- `Windows.Devices.Geolocation.Geofencing.Geofence`
- `Windows.Devices.Geolocation.Geofencing.GeofenceMonitor`
- `Windows.Devices.Geolocation.Geovisit`
- `Windows.Devices.Geolocation.GeovisitMonitor`

## Learn docs this serves

- [Get current location](https://learn.microsoft.com/windows/uwp/maps-and-location/get-location)
- [Windows.Devices.Geolocation namespace](https://learn.microsoft.com/uwp/api/windows.devices.geolocation)
- [Windows.Devices.Geolocation.Geofencing namespace](https://learn.microsoft.com/uwp/api/windows.devices.geolocation.geofencing)

## Requirements

- Windows 10 version 1809 (10.0.17763.0) or later.
- The manifest declares the `location` device capability and `runFullTrust`.
- Windows location services must be enabled, and the user must grant location access from
  the foreground UI.
- A Windows-supported location provider such as GPS, Wi-Fi positioning, or cellular
  positioning is required. Accuracy and event timing depend on the provider and environment.

## Build & run

```powershell
dotnet build -c Debug -p:Platform=x64
dotnet run -c Debug -p:Platform=x64
```

## Migration notes

The location, geofence, and visit APIs remain available to packaged WinUI 3 desktop apps.
The port requests access from the UI thread and uses `DispatcherQueue` for foreground event
updates.

The original UWP background scenarios 3, 5, and 8 are intentionally omitted pending a
desktop background-activation design. Their foreground counterparts remain available.

## Known differences / limitations

Background position, geofence, and visit monitoring are not included. Foreground results
are environment-dependent and may be delayed or unavailable when Windows cannot obtain a
location.
