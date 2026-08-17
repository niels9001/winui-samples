# DatagramSocket

Ported to WinUI 3 / Windows App SDK from the UWP
[DatagramSocket](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/DatagramSocket)
sample.

## What it shows

This sample uses UDP sockets to send and receive datagrams:

1. **Start Datagram Listener** binds a listener by service name, local address, or network
   adapter and handles received messages.
2. **Connect to Listener** creates a client socket and connects it to a host and service.
3. **Send Data** writes text to the connected socket with `DataWriter`.
4. **Close Socket** disposes the writer, client, and listener and clears shared state.
5. **Multicast/Broadcast** joins multicast groups and sends to multicast or broadcast
   endpoints.

Run the first four scenarios in order. The listener and client are stored in shared app
state so later scenarios can use the sockets created earlier.

## APIs featured

- `Windows.Networking.Sockets.DatagramSocket`
- `Windows.Networking.Sockets.DatagramSocketMessageReceivedEventArgs`
- `Windows.Networking.HostName`
- `Windows.Networking.Connectivity.NetworkInformation`
- `Windows.Storage.Streams.DataReader` and `DataWriter`

## Learn docs this serves

- [DatagramSocket class](https://learn.microsoft.com/uwp/api/windows.networking.sockets.datagramsocket)
- [Windows.Networking.Sockets namespace](https://learn.microsoft.com/uwp/api/windows.networking.sockets)
- [DataReader class](https://learn.microsoft.com/uwp/api/windows.storage.streams.datareader)
- [DataWriter class](https://learn.microsoft.com/uwp/api/windows.storage.streams.datawriter)

## Requirements

- Windows 10 version 1809 (10.0.17763.0) or later.
- The manifest declares `internetClientServer`, `privateNetworkClientServer`, and
  `runFullTrust`.
- A network adapter and reachable UDP peer are required for cross-device tests. The sample
  can also host its listener and client in the same process.
- Multicast and broadcast results depend on the active network, adapter, firewall, and
  router configuration.

## Build & run

```powershell
dotnet build -c Debug -p:Platform=x64
dotnet run -c Debug -p:Platform=x64
```

## Migration notes

The socket and stream APIs remain available to packaged WinUI 3 desktop apps. The port
replaces the UWP shell with `NavigationView` and `InfoBar`, routes callback updates through
`DispatcherQueue`, and keeps the original `CoreApplication.Properties` state-sharing
pattern for the ordered listener and client scenarios.

## Known differences / limitations

No socket scenario was intentionally removed. Successful cross-device, multicast, and
broadcast tests still require network infrastructure that permits the selected traffic.
