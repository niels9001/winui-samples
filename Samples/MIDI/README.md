# MIDI

Ported to WinUI 3 / Windows App SDK from the UWP
[MIDI](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/MIDI)
sample.

## What it shows

This sample provides three scenarios for enumerating MIDI input and output ports, receiving
and decoding incoming MIDI messages, and constructing and sending channel, system-common,
and system-real-time messages.

## APIs featured

- `Windows.Devices.Midi.MidiInPort`
- `Windows.Devices.Midi.MidiOutPort`
- `Windows.Devices.Midi.IMidiMessage`
- `Windows.Devices.Midi.MidiMessageType`
- `Windows.Devices.Enumeration.DeviceWatcher`

## Learn docs this serves

- [MIDI](https://learn.microsoft.com/windows/uwp/audio-video-camera/midi)
- [Windows.Devices.Midi namespace](https://learn.microsoft.com/uwp/api/windows.devices.midi)
- [MidiInPort class](https://learn.microsoft.com/uwp/api/windows.devices.midi.midiinport)
- [MidiOutPort class](https://learn.microsoft.com/uwp/api/windows.devices.midi.midioutport)

## Build & run

```powershell
dotnet build -c Debug -p:Platform=x64
dotnet run -c Debug -p:Platform=x64
```

## Migration notes

All three upstream scenarios are retained. Device-watcher callbacks marshal list updates
through `DispatcherQueue`, and MIDI ports and watchers are released when their scenarios
end. `ScenarioHeaderTextStyle` is defined locally in `App.xaml` because the UWP sample
referenced it from a shared style sheet.

A physical MIDI device or configured virtual MIDI port is required for populated device
lists and live send/receive behavior. This documentation update does not claim validation
against MIDI hardware.
