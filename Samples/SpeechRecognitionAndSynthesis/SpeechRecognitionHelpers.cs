using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Windows.Media.SpeechRecognition;
using Windows.UI;

namespace SDKTemplate;

internal static class SpeechRecognitionHelpers
{
    internal const uint PrivacyStatementDeclined = 0x80045509;
    internal const uint RecognizerNotFound = 0x8004503A;

    internal static readonly IReadOnlySet<string> LocalizedGrammarLanguages =
        new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "de-DE",
            "en-AU",
            "en-CA",
            "en-GB",
            "en-IN",
            "en-US",
            "es-ES",
            "fr-FR",
            "it-IT",
            "zh-CN",
            "zh-Hans-CN",
        };

    internal static readonly IReadOnlySet<string> SrgsLanguages =
        new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "de-DE",
            "en-AU",
            "en-CA",
            "en-GB",
            "en-IN",
            "en-US",
            "es-ES",
            "fr-FR",
            "it-IT",
            "zh-Hans-CN",
        };

    private static readonly IReadOnlyDictionary<string, Color> ColorsBySemanticValue =
        new Dictionary<string, Color>(StringComparer.Ordinal)
        {
            ["COLOR_RED"] = Microsoft.UI.Colors.Red,
            ["COLOR_BLUE"] = Microsoft.UI.Colors.Blue,
            ["COLOR_BLACK"] = Microsoft.UI.Colors.Black,
            ["COLOR_BROWN"] = Microsoft.UI.Colors.Brown,
            ["COLOR_PURPLE"] = Microsoft.UI.Colors.Purple,
            ["COLOR_GREEN"] = Microsoft.UI.Colors.Green,
            ["COLOR_YELLOW"] = Microsoft.UI.Colors.Yellow,
            ["COLOR_CYAN"] = Microsoft.UI.Colors.Cyan,
            ["COLOR_MAGENTA"] = Microsoft.UI.Colors.Magenta,
            ["COLOR_ORANGE"] = Microsoft.UI.Colors.Orange,
            ["COLOR_GRAY"] = Microsoft.UI.Colors.Gray,
            ["COLOR_WHITE"] = Microsoft.UI.Colors.White,
        };

    internal static bool HasHResult(Exception exception, uint hresult)
    {
        return unchecked((uint)exception.HResult) == hresult;
    }

    internal static string Describe(SpeechRecognitionResult result)
    {
        string tag = result.Constraint?.Tag ?? "unknown";
        return $"Heard: '{result.Text}' (Tag: '{tag}', Confidence: {result.Confidence})";
    }

    internal static void AddLocalizedListConstraints(
        SpeechRecognizer recognizer,
        string languageTag)
    {
        string Get(string id) =>
            SpeechResourceProvider.GetSpeechString(id, languageTag);

        recognizer.Constraints.Add(
            new SpeechRecognitionListConstraint(
                new[] { Get("ListGrammarGoHome") },
                "Home"));
        recognizer.Constraints.Add(
            new SpeechRecognitionListConstraint(
                new[] { Get("ListGrammarGoToContosoStudio") },
                "GoToContosoStudio"));
        recognizer.Constraints.Add(
            new SpeechRecognitionListConstraint(
                new[]
                {
                    Get("ListGrammarShowMessage"),
                    Get("ListGrammarOpenMessage"),
                },
                "Message"));
        recognizer.Constraints.Add(
            new SpeechRecognitionListConstraint(
                new[]
                {
                    Get("ListGrammarSendEmail"),
                    Get("ListGrammarCreateEmail"),
                },
                "Email"));
        recognizer.Constraints.Add(
            new SpeechRecognitionListConstraint(
                new[]
                {
                    Get("ListGrammarCallNitaFarley"),
                    Get("ListGrammarCallNita"),
                },
                "CallNita"));
        recognizer.Constraints.Add(
            new SpeechRecognitionListConstraint(
                new[]
                {
                    Get("ListGrammarCallWayneSigmon"),
                    Get("ListGrammarCallWayne"),
                },
                "CallWayne"));
    }

    internal static string GetLocalizedListHelp(string languageTag)
    {
        string Get(string id) =>
            SpeechResourceProvider.GetSpeechString(id, languageTag);

        string examples =
            $"Try saying '{Get("ListGrammarGoHome")}', " +
            $"'{Get("ListGrammarGoToContosoStudio")}', or " +
            $"'{Get("ListGrammarShowMessage")}'.";
        return $"{Get("ListGrammarHelpText")}{Environment.NewLine}{examples}";
    }

    internal static bool TryGetSemanticColor(
        SpeechRecognitionResult result,
        string semanticKey,
        out Color color)
    {
        color = default;

        if (!result.SemanticInterpretation.Properties.TryGetValue(
                semanticKey,
                out IReadOnlyList<string>? values) ||
            values.Count == 0 ||
            values[0] == "...")
        {
            return false;
        }

        color = GetColor(values[0]);
        return true;
    }

    internal static Color GetColor(string semanticValue)
    {
        if (!ColorsBySemanticValue.TryGetValue(semanticValue, out Color color))
        {
            throw new InvalidOperationException(
                $"The grammar returned the unknown color value '{semanticValue}'.");
        }

        return color;
    }

    internal static Task<bool> OpenPrivacySettingsAsync()
    {
        return Windows.System.Launcher
            .LaunchUriAsync(new Uri("ms-settings:privacy-speech"))
            .AsTask();
    }
}
