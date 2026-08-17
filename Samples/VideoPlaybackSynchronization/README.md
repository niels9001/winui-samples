# VideoPlaybackSynchronization

Ported to WinUI 3 / Windows App SDK from the UWP
[VideoPlaybackSynchronization](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/VideoPlaybackSynchronization)
sample.

## What it shows

The sample uses one timeline controller to keep multiple independent video players aligned.
It demonstrates five synchronized camera angles, correcting an authored five-second offset,
and synchronizing two adaptive HLS sources.

## APIs featured

- `Windows.Media.MediaTimelineController`
- `Windows.Media.Playback.MediaPlayer`
- `Windows.Media.Playback.MediaPlayer.TimelineControllerPositionOffset`
- `Windows.Media.Streaming.Adaptive.AdaptiveMediaSource`
- `Windows.Media.Core.MediaSource`
- `Microsoft.UI.Xaml.Controls.MediaPlayerElement`

## Learn docs this serves

- [Play audio and video with MediaPlayer](https://learn.microsoft.com/windows/uwp/audio-video-camera/play-audio-and-video-with-mediaplayer)
- [Adaptive streaming](https://learn.microsoft.com/windows/uwp/audio-video-camera/adaptive-streaming)
- [MediaTimelineController](https://learn.microsoft.com/uwp/api/windows.media.mediatimelinecontroller)

## Build & run

```powershell
dotnet build -c Debug -p:Platform=x64
dotnet run -c Debug -p:Platform=x64
```

## Migration notes

- The original six hosted MP4 files now return HTTP 409 and are no longer publicly
  downloadable. This port packages seven small, synthetic H.264 clips with a shared moving
  crosshair and clock so synchronization remains deterministic and visibly testable.
- The original adaptive-stream endpoint has also retired. The default is a current public
  HTTPS HLS video-on-demand test stream, and both manifest addresses remain editable.
- The adaptive scenario therefore demonstrates synchronized adaptive playback rather than
  depending on a fragile public live-stream endpoint. Compatible HTTPS live HLS manifests can
  still be entered manually.
- `DispatcherQueue` replaces `CoreDispatcher` for media callbacks.
- Each page disables the players' command managers and built-in transport controls, then uses
  one `MediaTimelineController` for play, pause, and bounded seeking.
- Media source wrappers, underlying adaptive sources, and players are explicitly detached and
  disposed when a scenario is reloaded or left.

Only the adaptive HLS scenario requires network access. Packaged scenarios work offline.
