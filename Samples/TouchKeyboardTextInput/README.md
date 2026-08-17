# TouchKeyboardTextInput

Ported to WinUI 3 / Windows App SDK from the UWP
[TouchKeyboardTextInput](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/TouchKeyboardTextInput)
sample.

## What it shows

The sample configures text input declaratively in XAML:

1. Compare `TextBox` and `RichEditBox` controls with spelling and text prediction explicitly
   enabled or disabled.
2. Assign `Number`, `Search`, `Url`, `EmailSmtpAddress`, `Default`, `TelephoneNumber`, and
   `Formula` input scopes so the touch keyboard can present an appropriate layout.

This project does not use `InputPane`; touch-keyboard visibility and lifecycle events are
covered by the separate `TouchKeyboard` sample.

## APIs featured

- `Microsoft.UI.Xaml.Controls.TextBox.IsSpellCheckEnabled`
- `Microsoft.UI.Xaml.Controls.TextBox.IsTextPredictionEnabled`
- `Microsoft.UI.Xaml.Controls.RichEditBox.IsSpellCheckEnabled`
- `Microsoft.UI.Xaml.Controls.RichEditBox.IsTextPredictionEnabled`
- `Microsoft.UI.Xaml.Input.InputScope`
- `Microsoft.UI.Xaml.Input.InputScopeName`

## Learn docs this serves

- [Use input scope to change the touch keyboard](https://learn.microsoft.com/windows/apps/design/input/use-input-scope-to-change-the-touch-keyboard)
- [Respond to the presence of the touch keyboard](https://learn.microsoft.com/windows/apps/design/input/respond-to-the-presence-of-the-touch-keyboard)

## Prerequisites and capabilities

- The spelling and prediction settings are visible in the controls without special hardware.
  A touch keyboard is needed to observe the layout selected by each `InputScope`.
- Automatic keyboard display still depends on hardware-keyboard state, device posture, and
  Windows touch-keyboard settings.
- The package declares only the restricted `runFullTrust` capability.

## Build & run

```powershell
dotnet build -c Debug -p:Platform=x64
dotnet run -c Debug -p:Platform=x64
```

## Migration notes

- The scenario behavior remains declarative: the UWP XAML input properties map directly to
  their WinUI 3 control equivalents.
- Legacy sample text styles were replaced with built-in WinUI styles, and the pages use the
  shared NavigationView, InfoBar, title bar, and Mica shell.
- No HWND or `InputPane` interop is needed because the sample configures text processing and
  keyboard layout rather than keyboard visibility.

## Known differences / limitations

- `InputScope` requests a keyboard layout; it does not filter or validate the value entered.
- Prediction and spelling results depend on the installed language resources and Windows
  input settings.
- The requested touch-keyboard layout is not visible when Windows suppresses the software
  keyboard because a hardware keyboard is active or the user's settings disable it.
