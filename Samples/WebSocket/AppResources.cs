using System.Globalization;
using Microsoft.Windows.ApplicationModel.Resources;

namespace SDKTemplate;

internal static class AppResources
{
    private static readonly ResourceLoader ResourceLoader = new();

    internal static string Get(string resourceName)
    {
        return ResourceLoader.GetString(resourceName);
    }

    internal static string Format(string resourceName, params object?[] arguments)
    {
        return string.Format(
            CultureInfo.CurrentCulture,
            Get(resourceName),
            arguments);
    }
}
