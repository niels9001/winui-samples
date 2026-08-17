# MobileNetworking

Ported to WinUI 3 / Windows App SDK by consolidating the UWP
[MobileBroadband](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/MobileBroadband)
and [MobileHotspot](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/MobileHotspot)
samples.

## What it shows

The Mobile Broadband feature provides seven scenarios for inspecting cellular accounts,
connection profiles, modem information, device services, and SIM data, and for monitoring
account changes or opening the system connection UI. The Mobile Hotspot feature configures
the access point and starts or stops Wi-Fi tethering.

## APIs featured

- `Windows.Networking.NetworkOperators.MobileBroadbandAccount`
- `Windows.Networking.NetworkOperators.MobileBroadbandAccountWatcher`
- `Windows.Networking.NetworkOperators.MobileBroadbandModem`
- `Windows.Networking.NetworkOperators.MobileBroadbandUicc`
- `Windows.Networking.NetworkOperators.NetworkOperatorTetheringManager`
- `Windows.Networking.Connectivity.ConnectionProfile`

## Learn docs this serves

- [Windows.Networking.NetworkOperators namespace](https://learn.microsoft.com/uwp/api/windows.networking.networkoperators)
- [MobileBroadbandAccount class](https://learn.microsoft.com/uwp/api/windows.networking.networkoperators.mobilebroadbandaccount)
- [NetworkOperatorTetheringManager class](https://learn.microsoft.com/uwp/api/windows.networking.networkoperators.networkoperatortetheringmanager)

## Build & run

```powershell
dotnet build -c Debug -p:Platform=x64
dotnet run -c Debug -p:Platform=x64
```

## Migration notes

This project consolidates both upstream samples under one NavigationView shell. It preserves
the restricted `cellularDeviceIdentity`, `cellularDeviceControl`, and `cellularMessaging`
capabilities and the `wiFiControl` device capability. Hotspot workflows check tethering
capability before use and report policy, carrier, hardware, app, SKU, and system-capability
restrictions rather than assuming tethering is available.

The broadband scenarios require a compatible cellular modem, provisioned SIM, and carrier
service. Hotspot scenarios require a Wi-Fi adapter, a suitable internet connection profile,
and tethering permission from the device, carrier, and system policy. This documentation
update does not claim validation against mobile-network hardware or service.
