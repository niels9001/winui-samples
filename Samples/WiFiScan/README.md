# WiFiScan

Ported to WinUI 3 / Windows App SDK from the UWP
[WiFiScan](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/WiFiScan)
sample.

## What it shows

This sample demonstrates four Wi-Fi adapter workflows:

1. Display cached network reports for every available adapter without scanning.
2. Start an on-demand scan with the first available adapter.
3. Register for `AvailableNetworksChanged` and refresh results after system scans.
4. Connect to an open or password-protected network, observe connectivity changes,
   and disconnect.

Signal-bar assets indicate security and relative signal strength for each network.

## APIs featured

- `Windows.Devices.WiFi.WiFiAdapter`
- `Windows.Devices.WiFi.WiFiNetworkReport`
- `Windows.Devices.WiFi.WiFiConnectionResult`
- `Windows.Devices.WiFi.WiFiReconnectionKind`
- `Windows.Networking.Connectivity.NetworkInformation`
- `Windows.Security.Credentials.PasswordCredential`
- `Microsoft.UI.Dispatching.DispatcherQueue`

## Learn docs this serves

- [Enumerate devices](https://learn.microsoft.com/en-us/windows/apps/develop/devices-sensors/enumerate-devices)
- [WiFiAdapter class](https://learn.microsoft.com/en-us/uwp/api/windows.devices.wifi.wifiadapter?view=winrt-28000)
- [WiFiNetworkReport class](https://learn.microsoft.com/en-us/uwp/api/windows.devices.wifi.wifinetworkreport?view=winrt-28000)
- [WiFiConnectionResult class](https://learn.microsoft.com/en-us/uwp/api/windows.devices.wifi.wificonnectionresult?view=winrt-28000)

## Requirements

A Windows-compatible Wi-Fi adapter is required, Wi-Fi access must be allowed, and
Wi-Fi must be enabled. The connection scenario needs a valid password for a secured
network. No account or external service is required.

Scenario 1 reads cached reports from all adapters. Scenarios 2 through 4 use only
the first adapter returned by the system.

## Build & run

```powershell
dotnet build -c Debug -p:Platform=x64
dotnet run -c Debug -p:Platform=x64
```

## Migration notes

The signal-bar assets from the UWP sample are packaged with the WinUI 3 app.
`AvailableNetworksChanged` is marshalled to the UI thread with
`App.MainDispatcherQueue`, and the package declares the `wiFiControl` device
capability.

## Known differences / limitations

Network reports, scan timing, visible SSIDs, and connection results depend on the
adapter, driver, radio state, permissions, and local wireless environment. A system
with no adapter or no visible networks is handled as a supported empty state.
