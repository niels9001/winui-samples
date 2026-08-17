# WebSocket

Ported to WinUI 3 / Windows App SDK from the UWP
[WebSocket](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/WebSocket)
sample.

## What it shows

This sample demonstrates the complete client lifecycle for both Windows WebSocket
APIs. Its four scenarios send and receive UTF-8 `MessageWebSocket` messages,
continuously stream binary data through a `StreamWebSocket`, authenticate a secure
connection with a client certificate, and send non-final and final UTF-8 frames
while receiving partial-message callbacks.

## APIs featured

- `Windows.Networking.Sockets.MessageWebSocket`
- `Windows.Networking.Sockets.StreamWebSocket`
- `Windows.Networking.Sockets.MessageWebSocketReceiveMode`
- `Windows.Networking.Sockets.WebSocketServerCustomValidationRequestedEventArgs`
- `Windows.Storage.Streams.DataReader` and `DataWriter`
- `Windows.Security.Cryptography.Certificates.CertificateEnrollmentManager`
- `Windows.Security.Cryptography.Certificates.Certificate`
- `Microsoft.UI.Dispatching.DispatcherQueue`
- `System.Net.Sockets.TcpListener`, `System.Net.Security.SslStream`, and
  `System.Net.WebSockets.WebSocket`

## Learn docs this serves

- [Sockets](https://learn.microsoft.com/windows/uwp/networking/sockets)
- [MessageWebSocket class](https://learn.microsoft.com/uwp/api/windows.networking.sockets.messagewebsocket)
- [StreamWebSocket class](https://learn.microsoft.com/uwp/api/windows.networking.sockets.streamwebsocket)
- [WebSocket security](https://learn.microsoft.com/windows/uwp/networking/websockets#websocket-security)
- [Certificates](https://learn.microsoft.com/windows/uwp/security/certificates)

## Build & run

```powershell
dotnet build -c Debug -p:Platform=x64
dotnet run -c Debug -p:Platform=x64
```

The default addresses need no external server, script, elevation, or network
connection. The app starts plaintext, TLS, and mutual-TLS endpoints on available
loopback ports and fills each scenario's server-address field automatically.

## Migration notes

- The four upstream C# scenarios are retained: UTF-8 messages, a binary stream,
  client-certificate authentication, and partial/final message frames.
- UWP `CoreDispatcher` callback marshaling was replaced by `DispatcherQueue`.
  Each scenario releases its sockets, streams, writers, cancellation sources,
  background tasks, and event callbacks when it closes or is navigated away from.
- The upstream IIS site, setup/removal scripts, generated certificate files, and
  elevated certificate configuration were replaced by an in-process managed
  loopback service. It uses `TcpListener` and `System.Net.WebSockets.WebSocket`
  for WebSocket handling and `SslStream` for TLS.
- The loopback service generates a short-lived root, name-mismatched server
  certificate, and client certificate for each app run. The client-authentication
  scenario imports the client PFX into the app certificate store, assigns it to
  `StreamWebSocketControl.ClientCertificate`, and removes its uniquely named
  per-instance enrollment when the app closes.
- The secure message and stream scenarios retain the upstream custom server
  certificate callback and deferral pattern. Every test-only trust or name
  exception is limited to an exact generated loopback endpoint and paired with
  SHA-256 pinning of the generated leaf and root certificates. External
  `wss://` addresses always use normal platform certificate validation. Never
  copy this test-only policy into production code.
- Server-address fields remain editable. External `ws://` or `wss://` servers
  must implement compatible echo behavior and provide any certificates their
  configuration requires. The client-authentication scenario intentionally
  accepts only its generated mutual-TLS endpoint because its ephemeral client
  certificate has no meaning to an external server.

## Known differences / limitations

- Ephemeral ports replace the upstream fixed IIS paths, so addresses change on
  every launch.
- The partial-message page preserves upstream frame behavior. Use ASCII text when
  deliberately splitting a UTF-8 message; a multi-byte character split between
  frames requires an incremental UTF-8 decoder in production code.
