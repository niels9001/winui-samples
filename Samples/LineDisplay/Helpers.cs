using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Controls.Primitives;

namespace SDKTemplate;

internal static class Helpers
{
    internal static double ParseUnsignedIntegerWithFallback(
        TextBox textBox,
        double fallback)
    {
        return uint.TryParse(textBox.Text, out uint value) ? value : fallback;
    }

    internal static T GetSelectedItemTag<T>(Selector selector)
    {
        return (T)((FrameworkElement)selector.SelectedItem).Tag;
    }
}
