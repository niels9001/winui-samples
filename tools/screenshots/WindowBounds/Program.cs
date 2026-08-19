using System.ComponentModel;
using System.Diagnostics;
using System.Globalization;
using System.Runtime.InteropServices;
using System.Text.Json;

namespace WinUISamples.ScreenshotAutomation.WindowBounds;

internal static class Program
{
    private const uint SwpNoZOrder = 0x0004;
    private const uint SwpNoActivate = 0x0010;
    private const int SwRestore = 9;
    private const int SmXVirtualScreen = 76;
    private const int SmYVirtualScreen = 77;
    private const int SmCxVirtualScreen = 78;
    private const int SmCyVirtualScreen = 79;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = true,
    };

    public static int Main(string[] args)
    {
        try
        {
            _ = SetProcessDpiAwarenessContext(new IntPtr(-4));

            if (args.Length == 1 && args[0].Equals("system-info", StringComparison.OrdinalIgnoreCase))
            {
                WriteJson(GetSystemInformation());
                return 0;
            }

            if (args.Length > 0 && args[0].Equals("set-bounds", StringComparison.OrdinalIgnoreCase))
            {
                SetWindowBounds(ParseSetBoundsArguments(args[1..]));
                return 0;
            }

            throw new ArgumentException(
                "Usage: WindowBounds system-info | set-bounds --hwnd <handle> --process-id <pid> " +
                "--x <pixels> --y <pixels> --width <pixels> --height <pixels>");
        }
        catch (Exception exception)
        {
            Console.Error.WriteLine(JsonSerializer.Serialize(
                new
                {
                    error = exception.Message,
                    exceptionType = exception.GetType().Name,
                },
                JsonOptions));
            return exception is ArgumentException ? 2 : 1;
        }
    }

    private static SetBoundsOptions ParseSetBoundsArguments(string[] args)
    {
        if (args.Length % 2 != 0)
        {
            throw new ArgumentException("Every set-bounds option requires a value.");
        }

        var values = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        for (var index = 0; index < args.Length; index += 2)
        {
            if (!args[index].StartsWith("--", StringComparison.Ordinal))
            {
                throw new ArgumentException($"Unexpected argument '{args[index]}'.");
            }

            if (!values.TryAdd(args[index], args[index + 1]))
            {
                throw new ArgumentException($"Duplicate option '{args[index]}'.");
            }
        }

        var knownOptions = new[]
        {
            "--hwnd",
            "--process-id",
            "--x",
            "--y",
            "--width",
            "--height",
        };

        var unknown = values.Keys.FirstOrDefault(
            key => !knownOptions.Contains(key, StringComparer.OrdinalIgnoreCase));
        if (unknown is not null)
        {
            throw new ArgumentException($"Unknown option '{unknown}'.");
        }

        var options = new SetBoundsOptions(
            ParseWindowHandle(GetRequired(values, "--hwnd")),
            ParsePositiveInt(GetRequired(values, "--process-id"), "--process-id"),
            ParseInt(GetRequired(values, "--x"), "--x"),
            ParseInt(GetRequired(values, "--y"), "--y"),
            ParsePositiveInt(GetRequired(values, "--width"), "--width"),
            ParsePositiveInt(GetRequired(values, "--height"), "--height"));

        if (options.WindowHandle == IntPtr.Zero)
        {
            throw new ArgumentException("--hwnd must not be zero.");
        }

        return options;
    }

    private static string GetRequired(IReadOnlyDictionary<string, string> values, string name)
    {
        if (!values.TryGetValue(name, out var value) || string.IsNullOrWhiteSpace(value))
        {
            throw new ArgumentException($"{name} is required.");
        }

        return value;
    }

    private static IntPtr ParseWindowHandle(string value)
    {
        var normalized = value.StartsWith("0x", StringComparison.OrdinalIgnoreCase)
            ? value[2..]
            : value;
        var style = value.StartsWith("0x", StringComparison.OrdinalIgnoreCase)
            ? NumberStyles.AllowHexSpecifier
            : NumberStyles.Integer;

        if (!ulong.TryParse(normalized, style, CultureInfo.InvariantCulture, out var parsed) ||
            (IntPtr.Size == 4 && parsed > uint.MaxValue))
        {
            throw new ArgumentException($"Invalid HWND '{value}'.");
        }

        return unchecked((IntPtr)(long)parsed);
    }

    private static int ParseInt(string value, string name)
    {
        if (!int.TryParse(value, NumberStyles.Integer, CultureInfo.InvariantCulture, out var parsed))
        {
            throw new ArgumentException($"{name} must be a 32-bit integer.");
        }

        return parsed;
    }

    private static int ParsePositiveInt(string value, string name)
    {
        var parsed = ParseInt(value, name);
        if (parsed <= 0)
        {
            throw new ArgumentException($"{name} must be greater than zero.");
        }

        return parsed;
    }

    private static void SetWindowBounds(SetBoundsOptions options)
    {
        if (!IsWindow(options.WindowHandle))
        {
            throw new ArgumentException($"HWND {FormatHandle(options.WindowHandle)} is not a live window.");
        }

        _ = GetWindowThreadProcessId(options.WindowHandle, out var actualProcessId);
        if (actualProcessId != options.ProcessId)
        {
            throw new InvalidOperationException(
                $"HWND {FormatHandle(options.WindowHandle)} belongs to process {actualProcessId}, " +
                $"not expected process {options.ProcessId}.");
        }

        var process = Process.GetProcessById(options.ProcessId);
        if (process.HasExited)
        {
            throw new InvalidOperationException($"Process {options.ProcessId} has exited.");
        }

        var before = GetWindowGeometry(options.WindowHandle);
        if (IsIconic(options.WindowHandle))
        {
            _ = ShowWindow(options.WindowHandle, SwRestore);
        }

        if (!SetWindowPos(
                options.WindowHandle,
                IntPtr.Zero,
                options.X,
                options.Y,
                options.Width,
                options.Height,
                SwpNoZOrder | SwpNoActivate))
        {
            throw new Win32Exception(Marshal.GetLastWin32Error(), "SetWindowPos failed.");
        }

        var after = GetWindowGeometry(options.WindowHandle);
        if (after.Outer.X != options.X ||
            after.Outer.Y != options.Y ||
            after.Outer.Width != options.Width ||
            after.Outer.Height != options.Height)
        {
            throw new InvalidOperationException(
                $"Window manager applied {after.Outer.Width}x{after.Outer.Height}@({after.Outer.X},{after.Outer.Y}) " +
                $"instead of {options.Width}x{options.Height}@({options.X},{options.Y}).");
        }

        WriteJson(new
        {
            hwnd = FormatHandle(options.WindowHandle),
            processId = actualProcessId,
            processName = process.ProcessName,
            visible = IsWindowVisible(options.WindowHandle),
            dpi = GetDpiForWindow(options.WindowHandle),
            before,
            after,
        });
    }

    private static object GetSystemInformation()
    {
        var dpi = GetDpiForSystem();
        return new
        {
            dpi,
            scalePercent = Math.Round(dpi * 100d / 96d, 2),
            virtualScreen = new
            {
                x = GetSystemMetrics(SmXVirtualScreen),
                y = GetSystemMetrics(SmYVirtualScreen),
                width = GetSystemMetrics(SmCxVirtualScreen),
                height = GetSystemMetrics(SmCyVirtualScreen),
            },
        };
    }

    private static WindowGeometry GetWindowGeometry(IntPtr windowHandle)
    {
        if (!GetWindowRect(windowHandle, out var outerRectangle))
        {
            throw new Win32Exception(Marshal.GetLastWin32Error(), "GetWindowRect failed.");
        }

        if (!GetClientRect(windowHandle, out var clientRectangle))
        {
            throw new Win32Exception(Marshal.GetLastWin32Error(), "GetClientRect failed.");
        }

        var clientOrigin = new NativePoint();
        if (!ClientToScreen(windowHandle, ref clientOrigin))
        {
            throw new Win32Exception(Marshal.GetLastWin32Error(), "ClientToScreen failed.");
        }

        Rectangle? extendedFrame = null;
        var extendedRectangle = new NativeRectangle();
        if (DwmGetWindowAttribute(
                windowHandle,
                9,
                ref extendedRectangle,
                Marshal.SizeOf<NativeRectangle>()) == 0)
        {
            extendedFrame = ToRectangle(extendedRectangle);
        }

        return new WindowGeometry(
            ToRectangle(outerRectangle),
            new Rectangle(
                clientOrigin.X,
                clientOrigin.Y,
                clientRectangle.Right - clientRectangle.Left,
                clientRectangle.Bottom - clientRectangle.Top),
            extendedFrame);
    }

    private static Rectangle ToRectangle(NativeRectangle rectangle) =>
        new(
            rectangle.Left,
            rectangle.Top,
            rectangle.Right - rectangle.Left,
            rectangle.Bottom - rectangle.Top);

    private static string FormatHandle(IntPtr value) =>
        $"0x{unchecked((ulong)value.ToInt64()):X}";

    private static void WriteJson(object value) =>
        Console.WriteLine(JsonSerializer.Serialize(value, JsonOptions));

    private sealed record SetBoundsOptions(
        IntPtr WindowHandle,
        int ProcessId,
        int X,
        int Y,
        int Width,
        int Height);

    private sealed record Rectangle(int X, int Y, int Width, int Height);

    private sealed record WindowGeometry(
        Rectangle Outer,
        Rectangle Client,
        Rectangle? ExtendedFrame);

    [StructLayout(LayoutKind.Sequential)]
    private struct NativePoint
    {
        public int X;
        public int Y;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct NativeRectangle
    {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    [DllImport("user32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool IsWindow(IntPtr windowHandle);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool IsWindowVisible(IntPtr windowHandle);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool IsIconic(IntPtr windowHandle);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool ShowWindow(IntPtr windowHandle, int command);

    [DllImport("user32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GetWindowRect(IntPtr windowHandle, out NativeRectangle rectangle);

    [DllImport("user32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GetClientRect(IntPtr windowHandle, out NativeRectangle rectangle);

    [DllImport("user32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool ClientToScreen(IntPtr windowHandle, ref NativePoint point);

    [DllImport("user32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool SetWindowPos(
        IntPtr windowHandle,
        IntPtr insertAfter,
        int x,
        int y,
        int width,
        int height,
        uint flags);

    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(IntPtr windowHandle, out int processId);

    [DllImport("user32.dll")]
    private static extern uint GetDpiForWindow(IntPtr windowHandle);

    [DllImport("user32.dll")]
    private static extern uint GetDpiForSystem();

    [DllImport("user32.dll")]
    private static extern int GetSystemMetrics(int index);

    [DllImport("dwmapi.dll")]
    private static extern int DwmGetWindowAttribute(
        IntPtr windowHandle,
        int attribute,
        ref NativeRectangle value,
        int valueSize);

    [DllImport("user32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool SetProcessDpiAwarenessContext(IntPtr value);
}
