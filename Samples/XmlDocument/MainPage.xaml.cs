using System;
using Microsoft.UI.Xaml.Automation;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Navigation;

namespace SDKTemplate;

public sealed partial class MainPage : Page
{
    private bool _navigationInitialized;

    internal static MainPage? Current { get; private set; }

    public MainPage()
    {
        InitializeComponent();
        Current = this;
    }

    protected override void OnNavigatedTo(NavigationEventArgs e)
    {
        base.OnNavigatedTo(e);

        if (_navigationInitialized)
        {
            return;
        }

        foreach (ScenarioDefinition scenario in Scenarios)
        {
            string title = AppResources.GetString(scenario.TitleResourceKey);
            var item = new NavigationViewItem
            {
                Content = title,
                Tag = scenario.PageType,
            };

            AutomationProperties.SetAutomationId(item, scenario.AutomationId);
            AutomationProperties.SetName(item, title);
            NavView.MenuItems.Add(item);
        }

        _navigationInitialized = true;
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

internal enum NotifyType
{
    StatusMessage,
    ErrorMessage,
}
