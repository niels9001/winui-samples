# SocketActivityStreamSocket

Ported to WinUI 3 / Windows App SDK from the UWP
[SocketActivityStreamSocket](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/SocketActivityStreamSocket)
sample.

## What it shows

The sample combines a packaged client, an out-of-process C#/WinRT background component, and
a companion listener server:

1. The client requests background access and registers a `SocketActivityTrigger`.
2. A connected `StreamSocket` is enabled for transfer and handed to the Windows socket
   broker. If connected-standby wake is unavailable, the client retries with `DoNotWake`.
3. The background component handles socket data, keep-alive expiration, and socket-closed
   reasons, then returns an active socket to the broker or reconnects it.
4. Received data is shown through a platform toast while the foreground client is closed.
5. When relaunched, the client recovers broker-owned socket state from
   `SocketActivityInformation.AllSockets`.

## APIs featured

- [`Windows.Networking.Sockets.StreamSocket`](https://learn.microsoft.com/uwp/api/windows.networking.sockets.streamsocket)
- [`Windows.Networking.Sockets.SocketActivityInformation`](https://learn.microsoft.com/uwp/api/windows.networking.sockets.socketactivityinformation)
- [`Windows.ApplicationModel.Background.SocketActivityTrigger`](https://learn.microsoft.com/uwp/api/windows.applicationmodel.background.socketactivitytrigger)
- [`Windows.Networking.Sockets.StreamSocketListener`](https://learn.microsoft.com/uwp/api/windows.networking.sockets.streamsocketlistener)

## Learn docs this serves

- [Network communications in the background](https://learn.microsoft.com/windows/apps/develop/networking/network-communications-in-the-background)
- [Background task migration strategy](https://learn.microsoft.com/windows/apps/windows-app-sdk/migrate-to-windows-app-sdk/guides/background-task-migration-strategy)
- [C#/WinRT component authoring](https://learn.microsoft.com/windows/apps/develop/platform/csharp-winrt/authoring)

## Prerequisites and capabilities

- Run the included companion server on a reachable address. The basic broker transfer works
  over localhost, but a second PC or a development loopback exemption is needed to exercise
  the automatic reconnect path after the server closes.
- Windows must grant background activity, and notifications must be enabled for the client
  package to display received messages.
- The client declares `internetClient`, `privateNetworkClientServer`, and `runFullTrust`.
  The companion server declares `internetClientServer`, `privateNetworkClientServer`, and
  `runFullTrust`.
- The package registers the C#/WinRT component as both a `windows.backgroundTasks` entry point
  and a `WinRT.Host.dll` activatable class.

## Build & run

Build the client and its background component from this folder:

```powershell
dotnet build -c Debug -p:Platform=x64
```

Build and start the companion server in another terminal:

```powershell
dotnet run --project .\Server\StreamSocketListenerServer.csproj -c Debug -p:Platform=x64
```

Start the client:

```powershell
dotnet run -c Debug -p:Platform=x64
```

Connect the client to the server on TCP port 40404. Close the client after it reports a
successful connection, then send a message from the server.

## Migration notes

- The UWP Windows Runtime background component is now a C#/WinRT-authored .NET component.
  The package registers `WinRT.Host.dll` so `backgroundtaskhost.exe` can activate it.
- The socket is still transferred immediately after connection; the original sample does
  not depend on the UWP suspension lifecycle.
- The client explicitly requests background access before registering the trigger.
- PCs without connected standby automatically use
  `SocketActivityConnectedStandbyAction.DoNotWake`.
- The server uses `DispatcherQueue` instead of `CoreDispatcher`.
- Both foreground apps use the standard Mica and `TitleBar` window chrome.

## Known differences / limitations

- The full-trust foreground client and server can connect over `localhost`. To validate the
  background task's automatic reconnect path after the server closes, use two machines or
  add a development loopback exemption for the client package.
- A `DoNotWake` connection receives messages after the client closes while the PC is awake,
  but does not wake a sleeping PC.
- The low-integrity out-of-process background component uses the platform
  `ToastNotificationManager`; Windows App SDK notification activation is not available in
  `backgroundtaskhost.exe`.
- Notifications must be enabled for the client in Windows Settings to see received messages.
