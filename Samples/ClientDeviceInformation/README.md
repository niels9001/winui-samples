# Client Device Information

This WinUI 3 sample retrieves operating-system and hardware identity properties through
`EasClientDeviceInformation`.

## What the sample shows

- Retrieving the device ID and operating-system name.
- Reading the friendly name, manufacturer, product name, and system SKU.
- Presenting the values in selectable, read-only fields.

## APIs featured

- `Windows.Security.ExchangeActiveSyncProvisioning.EasClientDeviceInformation`

## Related documentation

- [EasClientDeviceInformation class](https://learn.microsoft.com/uwp/api/windows.security.exchangeactivesyncprovisioning.easclientdeviceinformation)

## Build and run

From this directory:

```powershell
dotnet build -c Debug -p:Platform=x64
dotnet run -c Debug -p:Platform=x64
```

## Migration notes

- The WinRT API remains available to a packaged WinUI 3 desktop app without an additional
  capability declaration.
- Because the sample has one scenario, the window navigates directly to the sample page
  instead of showing a one-item `NavigationView`.
- Disabled UWP output fields were replaced with read-only fields so values remain selectable.

## Known differences / limitations

- Hardware identity strings come from firmware and Windows configuration. Some fields may be
  empty or generic on virtual machines and custom-built PCs.
