# Cash Drawer

This WinUI 3 sample demonstrates the claim, enable, open, status, alarm, and device-retention
features of `Windows.Devices.PointOfService.CashDrawer`.

## What the sample shows

- Discovering, claiming, enabling, and opening a cash drawer.
- Receiving drawer status updates and waiting for an open drawer to close.
- Handling competing claims with the release and retain model.

## APIs featured

- `Windows.Devices.PointOfService.CashDrawer`
- `Windows.Devices.PointOfService.ClaimedCashDrawer`
- `Windows.Devices.PointOfService.CashDrawerCloseAlarm`
- `Windows.Devices.Enumeration.DeviceInformation`

## Related documentation

- [CashDrawer class](https://learn.microsoft.com/uwp/api/windows.devices.pointofservice.cashdrawer)
- [Point of service device support](https://learn.microsoft.com/windows/uwp/devices-sensors/point-of-service)

## Build and run

From this directory:

```powershell
dotnet build -c Debug -p:Platform=x64
dotnet run -c Debug -p:Platform=x64
```

The packaged app declares the `pointOfService` device capability.

## Migration notes

- UWP `CoreDispatcher` event marshaling was replaced with `DispatcherQueue`.
- The UWP status area was replaced with the standard WinUI 3 `InfoBar`.
- Device claims and event subscriptions are released when navigating away from a scenario.

## Known differences / limitations

- A compatible point-of-service cash drawer is required to exercise drawer operations.
- Without hardware, the sample can validate discovery and reports that no drawer was found.
