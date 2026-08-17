# NfcProvisioner

Ported to WinUI 3 / Windows App SDK from the UWP
[NfcProvisioner](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/NfcProvisioner)
sample.

## What it shows

This sample selects a Windows provisioning package (`.ppkg`), divides it into messages that
fit the NFC device's maximum payload, prefixes each chunk with the provisioning protocol
header, and publishes the chunks to a nearby peer device. Cancelling stops the wait and
prevents additional chunks from being queued, but it does not stop a message that has
already been published.

## APIs featured

- `Windows.Networking.Proximity.ProximityDevice`
- `ProximityDevice.PublishBinaryMessage`
- `ProximityDevice.MaxMessageBytes`
- `Windows.Storage.Pickers.FileOpenPicker`
- `Windows.Storage.FileIO.ReadBufferAsync`
- `Windows.Storage.Streams.DataWriter`

## Learn docs this serves

- [ProximityDevice class](https://learn.microsoft.com/uwp/api/windows.networking.proximity.proximitydevice)
- [FileOpenPicker class](https://learn.microsoft.com/uwp/api/windows.storage.pickers.fileopenpicker)
- [Create a provisioning package](https://learn.microsoft.com/windows/configuration/provisioning-packages/provisioning-create-package)

## Build & run

```powershell
dotnet build -c Debug -p:Platform=x64
dotnet run -c Debug -p:Platform=x64
```

## Migration notes

The file picker is associated with the WinUI window through `InitializeWithWindow`. The
upstream `Windows.ProvPlugins.Chunk` protocol, per-message `NfcProvHeader`, payload sizing,
transmission callback, and cancellation UI are retained. The implementation does not call
`StopPublishingMessage`, so a previously published message remains active until the
proximity device is released.

The package requires the `proximity` device capability. A valid `.ppkg`, an NFC-enabled
Windows source device, and a compatible peer device in close proximity are required for a
real transfer. This documentation update does not claim NFC hardware validation.
