using System;
using Microsoft.UI.Xaml.Automation;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Navigation;

namespace SDKTemplate;

public sealed partial class MainPage : Page
{
    internal static MainPage Current { get; private set; } = null!;

    public MainPage()
    {
        InitializeComponent();
        Current = this;
    }

    protected override void OnNavigatedTo(NavigationEventArgs e)
    {
        base.OnNavigatedTo(e);

        if (NavView.MenuItems.Count == 0)
        {
            int index = 1;
            foreach (Scenario scenario in _scenarios)
            {
                string title = Strings.Format("NavigationItemFormat", index++, scenario.Title);
                var item = new NavigationViewItem
                {
                    Content = title,
                    Tag = scenario,
                };

                AutomationProperties.SetName(item, title);
                AutomationProperties.SetAutomationId(item, scenario.AutomationId);
                NavView.MenuItems.Add(item);
            }
        }

        if (NavView.MenuItems.Count > 0)
        {
            NavView.SelectedItem = NavView.MenuItems[0];
        }
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
            Strings.Format(
                "OperationFailedFormat",
                operation,
                exception.HResult,
                exception.Message),
            NotifyType.ErrorMessage);
    }

    internal void NotifyPlaybackFailure(PlaybackFailedEventArgs args)
    {
        NotifyUser(
            Strings.Format(
                "PlaybackFailedFormat",
                args.Error,
                args.HResult,
                args.Message),
            NotifyType.ErrorMessage);
    }

    private void NavView_SelectionChanged(
        NavigationView sender,
        NavigationViewSelectionChangedEventArgs args)
    {
        NotifyUser(string.Empty, NotifyType.StatusMessage);

        if (args.SelectedItem is NavigationViewItem item && item.Tag is Scenario scenario)
        {
            try
            {
                ScenarioFrame.Navigate(scenario.ClassType);
            }
            catch (Exception ex)
            {
                NotifyOperationError(Strings.Get("OpeningScenarioOperation"), ex);
            }
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
            : InfoBarSeverity.Success;
        StatusInfoBar.Message = message;
        StatusInfoBar.IsOpen = true;
    }
}

internal enum NotifyType
{
    StatusMessage,
    ErrorMessage,
}
