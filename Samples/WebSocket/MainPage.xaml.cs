using System.Collections.Generic;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Navigation;

namespace SDKTemplate;

/// <summary>
/// Hosts the sample scenarios and status surface.
/// </summary>
public sealed partial class MainPage : Page
{
    private bool _isInitialized;

    public MainPage()
    {
        InitializeComponent();
        Current = this;
        if (App.LoopbackServer is not null)
        {
            App.LoopbackServer.Diagnostic += OnLoopbackServerDiagnostic;
        }
    }

    public static MainPage Current { get; private set; } = null!;

    internal IReadOnlyList<Scenario> Scenarios { get; } =
    [
        new(
            AppResources.Get("ScenarioUtf8Title"),
            typeof(Utf8MessagesPage)),
        new(
            AppResources.Get("ScenarioBinaryTitle"),
            typeof(BinaryStreamPage)),
        new(
            AppResources.Get("ScenarioClientAuthenticationTitle"),
            typeof(ClientAuthenticationPage)),
        new(
            AppResources.Get("ScenarioPartialTitle"),
            typeof(PartialMessagesPage)),
    ];

    protected override void OnNavigatedTo(NavigationEventArgs e)
    {
        base.OnNavigatedTo(e);

        if (_isInitialized)
        {
            return;
        }

        _isInitialized = true;
        foreach (Scenario scenario in Scenarios)
        {
            var item = new NavigationViewItem
            {
                Content = scenario.Title,
                Tag = scenario.PageType,
            };
            Microsoft.UI.Xaml.Automation.AutomationProperties.SetName(
                item,
                scenario.Title);
            NavView.MenuItems.Add(item);
        }

        if (NavView.MenuItems.Count > 0)
        {
            NavView.SelectedItem = NavView.MenuItems[0];
        }

        if (App.StartupError is not null)
        {
            NotifyUser(
                AppResources.Format("LoopbackServerStartFailed", App.StartupError),
                NotifyType.ErrorMessage);
        }
    }

    internal Uri? TryGetUri(string candidate)
    {
        if (WebSocketUtilities.TryGetUri(candidate, out Uri? uri, out string error))
        {
            return uri;
        }

        NotifyUser(error, NotifyType.ErrorMessage);
        return null;
    }

    internal static string BuildWebSocketError(Exception exception)
    {
        return WebSocketUtilities.BuildWebSocketError(exception);
    }

    internal void NotifyUser(string message, NotifyType type)
    {
        if (DispatcherQueue.HasThreadAccess)
        {
            UpdateStatus(message, type);
            return;
        }

        DispatcherQueue.TryEnqueue(() => UpdateStatus(message, type));
    }

    private void OnNavigationSelectionChanged(
        NavigationView sender,
        NavigationViewSelectionChangedEventArgs args)
    {
        NotifyUser(string.Empty, NotifyType.StatusMessage);

        if (args.SelectedItem is NavigationViewItem item &&
            item.Tag is Type pageType)
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

        StatusInfoBar.Severity = type switch
        {
            NotifyType.ErrorMessage => InfoBarSeverity.Error,
            _ => InfoBarSeverity.Success,
        };
        StatusInfoBar.Message = message;
        StatusInfoBar.IsOpen = true;
    }

    private void OnLoopbackServerDiagnostic(object? sender, string message)
    {
        NotifyUser(
            AppResources.Format("LoopbackServerDiagnostic", message),
            NotifyType.ErrorMessage);
    }
}

internal sealed record Scenario(string Title, Type PageType);

internal enum NotifyType
{
    StatusMessage,
    ErrorMessage,
}
