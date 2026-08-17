# PowerGrid

Ported to WinUI 3 / Windows App SDK from the UWP
[PowerGrid](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/PowerGrid)
sample.

## What it shows

This sample queries the power grid forecast exposed by Windows. It can search for the
lowest-severity time in a requested window or display every returned forecast block.

## Scenarios

1. **Find best time** - Search a configurable number of hours and optionally require
   `IsLowUserExperienceImpact` while choosing the lowest severity. The implementation
   treats a severity at or below `1.0` as a good time.
2. **Display full forecast** - List each block's time, duration, severity, and
   low-user-experience-impact value.

## APIs featured

- `Windows.Devices.Power.PowerGridForecast`
- `Windows.Devices.Power.PowerGridData`
- `Windows.Globalization.DateTimeFormatting.DateTimeFormatter`

## Requirements

No special hardware, account, or manifest capability beyond the packaged desktop app
is declared. The manifest allows build 17763, but `PowerGridForecast` is available
starting with Windows build 26100, so the scenarios require Windows 11, version 24H2,
or later. Meaningful result states also depend on `GetForecast()` returning data in
the current environment.

## Learn docs this serves

- [PowerGridForecast API reference](https://learn.microsoft.com/uwp/api/windows.devices.power.powergridforecast)
- [PowerGridData API reference](https://learn.microsoft.com/uwp/api/windows.devices.power.powergriddata)

## Build & run

```powershell
dotnet build -c Debug -p:Platform=x64
dotnet run -c Debug -p:Platform=x64
```

## Migration notes

The forecast APIs carry over directly to the WinUI 3 desktop app. The scenarios use
the shared NavigationView and InfoBar shell.

## Known differences / limitations

- The code does not state where forecast data originates or claim a network,
  subscription, region, or caching model.
- The code has no runtime guard for `PowerGridForecast` on systems older than build
  26100 even though the package manifest permits installation there.
- An empty forecast is handled as a valid unavailable-data state.
- The scenarios refresh only when their buttons are invoked; they do not update the
  displayed results from `ForecastUpdated`.
- No successful forecast retrieval is claimed for environments where data was not
  available.
