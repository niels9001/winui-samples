using System;
using System.Globalization;
using Microsoft.Windows.ApplicationModel.Resources;

namespace SDKTemplate;

internal static class Strings
{
    private static readonly ResourceLoader Loader = new();

    internal static string Get(string resourceId)
    {
        return Loader.GetString(resourceId);
    }

    internal static string Format(string resourceId, params object[] arguments)
    {
        return string.Format(CultureInfo.CurrentCulture, Get(resourceId), arguments);
    }

    internal static string FormatPlaybackTime(TimeSpan value)
    {
        string format = value.TotalHours >= 1
            ? @"h\:mm\:ss\.f"
            : @"m\:ss\.f";
        return value.ToString(format, CultureInfo.CurrentCulture);
    }
}
