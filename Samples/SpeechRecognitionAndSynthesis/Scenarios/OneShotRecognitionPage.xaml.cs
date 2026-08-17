using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Media;
using Microsoft.UI.Xaml.Navigation;
using Windows.Foundation;
using Windows.Globalization;
using Windows.Media.SpeechRecognition;
using Windows.Storage;
using Windows.UI;

namespace SDKTemplate.Scenarios;

public sealed partial class OneShotRecognitionPage : Page
{
    private SpeechRecognizer? _speechRecognizer;
    private IAsyncOperation<SpeechRecognitionResult>? _recognitionOperation;
    private OneShotRecognitionKind _kind;
    private bool _isActive;
    private bool _isPopulatingLanguages;
    private bool _grammarCompiled;

    public OneShotRecognitionPage()
    {
        InitializeComponent();
    }

    protected override async void OnNavigatedTo(NavigationEventArgs e)
    {
        _kind = e.Parameter is OneShotRecognitionKind kind
            ? kind
            : OneShotRecognitionKind.Dictation;
        _isActive = true;

        ConfigureScenario();

        try
        {
            MicrophoneAccessResult access = await MicrophonePermission.RequestAsync();
            if (!access.Granted)
            {
                ShowError(access.Message);
                LanguageComboBox.IsEnabled = false;
                return;
            }

            Language language = PopulateLanguages();
            await InitializeRecognizerAsync(language);
        }
        catch (Exception exception)
        {
            HandleRecognitionException("Initialize speech recognition", exception);
        }
    }

    protected override void OnNavigatedFrom(NavigationEventArgs e)
    {
        _isActive = false;
        _recognitionOperation?.Cancel();
        _recognitionOperation = null;
        DisposeRecognizer();
    }

    private void ConfigureScenario()
    {
        ColorPreviewCanvas.Visibility = Visibility.Collapsed;
        PrivacySettingsButton.Visibility = Visibility.Collapsed;
        ResultHeadingTextBlock.Visibility = Visibility.Collapsed;
        ResultTextBlock.Text = string.Empty;

        switch (_kind)
        {
            case OneShotRecognitionKind.Dictation:
                ScenarioTitleTextBlock.Text = "Predefined Dictation Grammar";
                ScenarioDescriptionTextBlock.Text =
                    "Use a predefined topic constraint optimized for a short dictated phrase or sentence.";
                RequirementsInfoBar.Message =
                    "Requires microphone access, internet connectivity, and accepted online speech privacy settings.";
                HelpTextBlock.Text =
                    "Choose a language, select a recognition button, and dictate a short message.";
                break;

            case OneShotRecognitionKind.WebSearch:
                ScenarioTitleTextBlock.Text = "Predefined WebSearch Grammar";
                ScenarioDescriptionTextBlock.Text =
                    "Use a predefined topic constraint optimized for a spoken web-search query.";
                RequirementsInfoBar.Message =
                    "Requires microphone access, internet connectivity, and accepted online speech privacy settings.";
                HelpTextBlock.Text =
                    "Choose a language, select a recognition button, and say a query such as 'weather in London'.";
                break;

            case OneShotRecognitionKind.List:
                ScenarioTitleTextBlock.Text = "Custom List Constraint";
                ScenarioDescriptionTextBlock.Text =
                    "Build localized command lists, group alternate phrases under tags, and inspect the matched tag and confidence.";
                RequirementsInfoBar.Message =
                    "Requires microphone access and an installed speech language pack. This grammar can run offline.";
                break;

            case OneShotRecognitionKind.Srgs:
                ScenarioTitleTextBlock.Text = "Custom SRGS Constraint";
                ScenarioDescriptionTextBlock.Text =
                    "Compile a packaged SRGS/GRXML grammar and use semantic properties to change the preview colors.";
                RequirementsInfoBar.Message =
                    "Requires microphone access and an installed speech language pack. This grammar can run offline.";
                HelpTextBlock.Text =
                    "Try saying 'blue background, red border, green circle'.";
                ColorPreviewCanvas.Visibility = Visibility.Visible;
                break;
        }
    }

    private Language PopulateLanguages()
    {
        _isPopulatingLanguages = true;
        LanguageComboBox.Items.Clear();

        IEnumerable<Language> languages =
            _kind is OneShotRecognitionKind.Dictation or OneShotRecognitionKind.WebSearch
                ? SpeechRecognizer.SupportedTopicLanguages
                : SpeechRecognizer.SupportedGrammarLanguages;

        if (_kind == OneShotRecognitionKind.List)
        {
            languages = languages.Where(language =>
                SpeechRecognitionHelpers.LocalizedGrammarLanguages.Contains(language.LanguageTag));
        }
        else if (_kind == OneShotRecognitionKind.Srgs)
        {
            languages = languages.Where(language =>
                SpeechRecognitionHelpers.SrgsLanguages.Contains(language.LanguageTag));
        }

        List<Language> availableLanguages = languages
            .OrderBy(language => language.DisplayName)
            .ToList();

        if (availableLanguages.Count == 0)
        {
            _isPopulatingLanguages = false;
            throw new InvalidOperationException(
                "No installed speech language supports this scenario.");
        }

        Language systemLanguage = SpeechRecognizer.SystemSpeechLanguage;
        Language selectedLanguage =
            availableLanguages.FirstOrDefault(language =>
                string.Equals(
                    language.LanguageTag,
                    systemLanguage.LanguageTag,
                    StringComparison.OrdinalIgnoreCase))
            ?? availableLanguages.FirstOrDefault(language =>
                string.Equals(
                    language.LanguageTag,
                    "en-US",
                    StringComparison.OrdinalIgnoreCase))
            ?? availableLanguages[0];

        foreach (Language language in availableLanguages)
        {
            var item = new ComboBoxItem
            {
                Content = language.DisplayName,
                Tag = language,
            };

            LanguageComboBox.Items.Add(item);
            if (language.LanguageTag == selectedLanguage.LanguageTag)
            {
                LanguageComboBox.SelectedItem = item;
            }
        }

        _isPopulatingLanguages = false;
        return selectedLanguage;
    }

    private async void LanguageComboBox_SelectionChanged(
        object sender,
        SelectionChangedEventArgs e)
    {
        if (_isPopulatingLanguages ||
            LanguageComboBox.SelectedItem is not ComboBoxItem { Tag: Language language } ||
            _speechRecognizer?.CurrentLanguage.LanguageTag == language.LanguageTag)
        {
            return;
        }

        SetControlsEnabled(false);

        try
        {
            await InitializeRecognizerAsync(language);
        }
        catch (Exception exception)
        {
            HandleRecognitionException("Change recognition language", exception);
        }
    }

    private async Task InitializeRecognizerAsync(Language language)
    {
        DisposeRecognizer();
        _grammarCompiled = false;

        try
        {
            _speechRecognizer = new SpeechRecognizer(language);
            _speechRecognizer.StateChanged += SpeechRecognizer_StateChanged;

            switch (_kind)
            {
                case OneShotRecognitionKind.Dictation:
                    _speechRecognizer.Constraints.Add(
                        new SpeechRecognitionTopicConstraint(
                            SpeechRecognitionScenario.Dictation,
                            "dictation"));
                    _speechRecognizer.UIOptions.AudiblePrompt =
                        "Dictate a phrase or sentence.";
                    _speechRecognizer.UIOptions.ExampleText =
                        SpeechResourceProvider.GetSpeechString(
                            "DictationUIOptionsExampleText",
                            language.LanguageTag);
                    break;

                case OneShotRecognitionKind.WebSearch:
                    _speechRecognizer.Constraints.Add(
                        new SpeechRecognitionTopicConstraint(
                            SpeechRecognitionScenario.WebSearch,
                            "webSearch"));
                    _speechRecognizer.UIOptions.AudiblePrompt =
                        "Say what you want to search for.";
                    _speechRecognizer.UIOptions.ExampleText =
                        SpeechResourceProvider.GetSpeechString(
                            "WebSearchUIOptionsExampleText",
                            language.LanguageTag);
                    break;

                case OneShotRecognitionKind.List:
                    AddListConstraints(_speechRecognizer, language.LanguageTag);
                    break;

                case OneShotRecognitionKind.Srgs:
                    StorageFile grammarFile =
                        await StorageFile.GetFileFromApplicationUriAsync(
                            new Uri(
                                $"ms-appx:///SRGS/{language.LanguageTag}/SRGSColors.xml"));
                    _speechRecognizer.Constraints.Add(
                        new SpeechRecognitionGrammarFileConstraint(grammarFile, "colors"));
                    _speechRecognizer.UIOptions.ExampleText =
                        SpeechResourceProvider.GetSpeechString(
                            "SRGSUIOptionsExampleText",
                            language.LanguageTag);
                    _speechRecognizer.Timeouts.EndSilenceTimeout =
                        TimeSpan.FromSeconds(1.2);
                    break;
            }

            SpeechRecognitionCompilationResult compilation =
                await _speechRecognizer.CompileConstraintsAsync();
            if (compilation.Status != SpeechRecognitionResultStatus.Success)
            {
                ShowError($"Unable to compile the grammar: {compilation.Status}.");
                return;
            }

            _grammarCompiled = true;
            SetControlsEnabled(true);
            MainPage.Current.NotifyUser(
                $"Ready for {language.DisplayName} speech.",
                NotifyType.StatusMessage);
        }
        catch (Exception exception) when (
            SpeechRecognitionHelpers.HasHResult(
                exception,
                SpeechRecognitionHelpers.RecognizerNotFound))
        {
            ShowError(
                "The speech language pack for the selected language is not installed.");
        }
    }

    private void AddListConstraints(
        SpeechRecognizer recognizer,
        string languageTag)
    {
        SpeechRecognitionHelpers.AddLocalizedListConstraints(
            recognizer,
            languageTag);
        HelpTextBlock.Text =
            SpeechRecognitionHelpers.GetLocalizedListHelp(languageTag);
        _speechRecognizer!.UIOptions.ExampleText = HelpTextBlock.Text;
    }

    private async void RecognizeWithUiButton_Click(
        object sender,
        RoutedEventArgs e)
    {
        await RecognizeAsync(useSystemUi: true);
    }

    private async void RecognizeWithoutUiButton_Click(
        object sender,
        RoutedEventArgs e)
    {
        await RecognizeAsync(useSystemUi: false);
    }

    private async Task RecognizeAsync(bool useSystemUi)
    {
        if (_speechRecognizer is null || !_grammarCompiled)
        {
            ShowError("The speech grammar is not ready.");
            return;
        }

        SetControlsEnabled(false);
        PrivacySettingsButton.Visibility = Visibility.Collapsed;
        ResultHeadingTextBlock.Visibility = Visibility.Collapsed;
        ResultTextBlock.Text = useSystemUi
            ? "Waiting for the Windows speech recognition experience..."
            : "Listening...";

        try
        {
            _recognitionOperation = useSystemUi
                ? _speechRecognizer.RecognizeWithUIAsync()
                : _speechRecognizer.RecognizeAsync();
            SpeechRecognitionResult result = await _recognitionOperation;

            ResultHeadingTextBlock.Visibility = Visibility.Visible;
            if (result.Status != SpeechRecognitionResultStatus.Success)
            {
                ResultTextBlock.Text =
                    $"Speech recognition failed: {result.Status}.";
                return;
            }

            if (_kind == OneShotRecognitionKind.Srgs)
            {
                ApplySrgsColors(result);
                ResultTextBlock.Text = SpeechRecognitionHelpers.Describe(result);
            }
            else if (_kind == OneShotRecognitionKind.List)
            {
                ResultTextBlock.Text = SpeechRecognitionHelpers.Describe(result);
            }
            else
            {
                ResultTextBlock.Text = result.Text;
            }
        }
        catch (TaskCanceledException) when (!_isActive)
        {
        }
        catch (Exception exception)
        {
            HandleRecognitionException("Recognize speech", exception);
        }
        finally
        {
            _recognitionOperation = null;
            if (_isActive)
            {
                SetControlsEnabled(_grammarCompiled);
            }
        }
    }

    private void ApplySrgsColors(SpeechRecognitionResult result)
    {
        ApplyColor("KEY_BACKGROUND", color =>
            ColorPreviewRectangle.Fill = new SolidColorBrush(color));
        ApplyColor("KEY_BORDER", color =>
            ColorPreviewRectangle.Stroke = new SolidColorBrush(color));
        ApplyColor("KEY_CIRCLE", color =>
            ColorPreviewCircle.Fill = new SolidColorBrush(color));

        void ApplyColor(string key, Action<Color> apply)
        {
            if (!SpeechRecognitionHelpers.TryGetSemanticColor(
                    result,
                    key,
                    out Color color))
            {
                return;
            }

            apply(color);
        }
    }

    private void SpeechRecognizer_StateChanged(
        SpeechRecognizer sender,
        SpeechRecognizerStateChangedEventArgs args)
    {
        MainPage.Current.NotifyUser(
            $"Speech recognizer state: {args.State}",
            NotifyType.StatusMessage);
    }

    private async void PrivacySettingsButton_Click(
        object sender,
        RoutedEventArgs e)
    {
        bool launched = await SpeechRecognitionHelpers.OpenPrivacySettingsAsync();
        if (!launched)
        {
            ShowError("Windows could not open the speech privacy settings.");
        }
    }

    private void HandleRecognitionException(
        string operation,
        Exception exception)
    {
        if (SpeechRecognitionHelpers.HasHResult(
                exception,
                SpeechRecognitionHelpers.PrivacyStatementDeclined))
        {
            PrivacySettingsButton.Visibility = Visibility.Visible;
            ShowError(
                "Online speech recognition is disabled. Review the speech privacy settings to use this grammar.");
            return;
        }

        if (SpeechRecognitionHelpers.HasHResult(
                exception,
                SpeechRecognitionHelpers.RecognizerNotFound))
        {
            ShowError(
                "The speech language pack for the selected language is not installed.");
            return;
        }

        MainPage.Current.NotifyOperationError(operation, exception);
        ResultHeadingTextBlock.Visibility = Visibility.Visible;
        ResultTextBlock.Text =
            $"{operation} failed (0x{exception.HResult:X8}): {exception.Message}";
    }

    private void SetControlsEnabled(bool enabled)
    {
        RecognizeWithUiButton.IsEnabled = enabled;
        RecognizeWithoutUiButton.IsEnabled = enabled;
        LanguageComboBox.IsEnabled = enabled;
    }

    private void ShowError(string message)
    {
        _grammarCompiled = false;
        SetControlsEnabled(false);
        ResultHeadingTextBlock.Visibility = Visibility.Visible;
        ResultTextBlock.Text = message;
        MainPage.Current.NotifyUser(message, NotifyType.ErrorMessage);
    }

    private void DisposeRecognizer()
    {
        if (_speechRecognizer is null)
        {
            return;
        }

        _speechRecognizer.StateChanged -= SpeechRecognizer_StateChanged;
        _speechRecognizer.Dispose();
        _speechRecognizer = null;
    }
}
