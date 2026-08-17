using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Navigation;
using SDKTemplate.Scenarios;

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
        if (ScenarioFrame.CurrentSourcePageType != typeof(PdfRenderPage))
        {
            ScenarioFrame.Navigate(typeof(PdfRenderPage));
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
