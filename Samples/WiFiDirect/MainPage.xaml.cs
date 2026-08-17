using System;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Navigation;

namespace SDKTemplate;

public sealed partial class MainPage : Page
{
    public static MainPage Current { get; private set; } = null!;

    public MainPage()
    {
        InitializeComponent();
        Current = this;
    }

    public void NotifyUser(string message, NotifyType type)
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

    protected override void OnNavigatedTo(NavigationEventArgs e)
    {
        NavView.MenuItems.Clear();
        int index = 1;
        foreach (Scenario scenario in Scenarios)
        {
            NavView.MenuItems.Add(new NavigationViewItem
            {
                Content = $"{index++}) {scenario.Title}",
                Tag = scenario.ClassType,
            });
        }

        if (NavView.MenuItems.Count > 0)
        {
            NavView.SelectedItem = NavView.MenuItems[0];
        }

        base.OnNavigatedTo(e);
    }

    private void NavView_SelectionChanged(
        NavigationView sender,
        NavigationViewSelectionChangedEventArgs args)
    {
        NotifyUser(string.Empty, NotifyType.StatusMessage);

        if (args.SelectedItem is NavigationViewItem item && item.Tag is Type scenarioType)
        {
            ScenarioFrame.Navigate(scenarioType);
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

public enum NotifyType
{
    StatusMessage,
    ErrorMessage,
}
