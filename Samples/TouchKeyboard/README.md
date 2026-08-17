# TouchKeyboard

Ported to WinUI 3 / Windows App SDK from the UWP
[TouchKeyboard](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/TouchKeyboard)
sample.

## What it shows

The sample separates touch-keyboard visibility from text-input configuration:

1. Focus standard and derived text controls to observe automatic touch-keyboard display.
2. Obtain the window's `InputPane` and listen for `Showing` and `Hiding` events.
3. Request `TryHide` before presenting a result, then request `TryShow` when the result
   animation completes.

## APIs featured

- `Windows.UI.ViewManagement.InputPane`
- `Windows.UI.ViewManagement.InputPaneInterop.GetForWindow`
- `InputPane.Showing` and `InputPane.Hiding`
- `InputPane.TryShow` and `InputPane.TryHide`
- `WinRT.Interop.WindowNative.GetWindowHandle`

## Learn docs this serves

- [InputPane class](https://learn.microsoft.com/uwp/api/windows.ui.viewmanagement.inputpane)
- [IInputPaneInterop interface](https://learn.microsoft.com/windows/win32/api/inputpaneinterop/nn-inputpaneinterop-iinputpaneinterop)
- [Respond to the presence of the touch keyboard](https://learn.microsoft.com/windows/apps/design/input/respond-to-the-presence-of-the-touch-keyboard)

## Prerequisites and capabilities

- A touch or pen input path and the Windows touch keyboard are needed to observe automatic
  display. A hardware keyboard, device posture, and the user's touch-keyboard settings can
  suppress it.
- The package declares only the restricted `runFullTrust` capability; `InputPane` does not
  require a device capability.

## Build & run

```powershell
dotnet build -c Debug -p:Platform=x64
dotnet run -c Debug -p:Platform=x64
```

## Migration notes

- UWP's view-scoped `InputPane.GetForCurrentView` pattern is replaced by
  `InputPaneInterop.GetForWindow`, using the HWND from `App.MainWindow`.
- The desktop interop approach follows Microsoft's proposed WinUI 3 migration in the open
  [Windows App SDK samples PR #649](https://github.com/microsoft/WindowsAppSDK-Samples/pull/649),
  while this project uses the repository's standard NavigationView, InfoBar, title bar, and
  Mica shell.
- Scenario pages unsubscribe from visibility events or clear their window-scoped `InputPane`
  reference when navigation ends.

## Known differences / limitations

- `TryShow` and `TryHide` are requests. Windows can return `false` or keep the keyboard hidden
  because of hardware, posture, focus, or user settings; the sample does not treat that as an
  application error.
- Windows 11 no longer exposes the Windows 10 Tablet mode switch described by the upstream
  sample. Touch-keyboard behavior is controlled by current system settings and device state.
- This sample demonstrates keyboard visibility only. Text prediction, spelling, and keyboard
  layouts are covered by `TouchKeyboardTextInput`.
