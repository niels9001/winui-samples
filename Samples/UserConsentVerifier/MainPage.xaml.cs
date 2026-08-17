using System;
using System.Collections.Generic;
using System.Linq;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Navigation;
using SDKTemplate.Scenarios;

namespace SDKTemplate;

public sealed partial class MainPage : Page
{
    private static readonly IReadOnlyDictionary<string, Type> Scenarios =
        new Dictionary<string, Type>
        {
            ["availability"] = typeof(AvailabilityPage),
            ["verification"] = typeof(VerificationPage),
        };

    internal static MainPage Current { get; private set; } = null!;

    public MainPage()
    {
        InitializeComponent();
        Current = this;
    }

    protected override void OnNavigatedTo(NavigationEventArgs e)
    {
        NavView.SelectedItem = NavView.MenuItems
            .OfType<NavigationViewItem>()
            .First();
    }

    internal void NotifyUser(string message, InfoBarSeverity severity)
    {
        StatusInfoBar.Message = message;
        StatusInfoBar.Severity = severity;
        StatusInfoBar.IsOpen = true;
    }

    internal void NotifyOperationError(
        string operation,
        Exception exception)
    {
        NotifyUser(
            $"{operation} failed (0x{exception.HResult:X8}): {exception.Message}",
            InfoBarSeverity.Error);
    }

    private void NavView_SelectionChanged(
        NavigationView sender,
        NavigationViewSelectionChangedEventArgs args)
    {
        StatusInfoBar.IsOpen = false;

        if (args.SelectedItem is NavigationViewItem { Tag: string tag } &&
            Scenarios.TryGetValue(tag, out Type? pageType))
        {
            ScenarioFrame.Navigate(pageType);
        }
    }
}
