# XamlTransform3DAnimations

Ported to WinUI 3 / Windows App SDK from the UWP
[XamlTransform3DAnimations](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/XamlTransform3DAnimations)
sample.

## What it shows

This sample presents five horizontally panning news sections and periodically replaces a
visible section with a 3D card-rotation and shadow transition. Selecting an article opens a
detail page whose headline, image, and body enter with a staggered 3D zoom and fade.

## APIs featured

- `Microsoft.UI.Xaml.UIElement.Transform3D`
- `Microsoft.UI.Xaml.Media.Media3D.CompositeTransform3D`
- `Microsoft.UI.Xaml.Media.Media3D.PerspectiveTransform3D`
- `Microsoft.UI.Xaml.Media.Animation.Storyboard` and key-frame animations
- `Microsoft.UI.Xaml.Controls.Hub` and `HubSection`
- `Windows.UI.ViewManagement.UISettings.AnimationsEnabled`
- `Microsoft.UI.Xaml.Controls.TitleBar`

## Learn docs this serves

- [UIElement.Transform3D](https://learn.microsoft.com/windows/windows-app-sdk/api/winrt/microsoft.ui.xaml.uielement.transform3d)
- [CompositeTransform3D](https://learn.microsoft.com/windows/windows-app-sdk/api/winrt/microsoft.ui.xaml.media.media3d.compositetransform3d)
- [PerspectiveTransform3D](https://learn.microsoft.com/windows/windows-app-sdk/api/winrt/microsoft.ui.xaml.media.media3d.perspectivetransform3d)
- [Storyboarded animations](https://learn.microsoft.com/windows/apps/develop/platform/xaml/storyboarded-animations)
- [Hub](https://learn.microsoft.com/windows/windows-app-sdk/api/winrt/microsoft.ui.xaml.controls.hub)

## Build & run

```powershell
dotnet build -c Debug -p:Platform=x64
dotnet run -c Debug -p:Platform=x64
```

## Migration notes

The UWP `Windows.UI.Xaml` types were migrated to `Microsoft.UI.Xaml`, including the
`Transform3D`, animation, and control namespaces. The native WinUI `Hub` and all five
upstream sections are retained; its section templates now use compiled bindings and
keyboard-accessible article buttons.

UWP `SystemNavigationManager` back handling was replaced with the WinUI `TitleBar` back
button. The section-refresh and simulated-load timers stop when their pages are not active,
the refresh timer leaves the keyboard-focused section unchanged, and the section storyboard
is stopped and reset when its control unloads. Both custom animation sequences check
`UISettings.AnimationsEnabled`; when system animations are off, content updates and
navigation complete without custom motion. Release trimming is disabled because the
compiled WinUI XAML graph is not trim-safe.

## Known differences / limitations

There are no feature gaps. The article page receives the selected article object so its
image and headline remain consistent across navigation, rather than creating a second
random article as the UWP sample did.
