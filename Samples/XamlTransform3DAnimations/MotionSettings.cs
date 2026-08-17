using Windows.UI.ViewManagement;

namespace SDKTemplate;

internal static class MotionSettings
{
    private static readonly UISettings Settings = new();

    internal static bool AnimationsEnabled => Settings.AnimationsEnabled;
}
