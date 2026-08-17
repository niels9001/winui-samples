# Capabilities

This WinUI 3 sample queries and requests declared app capabilities through
`AppCapability`.

## What the sample shows

- Checking the current access status of the location capability.
- Responding when capability access changes.
- Setting a display message that explains why location is in use.
- Requesting location and webcam access in one operation.

## APIs featured

- `Windows.Security.Authorization.AppCapabilityAccess.AppCapability`
- `Windows.Security.Authorization.AppCapabilityAccess.AppCapabilityAccessStatus`
- `Windows.Devices.Geolocation.Geolocator`
- `Windows.System.Launcher`

## Related documentation

- [AppCapability class](https://learn.microsoft.com/uwp/api/windows.security.authorization.appcapabilityaccess.appcapability)
- [App capability declarations](https://learn.microsoft.com/windows/uwp/packaging/app-capability-declarations)

## Build and run

From this directory:

```powershell
dotnet build -c Debug -p:Platform=x64
dotnet run -c Debug -p:Platform=x64
```

The sample requires Windows 11, version 22H2 (build 22621) or later. The packaged app
declares the `location` and `webcam` device capabilities.

## Migration notes

- UWP `CoreDispatcher` usage was replaced with `DispatcherQueue`.
- The UWP status area was replaced with the standard WinUI 3 `InfoBar`.
- The location privacy settings page still opens through `Launcher.LaunchUriAsync`.

## Known differences / limitations

- Location results depend on Windows privacy settings and the machine's available location
  providers.
- Capability prompts may not reappear after a user has already made a privacy choice. Access
  can be changed in Windows Settings.
