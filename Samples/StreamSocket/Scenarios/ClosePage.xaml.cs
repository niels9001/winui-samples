using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Navigation;

namespace SDKTemplate.Scenarios;

public sealed partial class ClosePage : Page
{
    public ClosePage()
    {
        InitializeComponent();
    }

    protected override void OnNavigatedTo(NavigationEventArgs e)
    {
        UpdateState();
    }

    private void CloseButton_Click(object sender, RoutedEventArgs e)
    {
        App.SocketService.CloseAll();
        UpdateState();
    }

    private void UpdateState()
    {
        bool hasResources =
            App.SocketService.IsConnected ||
            App.SocketService.IsListening;
        CloseButton.IsEnabled = hasResources;
        SocketStateTextBlock.Text =
            $"Client: {(App.SocketService.IsConnected ? "connected" : "closed")}\n" +
            $"Listener: {(App.SocketService.IsListening ? "active" : "closed")}";
    }
}
