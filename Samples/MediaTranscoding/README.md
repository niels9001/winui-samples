# MediaTranscoding

Ported to WinUI 3 / Windows App SDK from the UWP
[MediaTranscoding](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/MediaTranscoding)
sample.

## What it shows

The sample converts MP4 or WMV video using preset encoding profiles, custom audio and video
settings, or a selected trim range. It also demonstrates progress reporting, cancellation,
and previewing the source and output.

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
