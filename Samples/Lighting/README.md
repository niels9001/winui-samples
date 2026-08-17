# Lighting

Ported to WinUI 3 / Windows App SDK by consolidating the UWP
[LampArray](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/LampArray)
and [LampDevice](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/LampDevice)
samples.

## What it shows

The Lamp array feature discovers attached `LampArray` devices, applies colors and brightness,
and runs bitmap, blink, custom, and color-ramp effects. The Lamp device feature gets an
individual `Lamp`, adjusts its brightness and color, and responds to availability changes.

## APIs featured

- `Windows.Devices.Lights.LampArray`
- `Windows.Devices.Lights.Lamp`
- `Windows.Devices.Lights.Effects.LampArrayEffectPlaylist`
- `Windows.Devices.Lights.Effects.LampArrayBitmapEffect`
- `Windows.Devices.Lights.Effects.LampArrayCustomEffect`
- `Windows.Devices.Enumeration.DeviceWatcher`

## Learn docs this serves

- [LampArray class](https://learn.microsoft.com/uwp/api/windows.devices.lights.lamparray)
- [Lamp class](https://learn.microsoft.com/uwp/api/windows.devices.lights.lamp)
- [Windows.Devices.Lights.Effects namespace](https://learn.microsoft.com/uwp/api/windows.devices.lights.effects)

## Build & run

```powershell
dotnet build -c Debug -p:Platform=x64
dotnet run -c Debug -p:Platform=x64
```

## Migration notes

This project consolidates both upstream samples under one NavigationView shell.
Device-watcher callbacks marshal UI work through `DispatcherQueue`; watchers and active
effect playlists are stopped when their scenarios end, while the individual-lamp scenarios
dispose their `Lamp` instances. The static LampArray effect image uses the packaged
`Assets/StoreLogo.png` asset.

Meaningful runtime verification requires compatible LampArray and Lamp hardware. Without it,
the scenarios report that no device is available; this documentation update does not claim
hardware validation. The manifest retains the upstream `internetClient` capability even
though the lighting workflows do not otherwise require a network service.
