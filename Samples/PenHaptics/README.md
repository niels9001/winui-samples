# PenHaptics

Ported to WinUI 3 / Windows App SDK from the UWP
[PenHaptics](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/PenHaptics)
sample.

## What it shows

This sample queries pen tactile-feedback support and sends simple haptics during
inking, button, and drag interactions. Every scenario checks the connected pen's
runtime capabilities rather than assuming that a waveform or intensity control is
available.

## Scenarios

1. **Query tactile feedback support** - Resolve a `PenDevice` from pointer input and
   list its haptics features and supported waveforms.
2. **Inking feedback** - Send a selected continuous waveform while the pen is active
   in the canvas.
3. **Interaction feedback** - Send discrete click, error, hover, press, release, or
   success feedback from a button interaction.
4. **Inking and interaction feedback** - Combine continuous drag feedback with click
   feedback as a rectangle approaches and completes a grid snap.

## APIs featured

- `Windows.Devices.Input.PenDevice`
- `Windows.Devices.Haptics.SimpleHapticsController`
- `Windows.Devices.Haptics.SimpleHapticsControllerFeedback`
- `Windows.Devices.Haptics.KnownSimpleHapticsControllerWaveforms`
- WinUI pointer and manipulation events

## Requirements

- A pen and digitizer that expose `SimpleHapticsController` are required to feel or
  send tactile feedback.
- Although the package manifest allows build 17763, the waveform map references
  `GalaxyPenContinuous`, which is available starting with Windows build 22000. The
  code does not guard that property on older releases.
- Supported waveforms and intensity adjustment vary by pen. The sample reports or
  falls back from unavailable features.
- No particular pen model is assumed or claimed as tested.

## Learn docs this serves

- [PenDevice API reference](https://learn.microsoft.com/uwp/api/windows.devices.input.pendevice)
- [SimpleHapticsController API reference](https://learn.microsoft.com/uwp/api/windows.devices.haptics.simplehapticscontroller)
- [KnownSimpleHapticsControllerWaveforms API reference](https://learn.microsoft.com/uwp/api/windows.devices.haptics.knownsimplehapticscontrollerwaveforms)

## Build & run

```powershell
dotnet build -c Debug -p:Platform=x64
dotnet run -c Debug -p:Platform=x64
```

## Migration notes

The original UWP scenario 1 used `InkCanvas` and `InkToolbar` to add tactile
feedback to an inking control. Those controls do not have a WinUI 3 equivalent, so
that scenario was dropped; the retained scenarios are numbered 2 through 5. See
[microsoft-ui-xaml issue 6742](https://github.com/microsoft/microsoft-ui-xaml/issues/6742).

The retained scenarios use WinUI pointer and manipulation events while continuing to
use the Windows `PenDevice` and simple-haptics APIs.

## Known differences / limitations

- The UWP `InkCanvasTactileFeedback` scenario is not included.
- The effective OS requirement is newer than the manifest minimum because of the
  unguarded Windows 11 waveform property.
- The UI can report sent feedback, but a screenshot cannot prove that physical
  feedback was produced.
- Full interaction testing requires compatible pen hardware and has not been claimed
  on hardware that is not present.
