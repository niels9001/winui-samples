# Controlling how concurrent audio streams interact

The `AudioCategory` project was ported to WinUI 3 / Windows App SDK from the UWP
[AudioCategory](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/AudioCategory)
sample.

## What it shows

Choose a `MediaPlayerAudioCategory`, select an audio file, and play it through a reusable
`MediaPlayer` control. Launch a second app instance with a different category to observe how
Windows ducks, mutes, or routes concurrent media, communications, alert, speech, and game
streams.

## APIs featured

- `Windows.Media.Playback.MediaPlayer` and `MediaPlayerAudioCategory`
- `Windows.Media.SystemMediaTransportControls`
- `Microsoft.UI.Xaml.Controls.MediaPlayerElement`
- `Windows.Storage.Pickers.FileOpenPicker`

## Learn docs this serves

- [MediaPlayerAudioCategory enumeration](https://learn.microsoft.com/uwp/api/windows.media.playback.mediaplayeraudiocategory)
- [SystemMediaTransportControls class](https://learn.microsoft.com/uwp/api/windows.media.systemmediatransportcontrols)

## Build & run

```powershell
dotnet build -c Debug -p:Platform=x64
dotnet run -c Debug -p:Platform=x64
```

Use speakers or headphones, select an audio file in each instance, and compare categories such
as Media and Communications to hear system mixer behavior.

## Migration notes

The original UWP sample used a companion app to create a competing audio stream. This port
consolidates that behavior into one multi-instance packaged app with a **Launch another
instance** action.

UWP `MediaElement.AudioCategory` behavior is implemented with
`MediaPlayer.AudioCategory` hosted by `MediaPlayerElement`. The file picker is associated with
the desktop HWND, and system media transport controls are obtained through
`SystemMediaTransportControlsInterop.GetForWindow` instead of the CoreWindow-bound
`GetForCurrentView` API.

## Known differences / limitations

- Ducking and muting behavior depends on the selected category, Windows mixer policy, audio
  drivers, and other active streams.
- The sample needs two running instances and audible output to demonstrate category
  interaction; one instance still demonstrates category assignment and playback.
- Desktop apps do not use the UWP suspend and resume lifecycle, so the port does not preserve
  playback state through UWP suspension events.
