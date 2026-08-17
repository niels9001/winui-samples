# MediaImport

Ported to WinUI 3 / Windows App SDK from the UWP
[MediaImport](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/MediaImport)
sample.

## What it shows

This sample provides one end-to-end workflow that discovers PTP, MTP, and removable-media
sources, finds importable photos and videos, imports selected items, and optionally deletes
successfully imported items from the source. It also demonstrates cancellation and recovery
of pending operations after a fresh launch.

## APIs featured

- `Windows.Media.Import.PhotoImportManager`
- `Windows.Media.Import.PhotoImportSource`
- `Windows.Media.Import.PhotoImportSession`
- `Windows.Media.Import.PhotoImportFindItemsResult`
- `Windows.Media.Import.PhotoImportImportItemsResult`

## Learn docs this serves

- [PhotoImportManager class](https://learn.microsoft.com/uwp/api/windows.media.import.photoimportmanager)
- [Windows.Media.Import namespace](https://learn.microsoft.com/uwp/api/windows.media.import)
- [Application lifecycle migration](https://learn.microsoft.com/windows/apps/windows-app-sdk/migrate-to-windows-app-sdk/guides/applifecycle)

## Build & run

```powershell
dotnet build -c Debug -p:Platform=x64
dotnet run -c Debug -p:Platform=x64
```

## Migration notes

The upstream workflow is retained in a responsive direct-page layout. Pending import
operations are checked on every fresh launch because full-trust WinUI apps do not have the
UWP suspension and termination lifecycle.

The package retains the `picturesLibrary` and `removableStorage` capabilities. The UWP
`windows.autoPlayDevice` extension cannot be registered for the WinUI app's
`Windows.FullTrustApplication` entry point (`0x80070032`, request not supported), so sources
must be discovered from within the app. The broad image file-type association from the UWP
sample is also intentionally omitted because importing media does not require making this
sample an image-file handler.

A compatible camera, phone, or removable-media source is required to exercise finding,
importing, and deleting items. Without one, source discovery completes with an empty list.
The documentation does not claim hardware-dependent import operations were validated.
