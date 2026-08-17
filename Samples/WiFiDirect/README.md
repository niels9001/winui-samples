# WiFiDirect

Ported to WinUI 3 / Windows App SDK from the UWP
[WiFiDirect](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/WiFiDirect)
sample.

## What it shows

The sample retains both upstream C# scenarios:

1. **Advertiser** publishes a Wi-Fi Direct advertisement, accepts an incoming
   connection request, configures pairing and optional legacy group-owner mode,
   listens on a TCP socket, and exchanges text with the peer.
2. **Connector** discovers nearby Wi-Fi Direct devices, displays their information
   elements, pairs and connects when explicitly requested, opens a TCP socket, and
   exchanges text with the advertiser.

## APIs featured

- `Windows.Devices.WiFiDirect` (`WiFiDirectAdvertisementPublisher`,
  `WiFiDirectConnectionListener`, `WiFiDirectDevice`,
  `WiFiDirectConnectionParameters`, and `WiFiDirectInformationElement`)
- `Windows.Devices.Enumeration` (`DeviceWatcher` and custom device pairing)
- `Windows.Networking.Sockets` (`StreamSocket` and `StreamSocketListener`)
- `Microsoft.UI.Dispatching.DispatcherQueue`
- `Microsoft.UI.Xaml.Controls.ContentDialog`

## Learn docs this serves

- [Windows.Devices.WiFiDirect namespace](https://learn.microsoft.com/uwp/api/windows.devices.wifidirect)
- [Device enumeration and pairing](https://learn.microsoft.com/windows/uwp/devices-sensors/enumerate-devices)
- [StreamSocket class](https://learn.microsoft.com/uwp/api/windows.networking.sockets.streamsocket)

## Hardware and pairing prerequisites

- Two PCs, or one PC and another peer device, with Wi-Fi chipsets and drivers that
  support Wi-Fi Direct.
- Wi-Fi enabled on both devices and both devices within radio range.
- This sample installed and running with package identity on each Windows PC.
- Permission to complete the Windows pairing/consent flow. PIN entry depends on the
  configuration method selected by the devices.
- TCP port `50001` available to the sample on the Wi-Fi Direct interface.

Discovering zero peers is a valid result and does not indicate that the app failed.
Advertising, pairing, connecting, unpairing, and network changes occur only after a
user invokes the corresponding control.

## Build & run

```powershell
dotnet build -c Debug -p:Platform=x64
dotnet run -c Debug -p:Platform=x64
```

## Manual validation

1. Launch the sample on two compatible devices.
2. On the first device, open **Advertiser** and select **Start advertisement**.
3. On the second device, open **Connector**, select **Start watcher**, and wait for
   enumeration to complete.
4. Select the first device and choose **Connect**. Accept the request and complete
   any pairing ceremony on both devices.
5. Confirm that each device lists the connection, then send a text message in both
   directions.
6. Close the connection, stop discovery/advertising, navigate between scenarios,
   and verify that no stale watcher, listener, or connection remains.

## Migration notes

- The UWP shell is replaced by the repository-standard Mica window, WinUI
  `TitleBar`, `NavigationView`, and `InfoBar`.
- UWP `CoreDispatcher` work is marshalled with `DispatcherQueue`.
- UWP `MessageDialog` prompts are WinUI `ContentDialog` instances owned by the
  active window's `XamlRoot`.
- Watchers, publishers, socket listeners, sockets, Wi-Fi Direct devices, and event
  subscriptions are stopped or detached when the scenario is left.
- The package declares only `runFullTrust`, `internetClientServer`, and `proximity`,
  which are required by the packaged desktop app and retained networking scenarios.

## Known differences / limitations

- Full discovery, pairing, connection, and bidirectional messaging validation
  requires compatible Wi-Fi Direct hardware and a second peer device.
- Automated smoke testing intentionally covers only launch and safe discovery or
  no-device behavior; it does not pair, connect, unpair, or alter network
  configuration.
- Driver support determines which listen states, pairing methods, legacy
  group-owner settings, and information elements are available.
