# SimpleImaging

Ported to WinUI 3 / Windows App SDK from the UWP
[SimpleImaging](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/SimpleImaging)
sample.

## What it shows

The sample has two image workflows:

1. Open an image, display common and extended `ImageProperties`, edit title, keywords, and
   location metadata, and save supported changes back to the file.
2. Open an image, preview rotation and scaling, preserve or apply EXIF orientation, save
   changes to the source, or encode a new JPEG, PNG, or BMP file.

## APIs featured

- `Windows.Storage.FileProperties.ImageProperties`
- `Windows.Graphics.Imaging.BitmapDecoder`
- `Windows.Graphics.Imaging.BitmapEncoder`
- `Windows.Graphics.Imaging.BitmapTransform`
- `Windows.Storage.AccessCache.StorageApplicationPermissions`
- `Windows.Storage.Pickers.FileOpenPicker`
- `Windows.Storage.Pickers.FileSavePicker`

## Learn docs this serves

- [ImageProperties class](https://learn.microsoft.com/uwp/api/windows.storage.fileproperties.imageproperties)
- [BitmapDecoder class](https://learn.microsoft.com/uwp/api/windows.graphics.imaging.bitmapdecoder)
- [BitmapEncoder class](https://learn.microsoft.com/uwp/api/windows.graphics.imaging.bitmapencoder)

## Prerequisites and capabilities

- Use an image format supported by an installed Windows Imaging Component codec. Writable
  metadata, EXIF orientation, and available transforms vary by codec and file format.
- The package declares the restricted `runFullTrust` capability. Picker access grants access
  to the selected files, so no broad picture-library capability is required.

## Build & run

```powershell
dotnet build -c Debug -p:Platform=x64
dotnet run -c Debug -p:Platform=x64
```

## Migration notes

- All three picker instances are associated with the WinUI window through
  `InitializeWithWindow`: the metadata scenario's open picker and the transform scenario's
  open and save-as pickers.
- Selected files are retained through `FutureAccessList`, with tokens stored in local app
  settings, so each scenario can restore its last file while access remains valid.
- The UWP page's empty `Image.Source` value was removed because WinUI 3 does not accept that
  placeholder URI. Images are assigned only after a file is opened.
- The scenario pages use the shared WinUI 3 NavigationView, InfoBar, title bar, and Mica shell.

## Known differences / limitations

- Metadata writes are best effort. A codec can expose a property for reading but reject
  writing it, and formats without writable EXIF orientation require a pixel rotation.
- Save-as encoding is limited to the JPEG, PNG, and BMP choices exposed by the sample.
- The sample edits local files selected by the user; it does not implement batch processing
  or preserve every format-specific metadata block.
