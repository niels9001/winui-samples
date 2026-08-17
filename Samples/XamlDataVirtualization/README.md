# XamlDataVirtualization

Ported to WinUI 3 / Windows App SDK from the UWP
[XamlDataVirtualization](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/XamlDataVirtualization)
sample.

## What it shows

This sample presents the current user's Pictures library through two virtualized
`GridView` scenarios:

1. A custom `IList` and `IItemsRangeInfo` source loads and caches files and
   thumbnails according to the visible and tracked item ranges.
2. An `ISelectionInfo` source maintains extended selection independently from
   realized item containers and remaps selection after a forced source reset.

The results depend on the files available in the Pictures library.

## APIs featured

- `Microsoft.UI.Xaml.Data.IItemsRangeInfo`
- `Microsoft.UI.Xaml.Data.ISelectionInfo`
- `Microsoft.UI.Xaml.Data.ItemIndexRange`
- `Windows.Storage.StorageLibrary`
- `Windows.Storage.Search.StorageFileQueryResult`

## Learn docs this serves

- [ListView and GridView](https://learn.microsoft.com/en-us/windows/apps/design/controls/listview-and-gridview)
- [IItemsRangeInfo interface](https://learn.microsoft.com/en-us/windows/windows-app-sdk/api/winrt/microsoft.ui.xaml.data.iitemsrangeinfo?view=windows-app-sdk-2.2)
- [ISelectionInfo interface](https://learn.microsoft.com/en-us/windows/windows-app-sdk/api/winrt/microsoft.ui.xaml.data.iselectioninfo?view=windows-app-sdk-2.2)
- [StorageLibrary class](https://learn.microsoft.com/en-us/uwp/api/windows.storage.storagelibrary?view=winrt-26100)

## Build & run

```powershell
dotnet build -c Debug -p:Platform=x64
dotnet run -c Debug -p:Platform=x64
```

The package declares the `picturesLibrary` capability. Allow Pictures library
access and add pictures to that library to observe loaded thumbnails.

## Migration notes

The data sources marshal storage-query updates with `DispatcherQueue`. They use a
non-null placeholder item while data is pending because the WinUI 3 item pipeline
can fail fast when a virtualized source returns `null` for an unrealized item.

The shell and page styling follow the repository's WinUI 3 title bar, Mica, and
scenario-navigation conventions.

## Known differences / limitations

The sample reads only the current user's Pictures library and does not synthesize
fallback items, so an empty library produces an empty grid. Thumbnail timing and
content are environment-dependent.
