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
            ["start-listener"] = typeof(StartListenerPage),
            ["connect"] = typeof(ConnectPage),
            ["send"] = typeof(SendPage),
            ["close"] = typeof(ClosePage),
            ["certificates"] = typeof(CertificatesPage),
        };

    internal static MainPage Current { get; private set; } = null!;

    public MainPage()
    {
        InitializeComponent();
        Current = this;
        App.SocketService.StatusChanged += SocketService_StatusChanged;
    }

    protected override void OnNavigatedTo(NavigationEventArgs e)
    {
        NavView.SelectedItem = NavView.MenuItems
            .OfType<NavigationViewItem>()
            .First();
    }

    protected override void OnNavigatedFrom(NavigationEventArgs e)
    {
        App.SocketService.StatusChanged -= SocketService_StatusChanged;
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

    private void SocketService_StatusChanged(
        object? sender,
        SocketStatusEventArgs e)
    {
        NotifyUser(e.Message, e.Type);
    }

    private void NavView_SelectionChanged(
        NavigationView sender,
        NavigationViewSelectionChangedEventArgs args)
    {
        NotifyUser(string.Empty, NotifyType.StatusMessage);

        if (args.SelectedItem is NavigationViewItem { Tag: string tag } &&
            Scenarios.TryGetValue(tag, out Type? pageType))
        {
            ScenarioFrame.Navigate(pageType);
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

internal enum NotifyType
{
    StatusMessage,
    ErrorMessage,
}
