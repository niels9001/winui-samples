# XamlMasterDetail

Ported to WinUI 3 / Windows App SDK from the UWP
[XamlMasterDetail](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/XamlMasterDetail)
sample.

## What it shows

This sample builds a list-and-detail experience that responds to the available page
width. At 720 pixels or wider, the item list and selected details appear side by
side. Below that breakpoint, the page presents either the list or the detail view
and provides an in-page back button for returning to the list.

The scenario also demonstrates item selection, a reusable data source, and localized
date formatting.

## APIs featured

- `Microsoft.UI.Xaml.Controls.ListView`
- `Microsoft.UI.Xaml.FrameworkElement.SizeChanged`
- `Microsoft.UI.Xaml.GridLength`
- `Windows.Globalization.DateTimeFormatting.DateTimeFormatter`

## Learn docs this serves

- [List/details pattern](https://learn.microsoft.com/windows/apps/develop/ui/controls/list-details)
- [ListView class](https://learn.microsoft.com/windows/windows-app-sdk/api/winrt/microsoft.ui.xaml.controls.listview)
- [FrameworkElement.SizeChanged event](https://learn.microsoft.com/windows/windows-app-sdk/api/winrt/microsoft.ui.xaml.frameworkelement.sizechanged)

## Build & run

```powershell
dotnet build -c Debug -p:Platform=x64
dotnet run -c Debug -p:Platform=x64
```

## Migration notes

The UWP sample navigated to a separate detail page and used
`SystemNavigationManager.GetForCurrentView` and `Window.Current` for back
navigation. Those current-view APIs do not apply to a WinUI 3 desktop window, so
the port keeps both views on one page and manages the narrow-view transition with
an in-page back button.

The sample otherwise uses the standard WinUI 3 shell, title bar, and Mica backdrop.

## Known differences / limitations

The narrow experience is an in-page state change rather than navigation to a second
page. The sample uses a fixed 720-pixel breakpoint to keep that behavior
deterministic.
