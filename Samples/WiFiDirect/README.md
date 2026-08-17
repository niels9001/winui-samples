# WiFiDirect

Ported to WinUI 3 / Windows App SDK from the UWP
[WiFiDirect](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/WiFiDirect)
sample.

## What it shows

This sample demonstrates both sides of a Wi-Fi Direct connection:

1. The advertiser publishes settings and custom information elements, accepts an
   inbound request, pairs with the peer, and listens for a TCP connection.
2. The connector discovers nearby peers, inspects their information elements,
   configures pairing, and opens a connection on demand.

After pairing, both sides exchange UTF-8 text framed with a four-byte length prefix.

## APIs featured

- `Windows.Devices.WiFiDirect.WiFiDirectAdvertisementPublisher`
- `Windows.Devices.WiFiDirect.WiFiDirectConnectionListener`
- `Windows.Devices.WiFiDirect.WiFiDirectDevice`
- `Windows.Devices.WiFiDirect.WiFiDirectConnectionParameters`
- `Windows.Devices.WiFiDirect.WiFiDirectInformationElement`
- `Windows.Devices.Enumeration.DeviceWatcher`
- `Windows.Networking.Sockets.StreamSocket`
- `Windows.Networking.Sockets.StreamSocketListener`

## Learn docs this serves

- [Enumerate devices](https://learn.microsoft.com/en-us/windows/apps/develop/devices-sensors/enumerate-devices)
- [Windows.Devices.WiFiDirect namespace](https://learn.microsoft.com/en-us/uwp/api/windows.devices.wifidirect?view=winrt-28000)
- [WiFiDirectAdvertisementPublisher class](https://learn.microsoft.com/en-us/uwp/api/windows.devices.wifidirect.wifidirectadvertisementpublisher?view=winrt-28000)
- [WiFiDirectDevice class](https://learn.microsoft.com/en-us/uwp/api/windows.devices.wifidirect.wifidirectdevice?view=winrt-28000)
- [StreamSocketListener class](https://learn.microsoft.com/en-us/uwp/api/windows.networking.sockets.streamsocketlistener?view=winrt-28000)

## Requirements

- Two nearby devices with Wi-Fi Direct-capable adapters and drivers.
- Wi-Fi enabled on both devices and permission to complete the pairing flow.
- The packaged app, or a compatible peer implementation, on the second device.
- TCP port 50001 available on the Wi-Fi Direct interface.

An empty discovery result is valid. Adapter and driver support determines which
pairing methods, custom information elements, and legacy modes are available.

## Build & run

```powershell
dotnet build -c Debug -p:Platform=x64
dotnet run -c Debug -p:Platform=x64
```

## Migration notes

The port replaces `CoreDispatcher` with `DispatcherQueue` and UWP
`MessageDialog` prompts with WinUI `ContentDialog`. Both scenarios explicitly stop
watchers, listeners, and peer connections when navigation leaves the page.

The package declares `internetClientServer`, the `proximity` device capability, and
`runFullTrust`.

## Known differences / limitations

Full discovery, pairing, and text-exchange validation requires two compatible
Wi-Fi Direct devices. Behavior varies with adapter firmware and drivers, and the
sample treats a system with no adapter or no visible peer as a supported empty
state.
