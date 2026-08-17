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

    protected override void OnNavigatedTo(NavigationEventArgs e)
    {
        foreach (Scenario scenario in Scenarios)
        {
            NavView.MenuItems.Add(new NavigationViewItem
            {
                Content = scenario.Title,
                Tag = scenario.PageType
            });
        }

        NavView.SelectedItem = NavView.MenuItems[0];
    }

    private void NavView_SelectionChanged(
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

    public void NotifyUser(string message, NotifyType type)
    {
        if (!DispatcherQueue.HasThreadAccess)
        {
            DispatcherQueue.TryEnqueue(() => NotifyUser(message, type));
            return;
        }

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

    public void NotifyOperationError(string operation, Exception exception)
    {
        NotifyUser(
            $"{operation} failed (0x{exception.HResult:X8}): {exception.Message}",
            NotifyType.ErrorMessage);
    }
}

public enum NotifyType
{
    StatusMessage,
    ErrorMessage
}
