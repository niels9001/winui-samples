using System;
using System.Diagnostics;
using System.Threading.Tasks;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Automation;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Navigation;
using Windows.Media.SpeechRecognition;

namespace SDKTemplate.Scenarios;

public sealed partial class PauseGrammarPage : Page
{
    private SpeechRecognizer? _speechRecognizer;
    private SpeechRecognitionListConstraint? _emailConstraint;
    private SpeechRecognitionListConstraint? _phoneConstraint;
    private bool _isActive;
    private bool _isListening;
    private bool _grammarCompiled;
    private bool _emailEnabled = true;
    private bool _phoneEnabled;

    public PauseGrammarPage()
    {
        InitializeComponent();
    }

    protected override async void OnNavigatedTo(NavigationEventArgs e)
    {
        _isActive = true;

        try
        {
            MicrophoneAccessResult access = await MicrophonePermission.RequestAsync();
            if (!access.Granted)
            {
                ShowError(access.Message);
                return;
            }

            await InitializeRecognizerAsync();
        }
        catch (Exception exception)
        {
            HandleException("Initialize speech recognition", exception);
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

    private async Task InitializeRecognizerAsync()
    {
        DisposeRecognizer();
        _grammarCompiled = false;
        _emailEnabled = true;
        _phoneEnabled = false;

        try
        {
            _speechRecognizer = new SpeechRecognizer();
            _speechRecognizer.StateChanged += SpeechRecognizer_StateChanged;

            var homeConstraint = new SpeechRecognitionListConstraint(
                new[] { "Go home" },
                "home");
            _emailConstraint = new SpeechRecognitionListConstraint(
                new[] { "Send email" },
                "email");
            _phoneConstraint = new SpeechRecognitionListConstraint(
                new[] { "Call phone" },
                "phone");

            _speechRecognizer.Constraints.Add(homeConstraint);
            _speechRecognizer.Constraints.Add(_emailConstraint);

            SpeechRecognitionCompilationResult compilation =
                await _speechRecognizer.CompileConstraintsAsync();
            if (compilation.Status != SpeechRecognitionResultStatus.Success)
            {
                ShowError($"Unable to compile the grammar: {compilation.Status}.");
                return;
            }

            _speechRecognizer.ContinuousRecognitionSession.Completed +=
                ContinuousRecognitionSession_Completed;
            _speechRecognizer.ContinuousRecognitionSession.ResultGenerated +=
                ContinuousRecognitionSession_ResultGenerated;

            _grammarCompiled = true;
            UpdateGrammarUi();
            StartStopButton.IsEnabled = true;
            MainPage.Current.NotifyUser(
                "The command grammar is ready.",
                NotifyType.StatusMessage);
        }
        catch (Exception exception) when (
            SpeechRecognitionHelpers.HasHResult(
                exception,
                SpeechRecognitionHelpers.RecognizerNotFound))
        {
            ShowError(
                "The speech language pack for the system speech language is not installed.");
        }
    }

    private async void StartStopButton_Click(
        object sender,
        RoutedEventArgs e)
    {
        if (_speechRecognizer is null || !_grammarCompiled)
        {
            ShowError("The speech grammar is not ready.");
            return;
        }

        SetButtonsEnabled(false);

        try
        {
            if (!_isListening)
            {
                if (_speechRecognizer.State != SpeechRecognizerState.Idle)
                {
                    ShowError(
                        $"The recognizer cannot start while it is {_speechRecognizer.State}.");
                    return;
                }

                await _speechRecognizer.ContinuousRecognitionSession.StartAsync();
                _isListening = true;
                ListeningForPanel.Visibility = Visibility.Visible;
            }
            else
            {
                await _speechRecognizer.ContinuousRecognitionSession.StopAsync();
                _isListening = false;
                ListeningForPanel.Visibility = Visibility.Collapsed;
            }
        }
        catch (Exception exception)
        {
            _isListening = false;
            ListeningForPanel.Visibility = Visibility.Collapsed;
            HandleException("Change continuous recognition state", exception);
        }
        finally
        {
            UpdateListeningUi();
        }
    }

    private async void EmailGrammarButton_Click(
        object sender,
        RoutedEventArgs e)
    {
        await ToggleConstraintAsync(isEmailConstraint: true);
    }

    private async void PhoneGrammarButton_Click(
        object sender,
        RoutedEventArgs e)
    {
        await ToggleConstraintAsync(isEmailConstraint: false);
    }

    private async Task ToggleConstraintAsync(bool isEmailConstraint)
    {
        if (_speechRecognizer is null ||
            _emailConstraint is null ||
            _phoneConstraint is null ||
            !_isListening)
        {
            ShowError("Start continuous recognition before changing the grammar.");
            return;
        }

        SetButtonsEnabled(false);
        var stopwatch = Stopwatch.StartNew();
        SpeechRecognitionListConstraint constraint =
            isEmailConstraint ? _emailConstraint : _phoneConstraint;
        bool wasEnabled = isEmailConstraint ? _emailEnabled : _phoneEnabled;

        try
        {
            await _speechRecognizer.ContinuousRecognitionSession.PauseAsync();

            if (wasEnabled)
            {
                _speechRecognizer.Constraints.Remove(constraint);
            }
            else
            {
                _speechRecognizer.Constraints.Add(constraint);
            }

            SpeechRecognitionCompilationResult compilation =
                await _speechRecognizer.CompileConstraintsAsync();
            if (compilation.Status != SpeechRecognitionResultStatus.Success)
            {
                if (wasEnabled)
                {
                    _speechRecognizer.Constraints.Add(constraint);
                }
                else
                {
                    _speechRecognizer.Constraints.Remove(constraint);
                }

                await _speechRecognizer.CompileConstraintsAsync();
                await _speechRecognizer.ContinuousRecognitionSession.CancelAsync();
                _isListening = false;
                ShowError(
                    $"Unable to compile the updated grammar: {compilation.Status}.");
                return;
            }

            if (isEmailConstraint)
            {
                _emailEnabled = !wasEnabled;
            }
            else
            {
                _phoneEnabled = !wasEnabled;
            }

            _speechRecognizer.ContinuousRecognitionSession.Resume();
            stopwatch.Stop();
            TimingTextBlock.Text =
                $"Grammar update took {stopwatch.ElapsedMilliseconds} ms.";
            UpdateGrammarUi();
        }
        catch (Exception exception)
        {
            HandleException("Update the active grammar", exception);
        }
        finally
        {
            UpdateListeningUi();
        }
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

            ResultHeadingTextBlock.Visibility = Visibility.Visible;
            ResultTextBlock.Text =
                result.Confidence is SpeechRecognitionConfidence.High
                    or SpeechRecognitionConfidence.Medium
                    ? SpeechRecognitionHelpers.Describe(result)
                    : $"Low-confidence result: {SpeechRecognitionHelpers.Describe(result)}";
        });
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
            ListeningForPanel.Visibility = Visibility.Collapsed;
            UpdateListeningUi();

            MainPage.Current.NotifyUser(
                $"Continuous recognition completed: {args.Status}.",
                args.Status == SpeechRecognitionResultStatus.Success
                    ? NotifyType.StatusMessage
                    : NotifyType.ErrorMessage);
        });
    }

    private void SpeechRecognizer_StateChanged(
        SpeechRecognizer sender,
        SpeechRecognizerStateChangedEventArgs args)
    {
        MainPage.Current.NotifyUser(
            $"Speech recognizer state: {args.State}",
            NotifyType.StatusMessage);
    }

    private void UpdateListeningUi()
    {
        if (!_isActive)
        {
            return;
        }

        StartStopButton.Content = _isListening
            ? "Stop continuous recognition"
            : "Start continuous recognition";
        StartStopButton.SetValue(
            AutomationProperties.NameProperty,
            StartStopButton.Content);
        SetButtonsEnabled(_grammarCompiled);
    }

    private void UpdateGrammarUi()
    {
        EmailGrammarButton.Content = _emailEnabled
            ? "Remove 'email' grammar"
            : "Add 'email' grammar";
        PhoneGrammarButton.Content = _phoneEnabled
            ? "Remove 'phone' grammar"
            : "Add 'phone' grammar";
        EmailGrammarTextBlock.Visibility =
            _emailEnabled ? Visibility.Visible : Visibility.Collapsed;
        PhoneGrammarTextBlock.Visibility =
            _phoneEnabled ? Visibility.Visible : Visibility.Collapsed;
    }

    private void SetButtonsEnabled(bool enabled)
    {
        StartStopButton.IsEnabled = enabled;
        EmailGrammarButton.IsEnabled = enabled && _isListening;
        PhoneGrammarButton.IsEnabled = enabled && _isListening;
    }

    private void HandleException(string operation, Exception exception)
    {
        if (SpeechRecognitionHelpers.HasHResult(
                exception,
                SpeechRecognitionHelpers.RecognizerNotFound))
        {
            ShowError(
                "The speech language pack for the system speech language is not installed.");
            return;
        }

        MainPage.Current.NotifyOperationError(operation, exception);
        ResultHeadingTextBlock.Visibility = Visibility.Visible;
        ResultTextBlock.Text =
            $"{operation} failed (0x{exception.HResult:X8}): {exception.Message}";
    }

    private void ShowError(string message)
    {
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
        _speechRecognizer.StateChanged -= SpeechRecognizer_StateChanged;
        _speechRecognizer.Dispose();
        _speechRecognizer = null;
    }
}
