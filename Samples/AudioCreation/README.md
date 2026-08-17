# Building real-time audio graphs and effects

The `AudioCreation` project was ported to WinUI 3 / Windows App SDK from the UWP
[AudioCreation](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/AudioCreation)
sample.

## What it shows

Build and connect `AudioGraph` nodes across five scenarios:

1. Play, trim, loop, and change the speed of an audio file.
2. Capture a selected microphone to an output file.
3. Generate sine-wave samples and submit them through an `AudioFrameInputNode`.
4. Mix two file inputs through an `AudioSubmixNode`.
5. Configure built-in echo, reverb, equalizer, and limiter effects.

## APIs featured

- `Windows.Media.Audio.AudioGraph`
- `AudioFileInputNode`, `AudioDeviceInputNode`, and `AudioDeviceOutputNode`
- `AudioFrameInputNode`, `AudioSubmixNode`, and `AudioFileOutputNode`
- `EchoEffectDefinition`, `ReverbEffectDefinition`, `EqualizerEffectDefinition`, and
  `LimiterEffectDefinition`

## Learn docs this serves

- [Audio graphs](https://learn.microsoft.com/windows/uwp/audio-video-camera/audio-graphs)
- [AudioGraph class](https://learn.microsoft.com/uwp/api/windows.media.audio.audiograph)

## Build & run

```powershell
dotnet build -c Debug -p:Platform=x64
dotnet run -c Debug -p:Platform=x64
```

Playback scenarios need an audio output device. The device-capture scenario also needs
microphone access and a compatible input device.

## Migration notes

The Windows Runtime `Windows.Media.Audio` APIs remain available to packaged WinUI 3 apps. XAML
and shell code moved to `Microsoft.UI.Xaml`, pickers are associated with the desktop window,
and the frame-input scenario retains unsafe `IMemoryBufferByteAccess` code for filling audio
buffers.

The original sixth **Custom Effects** scenario is intentionally omitted. It depends on a
separate UWP Windows Runtime Component that `AudioGraph` activates by class name. Reproducing it
would require re-authoring and registering an activatable C#/WinRT component rather than a
direct project port.

## Known differences / limitations

- Five of the original six scenarios are included; custom effects remain a documented migration
  gap.
- File-based scenarios depend on codecs installed on the system and require the user to complete
  a picker.
- Device capture depends on microphone permission and compatible audio input hardware.
