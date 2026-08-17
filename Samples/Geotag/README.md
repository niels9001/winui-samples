# Geotag

Ported to WinUI 3 / Windows App SDK from the UWP
[Geotag](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/Geotag)
sample.

## What it shows

Choose a `.jpg`, `.jpeg`, or `.mp4` file and use
`Windows.Storage.FileProperties.GeotagHelper` to:

- read its geographic location;
- write the current position supplied by `Geolocator`; or
- write a fixed point representing the Seattle Space Needle.

## APIs featured

- `Windows.Storage.FileProperties.GeotagHelper`
- `Windows.Storage.Pickers.FileOpenPicker`
- `Windows.Devices.Geolocation.Geolocator`
- `Windows.Devices.Geolocation.Geopoint`

## Learn docs this serves

- [GeotagHelper class](https://learn.microsoft.com/uwp/api/windows.storage.fileproperties.geotaghelper)
- [Geolocator class](https://learn.microsoft.com/uwp/api/windows.devices.geolocation.geolocator)
- [FileOpenPicker class](https://learn.microsoft.com/uwp/api/windows.storage.pickers.fileopenpicker)

## Requirements

- Windows 10 version 1809 (10.0.17763.0) or later.
- A JPEG or MP4 file whose metadata can be read or updated.
- The manifest declares the `location` device capability and `runFullTrust`.
- Writing the current location requires Windows location services, a supported location
  provider, and user consent. Reading a geotag or writing the fixed Seattle point does not
  request location access.

## Build & run

```powershell
dotnet build -c Debug -p:Platform=x64
dotnet run -c Debug -p:Platform=x64
```

## Migration notes

`GeotagHelper` and `Geolocator` work unchanged in the packaged desktop app. The UWP
`FileOpenPicker` is associated with `App.MainWindow` through `InitializeWithWindow`, and
status messages are shown in the shared WinUI 3 `InfoBar`.

## Known differences / limitations

The selected file must support writable location metadata. Current-location results depend
on user permission and the location providers available to Windows.
