# NetworkConnectivity

Ported to WinUI 3 / Windows App SDK from the UWP
[NetworkConnectivity](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/NetworkConnectivity)
sample.

## What it shows

This sample provides three scenarios for querying the current connectivity level, evaluating
network cost and roaming state, and listening for connectivity changes. It also demonstrates
how an app can combine connectivity and cost guidance before attempting an HTTP request.

## APIs featured

- `Windows.Networking.Connectivity.NetworkInformation`
- `Windows.Networking.Connectivity.ConnectionProfile`
- `Windows.Networking.Connectivity.ConnectionCost`
- `Windows.Networking.Connectivity.NetworkConnectivityLevel`
- `Windows.Web.Http.HttpClient`

## Learn docs this serves

- [NetworkInformation.GetInternetConnectionProfile method](https://learn.microsoft.com/uwp/api/windows.networking.connectivity.networkinformation.getinternetconnectionprofile)
- [Windows.Networking.Connectivity namespace](https://learn.microsoft.com/uwp/api/windows.networking.connectivity)
- [NetworkInformation class](https://learn.microsoft.com/uwp/api/windows.networking.connectivity.networkinformation)

## Build & run

```powershell
dotnet build -c Debug -p:Platform=x64
dotnet run -c Debug -p:Platform=x64
```

## Migration notes

`NetworkInformation.NetworkStatusChanged` callbacks marshal UI updates through
`App.MainDispatcherQueue` instead of UWP `CoreDispatcher`. The connectivity helper fully
qualifies `Windows.Web.Http.HttpClient` to avoid ambiguity with the .NET HTTP client.

The package retains `internetClient`. Meaningful results require an active network
connection, and status changes can take time for Windows to detect. The sample's HTTP probe
uses the Microsoft connectivity-test endpoint; network-dependent behavior is not claimed as
validated by this documentation update.
