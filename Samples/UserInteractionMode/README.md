# UserInteractionMode

Ported to WinUI 3 / Windows App SDK from the UWP
[UserInteractionMode](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/UserInteractionMode)
sample.

## What it shows

The sample retains the upstream scenario:

- Retrieve the user interaction mode associated with the app window.
- Respond to a reported mode change by switching between compact mouse spacing and larger
  touch targets.

## APIs featured

- `Windows.UI.ViewManagement.UIViewSettings`
- `Windows.UI.ViewManagement.UIViewSettingsInterop.GetForWindow`
- `Windows.UI.ViewManagement.UserInteractionMode`
- `WinRT.Interop.WindowNative.GetWindowHandle`

## Learn docs this serves

- [UIViewSettings.UserInteractionMode property](https://learn.microsoft.com/uwp/api/windows.ui.viewmanagement.uiviewsettings.userinteractionmode)
- [IUIViewSettingsInterop interface](https://learn.microsoft.com/windows/win32/api/uiviewsettingsinterop/nn-uiviewsettingsinterop-iuiviewsettingsinterop)
- [Call interop APIs from a .NET app](https://learn.microsoft.com/windows/apps/desktop/modernize/winrt-com-interop-csharp)

## Build & run

```powershell
dotnet build -c Debug -p:Platform=x64
dotnet run -c Debug -p:Platform=x64
```

## Migration notes

- The sample has one scenario, so it is hosted directly without a `NavigationView`.
- UWP's `UIViewSettings.GetForCurrentView` is not supported in desktop apps. The port uses
  `UIViewSettingsInterop.GetForWindow` with the WinUI window HWND.
- The UWP `Window.Current.SizeChanged` subscription is replaced by the main WinUI window's
  `SizeChanged` event.
- Adaptive spacing uses standard theme resources and target sizes rather than fixed gold and
  cyan foreground colors.

## Known differences / limitations

- `IUIViewSettingsInterop` requires Windows build 20348 or later; this project targets Windows
  11 build 22000 or later.
- Windows 11 removed the manual Tablet mode switch used by the upstream instructions. Most
  desktop PCs therefore report `Mouse`; mode changes require compatible convertible hardware.
