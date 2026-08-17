# MediaTranscoding

Ported to WinUI 3 / Windows App SDK from the UWP
[MediaTranscoding](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/MediaTranscoding)
sample.

## What it shows

This sample converts MP4 or WMV video in three scenarios: built-in encoding presets, custom
audio and video settings, and a selected trim range. Each workflow demonstrates progress
reporting, cancellation, and source and output previews.

## APIs featured

- `Windows.Media.Transcoding.MediaTranscoder`
- `Windows.Media.Transcoding.PrepareTranscodeResult`
- `Windows.Media.MediaProperties.MediaEncodingProfile`
- `Windows.Media.Playback.MediaPlayer`
- `Microsoft.UI.Xaml.Controls.MediaPlayerElement`
- `Windows.Storage.Pickers.FileOpenPicker`
- `Windows.Storage.Pickers.FileSavePicker`

## Learn docs this serves

- [Transcode media files](https://learn.microsoft.com/windows/apps/develop/media-authoring-processing/transcode-media-files)

## Build & run

```powershell
dotnet build -c Debug -p:Platform=x64
dotnet run -c Debug -p:Platform=x64
```

## Migration notes

- File pickers are associated with the WinUI window through `InitializeWithWindow`.
- `MediaPlayerElement` and `MediaPlayer` replace the UWP `MediaElement` previews.
- The three scenarios share one page so picker, playback, cancellation, progress, and cleanup
  behavior stays consistent.
- The port interprets `TrimStopTime` according to its API contract: it passes the duration
  between the selected mark-out point and the end of the source, rather than passing the
  mark-out position directly.
- No media-library capability is required because the user grants access through the file
  pickers.

Codec availability depends on the Windows installation. Full scenario validation requires a
local MP4 or WMV source file and a writable output location.
