# Socket activity stream socket

Demonstrates how a packaged WinUI 3 app can transfer a connected stream socket to
the Windows socket broker so the connection survives after the foreground app closes.

## What the sample shows

- Registering an out-of-process `SocketActivityTrigger` background task.
- Enabling and transferring a `StreamSocket` to the system socket broker.
- Recovering an existing broker-owned socket after the client restarts.
- Receiving socket traffic in `backgroundtaskhost.exe` and displaying a notification.
- Reconnecting after the broker reports that the socket closed.
- Hosting a companion `StreamSocketListener` server that sends test messages.

## APIs featured

- [`Windows.Networking.Sockets.StreamSocket`](https://learn.microsoft.com/uwp/api/windows.networking.sockets.streamsocket)
- [`Windows.Networking.Sockets.SocketActivityInformation`](https://learn.microsoft.com/uwp/api/windows.networking.sockets.socketactivityinformation)
- [`Windows.ApplicationModel.Background.SocketActivityTrigger`](https://learn.microsoft.com/uwp/api/windows.applicationmodel.background.socketactivitytrigger)
- [`Windows.Networking.Sockets.StreamSocketListener`](https://learn.microsoft.com/uwp/api/windows.networking.sockets.streamsocketlistener)

## Learn documentation

- [Network communications in the background](https://learn.microsoft.com/windows/apps/develop/networking/network-communications-in-the-background)
- [Background task migration strategy](https://learn.microsoft.com/windows/apps/windows-app-sdk/migrate-to-windows-app-sdk/guides/background-task-migration-strategy)
- [C#/WinRT component authoring](https://learn.microsoft.com/windows/apps/develop/platform/csharp-winrt/authoring)

## Build and run

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
