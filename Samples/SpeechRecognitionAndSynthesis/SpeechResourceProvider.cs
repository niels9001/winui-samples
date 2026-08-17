using System;
using Microsoft.Windows.ApplicationModel.Resources;

namespace SDKTemplate;

internal static class SpeechResourceProvider
{
    private static readonly ResourceManager ResourceManager = new();

    internal static string GetSpeechString(string resourceId, string languageTag)
    {
        return GetString("LocalizationSpeechResources", resourceId, languageTag);
    }

    internal static string GetSynthesisString(string resourceId, string languageTag)
    {
        return GetString("LocalizationTTSResources", resourceId, languageTag);
    }

    private static string GetString(string mapName, string resourceId, string languageTag)
    {
        ResourceContext context = ResourceManager.CreateResourceContext();
        context.QualifierValues["Language"] = languageTag;

        ResourceMap map = ResourceManager.MainResourceMap.GetSubtree(mapName);
        ResourceCandidate candidate = map.GetValue(resourceId, context);
        string value = candidate.ValueAsString;

        if (string.IsNullOrEmpty(value))
        {
            throw new InvalidOperationException(
                $"Resource '{mapName}/{resourceId}' has no string value for '{languageTag}'.");
        }

        return value;
    }
}
