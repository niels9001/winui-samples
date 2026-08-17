# Serial Arduino

Ported to WinUI 3 / Windows App SDK from the UWP
[Serial Arduino](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/SerialArduino)
sample.

## What it shows

This sample discovers a supported Arduino Uno, opens and closes a shared serial
connection, independently controls four LEDs, and reads a temperature sensor.
The connection remains available while navigating between the two scenarios.

## APIs featured

- `Windows.Devices.SerialCommunication.SerialDevice`
- `Windows.Devices.Enumeration.DeviceWatcher`
- `Windows.Storage.Streams.DataReader` and `DataWriter`
- `Microsoft.UI.Dispatching.DispatcherQueue`
- `Microsoft.UI.Xaml.Controls.NavigationView` and `InfoBar`

## Learn docs this serves

- [SerialDevice class](https://learn.microsoft.com/uwp/api/windows.devices.serialcommunication.serialdevice)
- [Enumerate devices](https://learn.microsoft.com/windows/uwp/devices-sensors/enumerate-devices)
- [Mapping UWP features to the Windows App SDK](https://learn.microsoft.com/windows/apps/windows-app-sdk/migrate-to-windows-app-sdk/feature-mapping-table)

## Hardware and firmware

The included `sketch\SerialCommand.ino` requires an Arduino Uno and the
SerialCommand, DallasTemperature, and OneWire Arduino libraries. Open the sketch
in the Arduino IDE, install those libraries, then compile and upload it before
running the app. The original `sketch\SerialCommand.fzz` wiring diagram can be
opened with Fritzing.

Wire the circuit represented by that diagram:

- Connect a DS18S20/DS18B20-compatible one-wire temperature sensor data lead to
  digital pin 2, power it from 5 V and ground, and add a 4.7 kΩ pull-up between
  data and 5 V.
- Connect four LED anodes to digital pins 3, 4, 5, and 6. Connect each cathode
  to ground through its own 220 Ω resistor.

Confirm the pinout for the exact temperature-sensor package before applying
power.

## Supported device and protocol

The package capability and device watcher are scoped to USB VID `2341` and PID
`0043` (the Arduino Uno used by the original sample). The serial port is
configured for 9600 baud, 8 data bits, no parity, one stop bit, and no handshake.

The firmware protocol is preserved exactly:

- `ledon 3\r` through `ledon 6\r`
- `ledoff 3\r` through `ledoff 6\r`
- `temp\r`

The temperature reply is five ASCII characters followed by `\r\n` (seven bytes
total). Valid readings are `00.00` through `99.99`; `-9.99` is the firmware's
sensor-error value.

## Build & run

```powershell
dotnet build -c Debug -p:Platform=x64
dotnet run -c Debug -p:Platform=x64
```

## Migration notes

The UWP suspension/resumption singleton was replaced by an app-owned desktop
service. It owns device discovery and the serial handle, marshals watcher events
through `DispatcherQueue`, serializes all serial I/O, and applies cancellation
and timeouts. The connection closes on explicit disconnect, device removal,
failed I/O, or window shutdown. It is not closed merely because the user
navigates to another scenario.

## No-hardware validation

The project can be built and the UI can be reviewed without an Arduino. The
first scenario then completes discovery with an instructional empty state, and
the LED and temperature controls remain disabled. Actual connect, write, read,
removal, and firmware behavior require the wired board.

## Known differences / limitations

- The app supports only devices matching VID `2341` and PID `0043`.
- A removed board is not reopened automatically; reconnect it and explicitly
  choose **Connect** again.
- The firmware does not expose LED state, so the app cannot query or restore
  switch positions after reconnecting.
- Temperature reads are limited to the firmware's `00.00`–`99.99` °C range.
