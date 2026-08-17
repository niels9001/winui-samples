# Storing settings and app data across sessions

The `ApplicationData` project was ported to WinUI 3 / Windows App SDK from the UWP
[ApplicationData](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/ApplicationData) sample.

## What it shows

Store and retrieve per-user app data using Windows Runtime APIs. The seven scenarios cover
local, local-cache, temporary, and roaming app-data folders; local settings and setting
containers; composite settings; the `ms-appdata://` URI scheme; clearing app data; and
app-data versioning.

## APIs featured

- `Windows.Storage.ApplicationData`
- `Windows.Storage.ApplicationDataContainer`
- `Windows.Storage.ApplicationDataCompositeValue`
- `Windows.Storage.StorageFolder`, `StorageFile`, and `FileIO`
- `StorageFile.GetFileFromApplicationUriAsync` and `ms-appdata://` URIs
- `Microsoft.UI.Xaml.Controls.Image` with `Microsoft.UI.Xaml.Media.Imaging.BitmapImage`

## Learn docs this serves

- [Store and retrieve settings and other app data](https://learn.microsoft.com/windows/apps/develop/data/store-and-retrieve-app-data)
- [Windows.Storage.ApplicationData](https://learn.microsoft.com/uwp/api/windows.storage.applicationdata)

## Build & run

```powershell
dotnet build -c Debug -p:Platform=x64
dotnet run -c Debug -p:Platform=x64
```

## Migration notes

This port keeps the original `SDKTemplate` namespace and code-behind scenario structure while
using the shared NavigationView/InfoBar shell. XAML namespaces moved from UWP XAML to WinUI 3
(`Microsoft.UI.Xaml` in code-behind), and scenario pages leave their backgrounds unset so Mica
shows through.

## Known differences / limitations

- The source UWP sample uses `ApplicationData.RoamingFolder` for the
  `ms-appdata:///roaming/...` image example. The API remains available to packaged apps, but
  Microsoft Learn states that roaming app data and settings are no longer supported as of
  Windows 11 and recommends a service for cross-device synchronization. This port keeps the
  scenario for API compatibility, but it does not demonstrate real cross-device roaming on
  Windows 11.
- The current upstream UWP snapshot contains shared XAML only for scenarios 6 and 7. The XAML
  for scenarios 1 through 5 was recreated to match the original code-behind control names and
  event handlers.
