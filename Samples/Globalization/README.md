# Globalization

Ported to WinUI 3 / Windows App SDK from the UWP
[GlobalizationPreferences](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/GlobalizationPreferences),
[JapanesePhoneticAnalysis](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/JapanesePhoneticAnalysis),
[LanguageFont](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/LanguageFont),
[NumberFormatting](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/NumberFormatting),
[TextSegmentation](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/TextSegmentation),
[TextSuggestion](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/TextSuggestion),
and
[Unicode](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/Unicode)
samples.

## What it shows

This consolidated sample demonstrates number formatting and parsing, Unicode tokenization,
text segmentation and suggestions, Japanese phonetic analysis,
language-appropriate fonts, and the user's globalization preferences.

## APIs featured

- `Windows.Globalization.Language` and `Windows.Globalization.GeographicRegion`
- `Windows.Globalization.JapanesePhoneticAnalyzer`
- `Windows.Globalization.Fonts.LanguageFontGroup`
- `Windows.Globalization.NumberFormatting`
- `Windows.Data.Text`
- `Windows.System.UserProfile.GlobalizationPreferences`

## Learn docs this serves

- [Globalize your app](https://learn.microsoft.com/windows/apps/design/globalizing/globalizing-portal)
- [Windows.Globalization namespace](https://learn.microsoft.com/uwp/api/windows.globalization)
- [GlobalizationPreferences class](https://learn.microsoft.com/uwp/api/windows.system.userprofile.globalizationpreferences)

## Requirements

The sample requires Windows 10 version 1809 (10.0.17763.0) or later and declares
`runFullTrust`. It does not require external hardware, network access, or account services.
Results depend on installed language resources and the user's language, region, currency,
calendar, clock, font, and input settings.

## Build & run

```powershell
dotnet build -c Debug -p:Platform=x64
dotnet run -c Debug -p:Platform=x64
```

## Migration notes

The related UWP samples are combined into feature groups within one WinUI 3 app. Their
Windows globalization APIs remain available to packaged desktop apps. The UWP sample shell
was replaced with a `NavigationView` and `InfoBar`; no feature-specific limitations are
known.

## Known differences / limitations

No feature group was intentionally removed. Locale-sensitive output naturally varies with
the Windows settings and language resources installed on the capture machine.
