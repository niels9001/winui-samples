# WebSocket

Ported to WinUI 3 / Windows App SDK from the UWP
[WebSocket](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/WebSocket)
sample.

## What it shows

This sample demonstrates the WebSocket client lifecycle in four scenarios:

1. Exchange UTF-8 messages with `MessageWebSocket`.
2. Continuously send and receive binary data with `StreamWebSocket`.
3. Import an ephemeral client certificate and authenticate with mutual TLS.
4. Receive partial frames and distinguish them from the final message frame.

The app starts a managed in-process loopback service with generated `ws://` and
`wss://` endpoints, so the scenarios do not require the upstream sample's IIS
service or scripts.

## APIs featured

- `Windows.Networking.Sockets.MessageWebSocket`
- `Windows.Networking.Sockets.StreamWebSocket`
- `Windows.Networking.Sockets.MessageWebSocketReceiveMode`
- `Windows.Networking.Sockets.WebSocketServerCustomValidationRequestedEventArgs`
- `Windows.Security.Cryptography.Certificates.CertificateEnrollmentManager`
- `Windows.Storage.Streams.DataReader` and `DataWriter`

## Learn docs this serves

- [Sockets](https://learn.microsoft.com/en-us/windows/apps/develop/networking/sockets)
- [WebSockets](https://learn.microsoft.com/en-us/windows/apps/develop/networking/websockets)
- [MessageWebSocket class](https://learn.microsoft.com/en-us/uwp/api/windows.networking.sockets.messagewebsocket?view=winrt-28000)
- [StreamWebSocket class](https://learn.microsoft.com/en-us/uwp/api/windows.networking.sockets.streamwebsocket?view=winrt-28000)
- [MessageWebSocketReceiveMode enumeration](https://learn.microsoft.com/en-us/uwp/api/windows.networking.sockets.messagewebsocketreceivemode?view=winrt-28000)

## Requirements

No external server, special hardware, account, or elevation is required for the
default loopback scenarios. An operator-supplied `ws://` or `wss://` endpoint must
echo compatible data; secure external endpoints must present a normally trusted
certificate.

## Build & run

```powershell
dotnet build -c Debug -p:Platform=x64
dotnet run -c Debug -p:Platform=x64
```

## Migration notes

The UWP sample's external IIS and script dependency was replaced by
`LoopbackWebSocketServer`, which uses `TcpListener`, `SslStream`, and
`System.Net.WebSockets.WebSocket`. A root, server, and client certificate are
generated for each run.

Custom server-certificate validation accepts only certificates pinned to the
generated loopback endpoints. The client-authentication scenario imports its
generated PFX, assigns it through `StreamWebSocketControl.ClientCertificate`, and
removes it during cleanup.

The manifest declares `internetClient`, `privateNetworkClientServer`, and
`runFullTrust`.

## Known differences / limitations

The generated certificates and custom validation path are for local demonstration,
not production trust management. When deliberately splitting text into partial
frames, use ASCII input so a split does not divide a multibyte UTF-8 sequence.
