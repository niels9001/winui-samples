# XamlStateTriggers

Ported to WinUI 3 / Windows App SDK from the UWP
[XamlStateTriggers](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/XamlStateTriggers)
sample.

## What it shows

This sample uses visual state triggers to adapt an interface in four ways:

1. `AdaptiveTrigger` changes the layout at window-width thresholds.
2. A custom `InputTypeTrigger` responds to mouse, touch, and pen input.
3. A custom `ControlSizeTrigger` responds to an element's dimensions.
4. A `StateTrigger` bound to the view model enables or disables color styling.

## APIs featured

- `Microsoft.UI.Xaml.AdaptiveTrigger`
- `Microsoft.UI.Xaml.StateTrigger`
- `Microsoft.UI.Xaml.StateTriggerBase`
- `Microsoft.UI.Xaml.VisualStateManager`
- `Microsoft.UI.Input.PointerDeviceType`
- `Microsoft.UI.Xaml.Controls.RelativePanel`
- `Microsoft.UI.Xaml.Controls.ItemsWrapGrid`

## Learn docs this serves

- [StateTriggerBase class](https://learn.microsoft.com/windows/windows-app-sdk/api/winrt/microsoft.ui.xaml.statetriggerbase)
- [AdaptiveTrigger class](https://learn.microsoft.com/windows/windows-app-sdk/api/winrt/microsoft.ui.xaml.adaptivetrigger)
- [StateTrigger class](https://learn.microsoft.com/windows/windows-app-sdk/api/winrt/microsoft.ui.xaml.statetrigger)
- [VisualStateManager class](https://learn.microsoft.com/windows/windows-app-sdk/api/winrt/microsoft.ui.xaml.visualstatemanager)
- [PointerDeviceType enumeration](https://learn.microsoft.com/windows/windows-app-sdk/api/winrt/microsoft.ui.input.pointerdevicetype)

## Build & run

```powershell
dotnet build -c Debug -p:Platform=x64
dotnet run -c Debug -p:Platform=x64
```

## Migration notes

The custom triggers derive from WinUI 3's `Microsoft.UI.Xaml.StateTriggerBase`.
`PointerDeviceType` comes from `Microsoft.UI.Input`, and the UWP `WrapGrid` usage
was replaced with `ItemsWrapGrid`.

The original Xbox-only `DeviceFamilyTrigger` scenario is omitted because this
desktop WinUI 3 project does not target Xbox.

## Known differences / limitations

Mouse, touch, and pen states can only be observed when the corresponding input
device is available. The device-family scenario from the UWP sample is not included.
