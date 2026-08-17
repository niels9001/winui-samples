using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Automation;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Media;
using Microsoft.UI.Xaml.Navigation;
using Windows.Globalization;
using Windows.Media.SpeechRecognition;
using Windows.Storage;
using Windows.UI;

namespace SDKTemplate.Scenarios;

public sealed partial class ContinuousRecognitionPage : Page
{
    private readonly StringBuilder _dictatedText = new();
    private SpeechRecognizer? _speechRecognizer;
    private ContinuousRecognitionKind _kind;
    private bool _isActive;
    private bool _isListening;
    private bool _isPopulatingLanguages;
    private bool _grammarCompiled;

    public ContinuousRecognitionPage()
    {
        InitializeComponent();
    }

    protected override async void OnNavigatedTo(NavigationEventArgs e)
    {
        _kind = e.Parameter is ContinuousRecognitionKind kind
            ? kind
            : ContinuousRecognitionKind.Dictation;
        _isActive = true;

        ConfigureScenario();

        try
        {
            MicrophoneAccessResult access = await MicrophonePermission.RequestAsync();
            if (!access.Granted)
            {
                ShowInitializationError(access.Message);
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

    protected override async void OnNavigatedFrom(NavigationEventArgs e)
    {
        _isActive = false;

        if (_speechRecognizer is not null && _isListening)
        {
            try
            {
                await _speechRecognizer.ContinuousRecognitionSession.CancelAsync();
            }
            catch (Exception exception)
            {
                MainPage.Current.NotifyOperationError(
                    "Cancel continuous recognition",
                    exception);
            }
        }

        _isListening = false;
        DisposeRecognizer();
    }

    private void ConfigureScenario()
    {
        PrivacySettingsButton.Visibility = Visibility.Collapsed;
        DictationPanel.Visibility = Visibility.Collapsed;
        ColorPreviewCanvas.Visibility = Visibility.Collapsed;
        ResultHeadingTextBlock.Visibility = Visibility.Collapsed;
        ResultTextBlock.Text = string.Empty;
        ClearButton.Visibility = Visibility.Collapsed;

        switch (_kind)
        {
            case ContinuousRecognitionKind.Dictation:
                ScenarioTitleTextBlock.Text = "Continuous Dictation";
                ScenarioDescriptionTextBlock.Text =
                    "Capture multi-sentence dictation and combine confirmed results with in-progress hypotheses.";
                RequirementsInfoBar.Message =
                    "Requires microphone access, internet connectivity, and accepted online speech privacy settings.";
                HelpTextBlock.Text =
                    "Start recognition and speak naturally. Medium- and high-confidence phrases are appended to the message.";
                DictationPanel.Visibility = Visibility.Visible;
                ClearButton.Visibility = Visibility.Visible;
                break;

            case ContinuousRecognitionKind.List:
                ScenarioTitleTextBlock.Text = "Continuous List Commands";
                ScenarioDescriptionTextBlock.Text =
                    "Listen continuously for localized command-list phrases and report each matched tag and confidence.";
                RequirementsInfoBar.Message =
                    "Requires microphone access and an installed speech language pack. This grammar can run offline.";
                break;

            case ContinuousRecognitionKind.Srgs:
                ScenarioTitleTextBlock.Text = "Continuous SRGS Commands";
                ScenarioDescriptionTextBlock.Text =
                    "Listen continuously with a packaged SRGS/GRXML grammar and apply semantic color values as commands arrive.";
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
            _kind == ContinuousRecognitionKind.Dictation
                ? SpeechRecognizer.SupportedTopicLanguages
                : SpeechRecognizer.SupportedGrammarLanguages;

        if (_kind == ContinuousRecognitionKind.List)
        {
            languages = languages.Where(language =>
                SpeechRecognitionHelpers.LocalizedGrammarLanguages.Contains(language.LanguageTag));
        }
        else if (_kind == ContinuousRecognitionKind.Srgs)
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
                case ContinuousRecognitionKind.Dictation:
                    _speechRecognizer.Constraints.Add(
                        new SpeechRecognitionTopicConstraint(
                            SpeechRecognitionScenario.Dictation,
                            "dictation"));
                    break;

                case ContinuousRecognitionKind.List:
                    SpeechRecognitionHelpers.AddLocalizedListConstraints(
                        _speechRecognizer,
                        language.LanguageTag);
                    HelpTextBlock.Text =
                        SpeechRecognitionHelpers.GetLocalizedListHelp(
                            language.LanguageTag);
                    break;

                case ContinuousRecognitionKind.Srgs:
                    StorageFile grammarFile =
                        await StorageFile.GetFileFromApplicationUriAsync(
                            new Uri(
                                $"ms-appx:///SRGS/{language.LanguageTag}/SRGSColors.xml"));
                    _speechRecognizer.Constraints.Add(
                        new SpeechRecognitionGrammarFileConstraint(
                            grammarFile,
                            "colors"));
                    _speechRecognizer.Timeouts.EndSilenceTimeout =
                        TimeSpan.FromSeconds(1.2);
                    HelpTextBlock.Text =
                        SpeechResourceProvider.GetSpeechString(
                            "SRGSHelpText",
                            language.LanguageTag);
                    break;
            }

            SpeechRecognitionCompilationResult compilation =
                await _speechRecognizer.CompileConstraintsAsync();
            if (compilation.Status != SpeechRecognitionResultStatus.Success)
            {
                ShowInitializationError(
                    $"Unable to compile the grammar: {compilation.Status}.");
                return;
            }

            _speechRecognizer.ContinuousRecognitionSession.Completed +=
                ContinuousRecognitionSession_Completed;
            _speechRecognizer.ContinuousRecognitionSession.ResultGenerated +=
                ContinuousRecognitionSession_ResultGenerated;

            if (_kind == ContinuousRecognitionKind.Dictation)
            {
                _speechRecognizer.HypothesisGenerated +=
                    SpeechRecognizer_HypothesisGenerated;
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
            ShowInitializationError(
                "The speech language pack for the selected language is not installed.");
        }
    }

    private async void StartStopButton_Click(
        object sender,
        RoutedEventArgs e)
    {
        if (_speechRecognizer is null || !_grammarCompiled)
        {
            ShowInitializationError("The speech grammar is not ready.");
            return;
        }

        StartStopButton.IsEnabled = false;
        PrivacySettingsButton.Visibility = Visibility.Collapsed;

        try
        {
            if (!_isListening)
            {
                if (_speechRecognizer.State != SpeechRecognizerState.Idle)
                {
                    MainPage.Current.NotifyUser(
                        $"The recognizer cannot start while it is {_speechRecognizer.State}.",
                        NotifyType.ErrorMessage);
                    return;
                }

                await _speechRecognizer.ContinuousRecognitionSession.StartAsync();
                _isListening = true;
            }
            else
            {
                await _speechRecognizer.ContinuousRecognitionSession.StopAsync();
                _isListening = false;

                if (_kind == ContinuousRecognitionKind.Dictation)
                {
                    DictationTextBox.Text = _dictatedText.ToString();
                }
            }

            UpdateListeningUi();
        }
        catch (Exception exception)
        {
            _isListening = false;
            UpdateListeningUi();
            HandleRecognitionException("Change continuous recognition state", exception);
        }
        finally
        {
            if (_isActive)
            {
                StartStopButton.IsEnabled = _grammarCompiled;
            }
        }
    }

    private void ContinuousRecognitionSession_Completed(
        SpeechContinuousRecognitionSession sender,
        SpeechContinuousRecognitionCompletedEventArgs args)
    {
        DispatcherQueue.TryEnqueue(() =>
        {
            if (!_isActive)
            {
                return;
            }

            _isListening = false;
            UpdateListeningUi();

            string message = args.Status == SpeechRecognitionResultStatus.Success
                ? "Continuous recognition completed."
                : $"Continuous recognition completed: {args.Status}.";
            MainPage.Current.NotifyUser(
                message,
                args.Status == SpeechRecognitionResultStatus.Success
                    ? NotifyType.StatusMessage
                    : NotifyType.ErrorMessage);
        });
    }

    private void ContinuousRecognitionSession_ResultGenerated(
        SpeechContinuousRecognitionSession sender,
        SpeechContinuousRecognitionResultGeneratedEventArgs args)
    {
        SpeechRecognitionResult result = args.Result;

        DispatcherQueue.TryEnqueue(() =>
        {
            if (!_isActive)
            {
                return;
            }

            if (_kind == ContinuousRecognitionKind.Dictation)
            {
                HandleDictationResult(result);
            }
            else if (_kind == ContinuousRecognitionKind.List)
            {
                ShowCommandResult(result);
            }
            else
            {
                if (result.Confidence is SpeechRecognitionConfidence.High
                    or SpeechRecognitionConfidence.Medium)
                {
                    ApplySrgsColors(result);
                    ShowCommandResult(result);
                }
                else
                {
                    ResultHeadingTextBlock.Visibility = Visibility.Visible;
                    ResultTextBlock.Text =
                        SpeechResourceProvider.GetSpeechString(
                            "SRGSGarbagePromptText",
                            _speechRecognizer!.CurrentLanguage.LanguageTag);
                }
            }
        });
    }

    private void SpeechRecognizer_HypothesisGenerated(
        SpeechRecognizer sender,
        SpeechRecognitionHypothesisGeneratedEventArgs args)
    {
        string hypothesis = args.Hypothesis.Text;

        DispatcherQueue.TryEnqueue(() =>
        {
            if (!_isActive)
            {
                return;
            }

            DictationTextBox.Text =
                $"{_dictatedText} {hypothesis} ...".TrimStart();
            ClearButton.IsEnabled = true;
        });
    }

    private void HandleDictationResult(SpeechRecognitionResult result)
    {
        if (result.Confidence is SpeechRecognitionConfidence.High
            or SpeechRecognitionConfidence.Medium)
        {
            _dictatedText.Append(result.Text);
            _dictatedText.Append(' ');
            DictationTextBox.Text = _dictatedText.ToString();
            DiscardedResultInfoBar.IsOpen = false;
            ClearButton.IsEnabled = true;
            return;
        }

        DictationTextBox.Text = _dictatedText.ToString();
        if (!string.IsNullOrWhiteSpace(result.Text))
        {
            string discardedText = result.Text.Length <= 40
                ? result.Text
                : $"{result.Text[..40]}...";
            DiscardedResultInfoBar.Message =
                $"'{discardedText}' ({result.Confidence})";
            DiscardedResultInfoBar.IsOpen = true;
        }
    }

    private void ShowCommandResult(SpeechRecognitionResult result)
    {
        ResultHeadingTextBlock.Visibility = Visibility.Visible;
        ResultTextBlock.Text =
            result.Confidence is SpeechRecognitionConfidence.High
                or SpeechRecognitionConfidence.Medium
                ? SpeechRecognitionHelpers.Describe(result)
                : $"Low-confidence result: {SpeechRecognitionHelpers.Describe(result)}";
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
            if (SpeechRecognitionHelpers.TryGetSemanticColor(
                    result,
                    key,
                    out Color color))
            {
                apply(color);
            }
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

    private void ClearButton_Click(object sender, RoutedEventArgs e)
    {
        _dictatedText.Clear();
        DictationTextBox.Text = string.Empty;
        DiscardedResultInfoBar.IsOpen = false;
        ClearButton.IsEnabled = false;
        StartStopButton.Focus(FocusState.Programmatic);
    }

    private async void PrivacySettingsButton_Click(
        object sender,
        RoutedEventArgs e)
    {
        bool launched = await SpeechRecognitionHelpers.OpenPrivacySettingsAsync();
        if (!launched)
        {
            ShowInitializationError(
                "Windows could not open the speech privacy settings.");
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
            MainPage.Current.NotifyUser(
                "Online speech recognition is disabled. Review the speech privacy settings to use this grammar.",
                NotifyType.ErrorMessage);
            return;
        }

        if (SpeechRecognitionHelpers.HasHResult(
                exception,
                SpeechRecognitionHelpers.RecognizerNotFound))
        {
            ShowInitializationError(
                "The speech language pack for the selected language is not installed.");
            return;
        }

        MainPage.Current.NotifyOperationError(operation, exception);
    }

    private void UpdateListeningUi()
    {
        StartStopButton.Content = _isListening
            ? "Stop continuous recognition"
            : "Start continuous recognition";
        StartStopButton.SetValue(
            AutomationProperties.NameProperty,
            StartStopButton.Content);
        LanguageComboBox.IsEnabled = !_isListening && _grammarCompiled;
    }

    private void SetControlsEnabled(bool enabled)
    {
        StartStopButton.IsEnabled = enabled;
        LanguageComboBox.IsEnabled = enabled && !_isListening;
        ClearButton.IsEnabled =
            enabled &&
            _kind == ContinuousRecognitionKind.Dictation &&
            _dictatedText.Length > 0;
    }

    private void ShowInitializationError(string message)
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

        _speechRecognizer.ContinuousRecognitionSession.Completed -=
            ContinuousRecognitionSession_Completed;
        _speechRecognizer.ContinuousRecognitionSession.ResultGenerated -=
            ContinuousRecognitionSession_ResultGenerated;
        _speechRecognizer.HypothesisGenerated -=
            SpeechRecognizer_HypothesisGenerated;
        _speechRecognizer.StateChanged -= SpeechRecognizer_StateChanged;
        _speechRecognizer.Dispose();
        _speechRecognizer = null;
    }
}
