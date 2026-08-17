# AnimationMetrics

Ported to WinUI 3 / Windows App SDK from the UWP
[AnimationMetrics](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/AnimationMetrics)
sample.

## What it shows

The sample retrieves the raw parameters that define selected Windows animations. Choose
between the added and affected targets of the `AddToList` effect or the primary target of
the `EnterPage` effect to inspect:

- Stagger, delay, duration, and z-order values.
- Cubic Bezier easing control points.
- Scale and opacity values where the selected animation uses those properties.

The sample reports the metrics; it does not play the animations.

## APIs featured

- `Windows.UI.Core.AnimationMetrics.AnimationDescription`
- `AnimationEffect` and `AnimationEffectTarget`
- `IPropertyAnimation`, `ScaleAnimation`, `TranslationAnimation`, and `OpacityAnimation`

## Learn docs this serves

- [Windows.UI.Core.AnimationMetrics namespace](https://learn.microsoft.com/uwp/api/windows.ui.core.animationmetrics)
- [Timing and easing for Windows apps](https://learn.microsoft.com/windows/apps/design/motion/timing-and-easing)

## Build & run

```powershell
dotnet build -c Debug -p:Platform=x64
dotnet run -c Debug -p:Platform=x64
```

## Migration notes

`Windows.UI.Core.AnimationMetrics` is a Windows Desktop Extension API and remains available
to a packaged WinUI 3 app, so no API replacement was required. The UWP XAML namespaces were
replaced with WinUI 3 namespaces. Because the sample contains only one scenario, the window
navigates directly to that page instead of adding a NavigationView solely for one item.

The metrics output is now read-only and selectable so its values can be copied.

## Known differences / limitations

The port retains the three effect/target combinations from the original sample. It does not
attempt to visualize the animations or enumerate every value in `AnimationEffect`.
