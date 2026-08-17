using System;
using System.Linq;
using System.Net;
using System.Text.RegularExpressions;

namespace SDKTemplate;

internal static partial class HtmlToTextConverter
{
    private static readonly Regex ScriptAndStyleRegex = new(
        @"<(script|style)\b[^>]*>.*?</\1>",
        RegexOptions.IgnoreCase |
        RegexOptions.Singleline |
        RegexOptions.CultureInvariant);

    private static readonly Regex ListItemRegex = new(
        @"<li\b[^>]*>",
        RegexOptions.IgnoreCase |
        RegexOptions.CultureInvariant);

    private static readonly Regex BlockElementRegex = new(
        @"</?(?:p|div|h[1-6]|ul|ol|blockquote|table|tr)\b[^>]*>|<br\s*/?>",
        RegexOptions.IgnoreCase |
        RegexOptions.CultureInvariant);

    private static readonly Regex TagRegex = new(
        @"<[^>]+>",
        RegexOptions.CultureInvariant);

    private static readonly Regex HorizontalWhitespaceRegex = new(
        @"[ \t\f\v]+",
        RegexOptions.CultureInvariant);

    internal static string Convert(string markup)
    {
        if (string.IsNullOrWhiteSpace(markup))
        {
            return "(item has no content)";
        }

        string text = ScriptAndStyleRegex.Replace(markup, string.Empty);
        text = ListItemRegex.Replace(text, "\n- ");
        text = BlockElementRegex.Replace(text, "\n");
        text = TagRegex.Replace(text, string.Empty);
        text = WebUtility.HtmlDecode(text);
        text = text
            .Replace("\r\n", "\n", StringComparison.Ordinal)
            .Replace('\r', '\n');
        text = HorizontalWhitespaceRegex.Replace(text, " ");

        string[] lines = text
            .Split('\n')
            .Select(line => line.Trim())
            .ToArray();
        return string.Join(
            "\n",
            CollapseBlankLines(lines)).Trim();
    }

    private static IEnumerable<string> CollapseBlankLines(
        IEnumerable<string> lines)
    {
        bool previousWasBlank = false;

        foreach (string line in lines)
        {
            bool isBlank = line.Length == 0;
            if (!isBlank || !previousWasBlank)
            {
                yield return line;
            }

            previousWasBlank = isBlank;
        }
    }
}
