# StreamSocket

Ported to WinUI 3 / Windows App SDK from the UWP
[StreamSocket](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/StreamSocket)
sample.

## What it shows

The sample retains all five upstream scenarios:

1. Start a `StreamSocketListener` on any address, one local address, or one network adapter.
2. Connect a `StreamSocket` client, optionally restricted to the listener's adapter.
3. Send and receive a length-prefixed UTF-8 message.
4. Detach and dispose the writer, sockets, and listener.
5. Inspect TLS certificate validation errors, explicitly authorize a test-only retry, and
   display the server certificate chain.

## APIs featured

- `Windows.Networking.Sockets.StreamSocket`
- `Windows.Networking.Sockets.StreamSocketListener`
- `Windows.Networking.Sockets.StreamSocketControl`
- `Windows.Networking.Sockets.StreamSocketInformation`
- `Windows.Networking.Connectivity.NetworkAdapter`
- `Windows.Storage.Streams.DataReader`
- `Windows.Storage.Streams.DataWriter`
- `Windows.Security.Cryptography.Certificates.Certificate`

## Learn docs this serves

- [Sockets](https://learn.microsoft.com/windows/uwp/networking/sockets)
- [StreamSocket class](https://learn.microsoft.com/uwp/api/windows.networking.sockets.streamsocket)
- [StreamSocketListener class](https://learn.microsoft.com/uwp/api/windows.networking.sockets.streamsocketlistener)

## Prerequisites and capabilities

- Scenarios 1 through 4 can run over localhost. Binding to one address or network adapter
  requires an active local address with an associated adapter.
- Scenario 5 starts an in-process loopback TLS server and does not require IIS, PowerShell
  setup, an external certificate, or an internet service.
- The package declares `internetClientServer`, `privateNetworkClientServer`,
  `runFullTrust`, and `systemAIModels`. The socket scenarios do not directly call a System AI
  Models API.

## Build & run

```powershell
dotnet build -c Debug -p:Platform=x64
dotnet run -c Debug -p:Platform=x64
```

Run scenarios 1 through 4 in order for the plain TCP walkthrough. Scenario 5 is independent
and starts its own local TLS test server.

## Migration notes

- UWP state stored in `CoreApplication.Properties` was replaced by an app-owned typed
  `SocketService`.
- `CoreDispatcher` was replaced by `DispatcherQueue` when listener events report back to the
  UI.
- `MessageDialog` was replaced by a `ContentDialog` owned by the page's `XamlRoot`.
- The original elevated IIS and PowerShell setup for scenario 5 was replaced by an in-process
  `TcpListener` and `SslStream`. The server generates an ephemeral, self-signed
  `CN=www.fabrikam.com` certificate and binds to an available loopback port.
- A packaged full-trust WinUI app can use localhost directly; the UWP loopback restriction
  does not apply to this sample.

## Known differences / limitations

- The local TLS certificate is deliberately untrusted and name-mismatched. Ignoring those
  errors is appropriate only for this isolated sample and must not be copied into production
  networking code.
- Adapter-bound connections require an active local address with a usable network adapter.
