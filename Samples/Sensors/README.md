# Sensors

This WinUI 3 / Windows App SDK project consolidates 15 UWP sensor samples:
[Accelerometer](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/Accelerometer),
[ActivitySensor](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/ActivitySensor),
[Altimeter](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/Altimeter),
[Barometer](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/Barometer),
[Compass](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/Compass),
[Gyrometer](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/Gyrometer),
[Inclinometer](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/Inclinometer),
[LightSensor](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/LightSensor),
[Magnetometer](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/Magnetometer),
[OrientationSensor](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/OrientationSensor),
[Pedometer](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/Pedometer),
[PresenceSensor](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/PresenceSensor),
[ProximitySensor](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/ProximitySensor),
[RelativeInclinometer](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/RelativeInclinometer),
and
[SimpleOrientationSensor](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/SimpleOrientationSensor).

## What it shows

The sample contains 42 foreground scenarios across 15 feature groups. It demonstrates
runtime sensor discovery, event subscriptions, polling, batching, calibration,
history, protected device access, and device selection.

## Scenarios

- **Accelerometer:** choose standard, linear, or gravity readings; data events; shake
  events; polling; and batched events.
- **Gyrometer:** data events, polling, and a cross-platform porting pattern.
- **Inclinometer:** data events, polling, and a simulated calibration-state preview.
- **Relative inclinometer:** data events and polling from a relative reference.
- **Orientation sensor:** choose absolute or relative readings; data events; polling;
  and a simulated calibration-state preview.
- **Simple orientation sensor:** data events and polling for coarse device
  orientation.
- **Compass:** data events, polling, and a simulated calibration-state preview.
- **Magnetometer:** data events and polling.
- **Altimeter:** data events and polling.
- **Barometer:** data events and polling.
- **Light sensor:** ambient-light data events and polling.
- **Presence sensor:** data events, polling, and selecting a sensor by identifier.
- **Activity sensor:** current activity, history, and activity-change events.
- **Pedometer:** step events, history, and current step counts.
- **Proximity sensor:** data events, polling, and display on/off control.

## APIs featured

- `Windows.Devices.Sensors.Accelerometer`
- `Windows.Devices.Sensors.Gyrometer`
- `Windows.Devices.Sensors.Inclinometer`
- `Windows.Devices.Sensors.OrientationSensor`
- `Windows.Devices.Sensors.SimpleOrientationSensor`
- `Windows.Devices.Sensors.Compass`
- `Windows.Devices.Sensors.Magnetometer`
- `Windows.Devices.Sensors.Altimeter`
- `Windows.Devices.Sensors.Barometer`
- `Windows.Devices.Sensors.LightSensor`
- `Windows.Devices.Sensors.HumanPresenceSensor`
- `Windows.Devices.Sensors.ActivitySensor`
- `Windows.Devices.Sensors.Pedometer`
- `Windows.Devices.Sensors.ProximitySensor`
- `Windows.Devices.Enumeration.DeviceAccessInformation`

## Requirements

- Sensor availability is runtime-optional. Each scenario requires the corresponding
  physical or platform sensor and reports when it is unavailable.
- The manifest declares the `activity` and `humanPresence` device capabilities for
  protected activity, pedometer, and presence data.
- The manifest allows build 17763, but `HumanPresenceSensor` is available starting
  with Windows build 22621. The three presence scenarios require 22621 or later and
  are not guarded on older systems.
- Reading types, batching, calibration, history, and report intervals vary by sensor
  hardware. The sample does not claim that every feature exists on every device.

## Learn docs this serves

- [Sensors for Windows apps](https://learn.microsoft.com/windows/uwp/devices-sensors/sensors)
- [Accelerometer API reference](https://learn.microsoft.com/uwp/api/windows.devices.sensors.accelerometer)
- [HumanPresenceSensor API reference](https://learn.microsoft.com/uwp/api/windows.devices.sensors.humanpresencesensor)
- [ActivitySensor API reference](https://learn.microsoft.com/uwp/api/windows.devices.sensors.activitysensor)
- [Pedometer API reference](https://learn.microsoft.com/uwp/api/windows.devices.sensors.pedometer)

## Build & run

```powershell
dotnet build -c Debug -p:Platform=x64
dotnet run -c Debug -p:Platform=x64
```

## Migration notes

The related UWP samples are presented through one NavigationView shell. Sensor event
handlers use the WinUI `DispatcherQueue` when UI-thread marshaling is required.

Four UWP-only or background scenarios were not carried into this foreground desktop
sample:

- Accelerometer orientation-change handling was dropped because the
  `DisplayInformation` current-view path is not available.
- The ActivitySensor background scenario was deferred.
- The Pedometer background-task scenario was deferred.
- The ProximitySensor background scenario was deferred.

## Known differences / limitations

- All readings, calibration states, history, batching behavior, and access results
  depend on the current sensor hardware and Windows environment.
- The three calibration pages simulate accuracy choices for their calibration-bar UI;
  they do not connect to a live sensor.
- A page that reports no sensor is a valid unsupported-hardware state.
- Background sensor activation is not implemented by this sample.
- No successful hardware coverage is claimed for sensor types that were not present
  during validation.
