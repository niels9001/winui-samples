# SerialArduino

Ported to WinUI 3 / Windows App SDK from the UWP
[SerialArduino](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/SerialArduino)
sample.

## What it shows

This sample discovers and connects to a specific Arduino Uno over USB serial. It
controls four LEDs and reads a one-wire temperature sensor through the included
firmware protocol.

## Scenarios

1. **Connect/Disconnect** - Watch for an Arduino Uno with USB VID `2341` and PID
   `0043`, list matching devices, and explicitly connect or disconnect.
2. **LED & Temperature Control** - Send on/off commands to LEDs on pins 3 through 6
   and read a fixed-format temperature response from the sensor on pin 2.

The app-owned `SerialArduinoService` keeps the connection alive when navigating
between the two scenarios and closes it on explicit disconnect, device removal,
failed I/O, or window shutdown.

## APIs featured

- `Windows.Devices.SerialCommunication.SerialDevice`
- `Windows.Devices.Enumeration.DeviceInformation`
- `Windows.Devices.Enumeration.DeviceWatcher`
- `Windows.Storage.Streams.DataWriter`
- `Windows.Storage.Streams.DataReader`
- `Microsoft.UI.Dispatching.DispatcherQueue`

## Hardware and firmware requirements

- Arduino Uno with USB VID `2341` and PID `0043`; other Arduino models are not
  included by the package capability or device selector.
- A data-capable USB cable.
- The included [`sketch/SerialCommand.ino`](sketch/SerialCommand.ino) firmware,
  built with the SerialCommand, DallasTemperature, and OneWire Arduino libraries.
- DS18S20 or DS18B20 one-wire temperature sensor on digital pin 2 with a 4.7 kOhm
  pull-up resistor to 5 V.
- LEDs on digital pins 3, 4, 5, and 6, each connected to ground through a 220 ohm
  resistor.
- The included [`sketch/SerialCommand.fzz`](sketch/SerialCommand.fzz) Fritzing file
  documents the wiring.

The serial port is configured for 9600 baud, eight data bits, no parity, one stop
bit, and no handshake.

## Firmware protocol

- `ledon <pin>\r` and `ledoff <pin>\r` control pins 3 through 6.
- `temp\r` requests a response that the desktop service expects to contain five ASCII
  characters plus carriage return and line feed.
- Positive firmware output is limited to values through `99.99` degrees Celsius.
  `-9.99` indicates a sensor fault.

## Learn docs this serves

- [SerialDevice API reference](https://learn.microsoft.com/uwp/api/windows.devices.serialcommunication.serialdevice)
- [Enumerate devices](https://learn.microsoft.com/windows/uwp/devices-sensors/enumerate-devices)
- [Map UWP features to the Windows App SDK](https://learn.microsoft.com/windows/apps/windows-app-sdk/migrate-to-windows-app-sdk/feature-mapping-table)

## Build & run

```powershell
dotnet build -c Debug -p:Platform=x64
dotnet run -c Debug -p:Platform=x64
```

## Migration notes

The original UWP suspension/resumption singleton was replaced with an app-owned
desktop service. Device-watcher callbacks are marshaled through `DispatcherQueue`,
serial operations are serialized, and connection and I/O operations use cancellation
and timeouts.

## Known differences / limitations

- Only the declared Arduino Uno VID/PID is supported.
- A removed board is not reopened automatically; reconnect manually after it returns.
- The firmware does not expose current LED state, so the app cannot restore switch
  positions after reconnection.
- The temperature format and range are fixed by the included firmware.
- At exactly `0.00` degrees Celsius, the firmware emits `0.00` without the leading
  zero, while the desktop service requires seven response bytes. That valid reading
  is therefore rejected by the current parser.
- The sample builds and runs without hardware and shows an empty discovery state, but
  this documentation does not claim a successful Arduino hardware validation.
