using System;
using System.Collections.Generic;
using System.Linq;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Navigation;
using SDKTemplate.Scenarios;

namespace SDKTemplate;

public sealed partial class MainPage : Page
{
    private static readonly IReadOnlyDictionary<string, Scenario> Scenarios =
        new Dictionary<string, Scenario>
        {
            ["synthesize-text"] = new(typeof(SynthesisPage), SynthesisKind.Text),
            ["synthesize-boundaries"] = new(typeof(SynthesisPage), SynthesisKind.Boundaries),
            ["synthesize-ssml"] = new(typeof(SynthesisPage), SynthesisKind.Ssml),
            ["one-shot-dictation"] = new(typeof(OneShotRecognitionPage), OneShotRecognitionKind.Dictation),
            ["one-shot-web-search"] = new(typeof(OneShotRecognitionPage), OneShotRecognitionKind.WebSearch),
            ["one-shot-list"] = new(typeof(OneShotRecognitionPage), OneShotRecognitionKind.List),
            ["one-shot-srgs"] = new(typeof(OneShotRecognitionPage), OneShotRecognitionKind.Srgs),
            ["continuous-dictation"] = new(typeof(ContinuousRecognitionPage), ContinuousRecognitionKind.Dictation),
            ["continuous-list"] = new(typeof(ContinuousRecognitionPage), ContinuousRecognitionKind.List),
            ["continuous-srgs"] = new(typeof(ContinuousRecognitionPage), ContinuousRecognitionKind.Srgs),
            ["pause-grammar"] = new(typeof(PauseGrammarPage), null),
        };

    internal static MainPage Current { get; private set; } = null!;

    public MainPage()
    {
        InitializeComponent();
        Current = this;
    }

    protected override void OnNavigatedTo(NavigationEventArgs e)
    {
        NavigationViewItem firstScenario = NavView.MenuItems
            .OfType<NavigationViewItem>()
            .First();
        NavView.SelectedItem = firstScenario;
    }

    internal void NotifyUser(string message, NotifyType type)
    {
        if (DispatcherQueue.HasThreadAccess)
        {
            UpdateStatus(message, type);
        }
        else
        {
            DispatcherQueue.TryEnqueue(() => UpdateStatus(message, type));
        }
    }

    internal void NotifyOperationError(string operation, Exception exception)
    {
        NotifyUser(
            $"{operation} failed (0x{exception.HResult:X8}): {exception.Message}",
            NotifyType.ErrorMessage);
    }

    private void NavView_SelectionChanged(
        NavigationView sender,
        NavigationViewSelectionChangedEventArgs args)
    {
        NotifyUser(string.Empty, NotifyType.StatusMessage);

        if (args.SelectedItem is NavigationViewItem { Tag: string tag } &&
            Scenarios.TryGetValue(tag, out Scenario? scenario))
        {
            ScenarioFrame.Navigate(scenario.PageType, scenario.Parameter);
        }
    }

    private void UpdateStatus(string message, NotifyType type)
    {
        if (string.IsNullOrEmpty(message))
        {
            StatusInfoBar.IsOpen = false;
            StatusInfoBar.Message = string.Empty;
            return;
        }

        StatusInfoBar.Severity = type == NotifyType.ErrorMessage
            ? InfoBarSeverity.Error
            : InfoBarSeverity.Informational;
        StatusInfoBar.Message = message;
        StatusInfoBar.IsOpen = true;
    }
}

internal sealed record Scenario(Type PageType, object? Parameter);

internal enum NotifyType
{
    StatusMessage,
    ErrorMessage,
}
