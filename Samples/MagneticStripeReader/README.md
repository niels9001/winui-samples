# Magnetic stripe reader

Ported to WinUI 3 / Windows App SDK from the UWP
[MagneticStripeReader](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/MagneticStripeReader)
sample.

## What it shows

This sample discovers, claims, and enables a point-of-service magnetic stripe reader. It
handles decoded bank-card and AAMVA motor-vehicle-card data and retains the device when
another application requests its claim.

## APIs featured

- `Windows.Devices.PointOfService.MagneticStripeReader`
- `Windows.Devices.PointOfService.ClaimedMagneticStripeReader`
- `Windows.Devices.PointOfService.MagneticStripeReaderBankCardDataReceivedEventArgs`
- `Windows.Devices.PointOfService.MagneticStripeReaderAamvaCardDataReceivedEventArgs`
- `Windows.Devices.Enumeration.DeviceInformation`

## Learn docs this serves

- [MagneticStripeReader class](https://learn.microsoft.com/uwp/api/windows.devices.pointofservice.magneticstripereader)
- [ClaimedMagneticStripeReader class](https://learn.microsoft.com/uwp/api/windows.devices.pointofservice.claimedmagneticstripereader)
- [Windows.Devices.PointOfService namespace](https://learn.microsoft.com/uwp/api/windows.devices.pointofservice)

## Build & run

```powershell
dotnet build -c Debug -p:Platform=x64
dotnet run -c Debug -p:Platform=x64
```

## Migration notes

Both upstream scenarios are retained. UWP `CoreDispatcher` event marshalling was replaced
with `DispatcherQueue`, and claimed-reader event handlers and device objects are released
when a scenario ends or navigation changes.

The package retains the `pointOfService` device capability. A compatible magnetic stripe
reader is required to receive card data; without one, either scenario reports that no reader
was found.
