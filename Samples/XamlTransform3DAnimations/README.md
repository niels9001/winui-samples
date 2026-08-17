# XamlTransform3DAnimations

Ported to WinUI 3 / Windows App SDK from the UWP
[XamlTransform3DAnimations](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/XamlTransform3DAnimations)
sample.

## What it shows

This sample presents five sections in a news `Hub`. Each section periodically
rotates between cards as a three-dimensional prism, and selecting a card opens an
article with staggered zoom and fade entrance effects.

The app checks `UISettings.AnimationsEnabled` before starting custom motion so it
respects the Windows animation-effects preference and environments such as Remote
Desktop that report animations unavailable.

## APIs featured

- `Microsoft.UI.Xaml.UIElement.Transform3D`
- `Microsoft.UI.Xaml.Media.Media3D.CompositeTransform3D`
- `Microsoft.UI.Xaml.Media.Media3D.PerspectiveTransform3D`
- `Microsoft.UI.Xaml.Media.Animation.Storyboard`
- `Microsoft.UI.Xaml.Controls.Hub` and `HubSection`
- `Windows.UI.ViewManagement.UISettings.AnimationsEnabled`

## Learn docs this serves

- [Storyboarded animations](https://learn.microsoft.com/en-us/windows/apps/develop/motion/storyboarded-animations)
- [UIElement.Transform3D property](https://learn.microsoft.com/windows/windows-app-sdk/api/winrt/microsoft.ui.xaml.uielement.transform3d)
- [CompositeTransform3D class](https://learn.microsoft.com/windows/windows-app-sdk/api/winrt/microsoft.ui.xaml.media.media3d.compositetransform3d)
- [PerspectiveTransform3D class](https://learn.microsoft.com/windows/windows-app-sdk/api/winrt/microsoft.ui.xaml.media.media3d.perspectivetransform3d)
- [Hub class](https://learn.microsoft.com/windows/windows-app-sdk/api/winrt/microsoft.ui.xaml.controls.hub)

## Build & run

```powershell
dotnet build -c Debug -p:Platform=x64
dotnet run -c Debug -p:Platform=x64
```

## Migration notes

The port keeps this as a direct-page `Hub` experience rather than placing the
content in the standard scenario `NavigationView`. Back navigation for article
pages is exposed through the WinUI `TitleBar` instead of UWP's
`SystemNavigationManager`.

Section timers stop when their views are not active. Release trimming is disabled
for this project to preserve the view-model members used by XAML binding.

## Known differences / limitations

When Windows animation effects are disabled, or an environment reports them
unavailable, the sample intentionally suppresses its custom three-dimensional
transitions. The news content is packaged sample data rather than a live service.
