# Reading barcodes with point-of-service scanners

The `BarcodeScanner` project was ported to WinUI 3 / Windows App SDK from the UWP
[BarcodeScanner](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/BarcodeScanner)
sample. It demonstrates how to discover, claim, configure, and read scanners through the
Windows Point of Service APIs.

## What it shows

- Receiving decoded and raw scan data.
- Handling competing claims with `ReleaseDeviceRequested` and `RetainDevice`.
- Selecting active barcode symbologies.
- Reading and updating symbology attributes.
- Controlling camera-backed scanners, including software triggers and video preview.

## APIs featured

- `Windows.Devices.PointOfService.BarcodeScanner`
- `Windows.Devices.PointOfService.ClaimedBarcodeScanner`
- `Windows.Devices.PointOfService.BarcodeSymbologyAttributes`
- `Windows.Devices.Enumeration.DeviceWatcher`
- `Windows.Media.Capture.MediaCapture`
- `Windows.Media.Playback.MediaPlayer`

## Learn docs this serves

- [Point of Service hardware support](https://learn.microsoft.com/windows/apps/develop/devices-sensors/pos/device-support)
- [BarcodeScanner class](https://learn.microsoft.com/uwp/api/windows.devices.pointofservice.barcodescanner)
- [ClaimedBarcodeScanner class](https://learn.microsoft.com/uwp/api/windows.devices.pointofservice.claimedbarcodescanner)

## Build & run

```powershell
dotnet build -c Debug -p:Platform=x64
dotnet run -c Debug -p:Platform=x64
```

The app is packaged and declares the `pointOfService` and `webcam` device capabilities.
A compatible USB, Bluetooth, or vendor-supported scanner can be used. Windows can also
expose a standard camera as a software barcode scanner on supported systems.

## Migration notes

- The UWP `CoreDispatcher` calls were replaced with `DispatcherQueue`.
- The UWP `CaptureElement` preview was replaced with a `MediaPlayerElement` backed by a
  `MediaFrameSource`.
- Scanner resources and event handlers are released whenever the active scenario changes.

## Known differences / limitations

- WinUI 3 desktop does not expose the CoreWindow-based
  `DisplayInformation.GetForCurrentView` used by the UWP sample. The embedded camera preview
  therefore keeps neutral rotation metadata and provides a manual **Flip Preview** action.
- Available scenarios depend on the connected scanner's capabilities. Full validation of
  release/retain, symbology settings, and scan data requires a compatible scanner or a
  camera-backed scanner exposed by Windows.
