# Casting local media to nearby devices

The `BasicMediaCasting` project was ported to WinUI 3 / Windows App SDK from the UWP
[BasicMediaCasting](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/BasicMediaCasting)
sample.

## What it shows

Cast a selected video in three ways:

1. Use the casting action built into `MediaPlayerElement` transport controls.
2. Show `CastingDevicePicker` and connect the selected receiver.
3. Discover receivers with `DeviceWatcher` and present a custom picker before connecting.

## APIs featured

- `Windows.Media.Casting.CastingDevicePicker`, `CastingDevice`, and `CastingConnection`
- `Windows.Devices.Enumeration.DeviceWatcher`
- `Windows.Media.Playback.MediaPlayer` and `Windows.Media.Core.MediaSource`
- `Microsoft.UI.Xaml.Controls.MediaPlayerElement`
- `Windows.Storage.Pickers.FileOpenPicker`

## Learn docs this serves

- [CastingDevicePicker class](https://learn.microsoft.com/uwp/api/windows.media.casting.castingdevicepicker)
- [CastingConnection class](https://learn.microsoft.com/uwp/api/windows.media.casting.castingconnection)
- [DeviceWatcher class](https://learn.microsoft.com/uwp/api/windows.devices.enumeration.devicewatcher)

## Build & run

```powershell
dotnet build -c Debug -p:Platform=x64
dotnet run -c Debug -p:Platform=x64
```

Full validation requires a supported video file, an active network adapter, and a compatible
casting receiver that Windows can discover.

## Migration notes

The UWP `MediaElement` was replaced with `MediaPlayerElement`; the sample obtains its casting
source from `video.MediaPlayer.GetAsCastingSource()`. Both the file picker and
`CastingDevicePicker` are associated with the desktop window through HWND interop.
`CoreDispatcher` calls in custom device-watcher callbacks were replaced with
`DispatcherQueue.TryEnqueue`.

## Known differences / limitations

- Receiver discovery, accepted media formats, and connection state depend on the network and the
  target device.
- The sample casts one selected local file rather than a playlist or arbitrary network URL.
- The custom picker demonstrates discovery and connection but does not add retry, timeout, or
  advanced remote playback controls.
