# XamlFocusVisuals

Ported to WinUI 3 / Windows App SDK from the UWP
[XamlFocusVisuals](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/XamlFocusVisuals)
sample.

## What it shows

This sample demonstrates two focus treatments:

1. A retemplated `CheckBox` disables the system focus visual and uses custom
   `FocusStates` to draw a red focus rectangle.
2. A `SocialMediaCounter` custom control enables system focus visuals and marks an
   image in its template with `Control.IsTemplateFocusTarget`.

Use the Tab key to move keyboard focus through each scenario.

## APIs featured

- `Microsoft.UI.Xaml.Controls.Control.UseSystemFocusVisuals`
- `Microsoft.UI.Xaml.Controls.Control.IsTemplateFocusTarget`
- `Microsoft.UI.Xaml.VisualStateManager`
- `Microsoft.UI.Xaml.Controls.CheckBox`
- `Microsoft.UI.Xaml.Controls.HyperlinkButton`

## Learn docs this serves

- [Keyboard interactions](https://learn.microsoft.com/en-us/windows/apps/design/input/keyboard-interactions)
- [Focus navigation for keyboard, gamepad, remote control, and accessibility tools](https://learn.microsoft.com/en-us/windows/apps/design/input/focus-navigation)
- [Control class](https://learn.microsoft.com/en-us/windows/windows-app-sdk/api/winrt/microsoft.ui.xaml.controls.control?view=windows-app-sdk-2.2)
- [Control.IsTemplateFocusTarget attached property](https://learn.microsoft.com/en-us/windows/windows-app-sdk/api/winrt/microsoft.ui.xaml.controls.control.istemplatefocustarget?view=windows-app-sdk-2.2)

## Build & run

```powershell
dotnet build -c Debug -p:Platform=x64
dotnet run -c Debug -p:Platform=x64
```

## Migration notes

The focus APIs map directly to `Microsoft.UI.Xaml`. The custom control's default
style remains in `Themes/Generic.xaml`, where its image is marked as the focus
target.

The package manifest also declares the restricted `systemAIModels` capability, but
the focus-visual scenarios do not call System AI APIs or require an AI model.

## Known differences / limitations

A keyboard is needed to reproduce the focus states as presented. No functional
focus-API gap is known in the WinUI 3 port.
