# XamlDragAndDrop

Ported to WinUI 3 / Windows App SDK from the UWP
[XamlDragAndDrop](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/XamlDragAndDrop)
sample.

## What it shows

The sample demonstrates three drag-and-drop workflows:

1. Move items from an **All Items** list to **Selection**, reorder selected items,
   and remove them with a trash drop target.
2. Customize the drag visual at both the source and target.
3. Start a drag from app logic, supply rendered bitmap content, and cancel the
   operation when a timed symbol game expires.

## APIs featured

- `Windows.ApplicationModel.DataTransfer.DataPackage`
- `Windows.ApplicationModel.DataTransfer.DataPackageOperation`
- `Windows.ApplicationModel.DataTransfer.StandardDataFormats`
- `Microsoft.UI.Xaml.UIElement.StartDragAsync`
- `Microsoft.UI.Xaml.DragUIOverride`
- `Microsoft.UI.Xaml.Media.Imaging.RenderTargetBitmap`

## Learn docs this serves

- [Drag and drop](https://learn.microsoft.com/en-us/windows/apps/design/input/drag-and-drop)
- [DataPackage class](https://learn.microsoft.com/en-us/uwp/api/windows.applicationmodel.datatransfer.datapackage?view=winrt-26100)
- [UIElement.StartDragAsync method](https://learn.microsoft.com/en-us/windows/windows-app-sdk/api/winrt/microsoft.ui.xaml.uielement.startdragasync?view=windows-app-sdk-2.2)
- [RenderTargetBitmap class](https://learn.microsoft.com/en-us/windows/windows-app-sdk/api/winrt/microsoft.ui.xaml.media.imaging.rendertargetbitmap?view=windows-app-sdk-2.2)

## Build & run

```powershell
dotnet build -c Debug -p:Platform=x64
dotnet run -c Debug -p:Platform=x64
```

A mouse, touchscreen, or pen is needed to perform the drag interactions.

## Migration notes

The `Windows.ApplicationModel.DataTransfer` APIs used by the UWP sample remain
available to the packaged WinUI 3 app. XAML namespaces and dispatcher usage follow
the WinUI 3 shell conventions.

`Assets/dropcursor.png` and `Assets/Symbols.txt` are packaged as content for the
custom drag visual and timed game.

## Known differences / limitations

No functional API gap is known. The timed game and drag-over visuals require manual
pointer interaction and are not deterministic screenshot states.
