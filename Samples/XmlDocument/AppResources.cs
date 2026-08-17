using Microsoft.Windows.ApplicationModel.Resources;

namespace SDKTemplate;

internal static class AppResources
{
    private static readonly ResourceLoader ResourceLoader = new();

    internal static string GetString(string resourceName)
    {
        return ResourceLoader.GetString(resourceName);
    }
}
