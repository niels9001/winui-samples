# LibraryManagement

Ported to WinUI 3 / Windows App SDK from the UWP
[LibraryManagement](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/LibraryManagement)
sample.

## What it shows

This sample provides three scenarios for adding, listing, and removing folders from the
user's Pictures library definition. Removing a folder from the library does not delete the
folder or its contents.

## APIs featured

- `Windows.Storage.StorageLibrary`
- `Windows.Storage.KnownLibraryId`
- `StorageLibrary.RequestAddFolderAsync`
- `StorageLibrary.RequestRemoveFolderAsync`
- `StorageLibrary.DefinitionChanged`

## Learn docs this serves

- [StorageLibrary class](https://learn.microsoft.com/uwp/api/windows.storage.storagelibrary)
- [Files, folders, and libraries](https://learn.microsoft.com/windows/uwp/files/)

## Build & run

```powershell
dotnet build -c Debug -p:Platform=x64
dotnet run -c Debug -p:Platform=x64
```

## Migration notes

The `picturesLibrary` capability remains required. `CoreDispatcher` event marshalling was
replaced with `DispatcherQueue`, and library change handlers are removed when pages are
navigated away from. The library-managed add/remove consent experiences do not expose an
HWND initialization contract, so their runtime behavior must be validated in the packaged
desktop app.
