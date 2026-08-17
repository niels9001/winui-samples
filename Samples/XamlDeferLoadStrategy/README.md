# XamlDeferLoadStrategy

Ported to WinUI 3 / Windows App SDK from the UWP
[XamlDeferLoadStrategy](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/XamlDeferLoadStrategy)
sample.

## What it shows

This sample uses `x:DeferLoadStrategy="Lazy"` in three scenarios:

1. A page creates a deferred `Grid` only when `FindName` is called.
2. An adaptive mail layout realizes its account list and reading pane as wider
   visual states make them useful.
3. A custom `TitledImage` control realizes a deferred header presenter only when
   the control has header content.

## APIs featured

- `x:DeferLoadStrategy`
- `Microsoft.UI.Xaml.FrameworkElement.FindName`
- `Microsoft.UI.Xaml.FrameworkElement.SizeChanged`
- `Microsoft.UI.Xaml.VisualStateManager`
- `Microsoft.UI.Xaml.Controls.ControlTemplate`
- `Microsoft.UI.Xaml.Controls.ContentPresenter`

## Learn docs this serves

- [XAML styles](https://learn.microsoft.com/en-us/windows/apps/design/style/xaml-styles)
- [XAML control templates](https://learn.microsoft.com/en-us/windows/apps/design/style/xaml-control-templates)
- [FrameworkElement.FindName method](https://learn.microsoft.com/en-us/windows/windows-app-sdk/api/winrt/microsoft.ui.xaml.frameworkelement.findname?view=windows-app-sdk-2.2)
- [ControlTemplate class](https://learn.microsoft.com/en-us/windows/windows-app-sdk/api/winrt/microsoft.ui.xaml.controls.controltemplate?view=windows-app-sdk-2.2)

## Build & run

```powershell
dotnet build -c Debug -p:Platform=x64
dotnet run -c Debug -p:Platform=x64
```

## Migration notes

The adaptive scenario responds to `FrameworkElement.SizeChanged` instead of UWP's
`ApplicationView.VisibleBoundsChanged`. Demo images were repointed to assets
packaged by the WinUI 3 project. The custom `TitledImage` default style remains in
`Themes/Generic.xaml`.

The manifest retains `internetClient`, although the current scenarios use only
packaged images and do not need a network service.

## Known differences / limitations

The adaptive XAML reveals the account list at 1200 pixels, while the code-behind
collapses that list below 1024 pixels. The account list therefore follows the XAML
state threshold during normal visual-state changes, but those two thresholds are
not identical.
