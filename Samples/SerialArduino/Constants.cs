using System;
using System.Globalization;

namespace SDKTemplate;

internal static class ArduinoDevice
{
    internal const ushort VendorId = 0x2341;
    internal const ushort ProductId = 0x0043;
    internal const string DeviceInstanceIdProperty = "System.Devices.DeviceInstanceId";
}

internal static class ArduinoProtocol
{
    internal const uint BaudRate = 9600;
    internal const ushort DataBits = 8;
    internal const uint TemperatureResponseLength = 7;
    internal const int LowestLedPin = 3;
    internal const int HighestLedPin = 6;
    internal const decimal SensorErrorValue = -9.99m;
    internal const string TemperatureCommand = "temp\r";

    internal static string CreateLedCommand(int pin, bool isOn)
    {
        ArgumentOutOfRangeException.ThrowIfLessThan(pin, LowestLedPin);
        ArgumentOutOfRangeException.ThrowIfGreaterThan(pin, HighestLedPin);

        return string.Create(
            CultureInfo.InvariantCulture,
            $"{(isOn ? "ledon" : "ledoff")} {pin}\r");
    }
}
