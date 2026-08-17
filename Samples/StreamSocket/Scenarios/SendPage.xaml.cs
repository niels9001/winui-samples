using System;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Navigation;

namespace SDKTemplate.Scenarios;

public sealed partial class SendPage : Page
{
    public SendPage()
    {
        InitializeComponent();
    }

    protected override void OnNavigatedTo(NavigationEventArgs e)
    {
        UpdateState();
    }

    private async void SendButton_Click(object sender, RoutedEventArgs e)
    {
        SendButton.IsEnabled = false;

        try
        {
            await App.SocketService.SendAsync(MessageTextBox.Text);
            SendStateTextBlock.Text =
                "Message sent. The listener confirmed receipt in the status bar.";
        }
        catch (Exception exception)
        {
            MainPage.Current.NotifyOperationError(
                "Sending data",
                exception);
        }
        finally
        {
            SendButton.IsEnabled = App.SocketService.IsConnected;
        }
    }

    private void UpdateState()
    {
        SendButton.IsEnabled = App.SocketService.IsConnected;
        MessageTextBox.IsEnabled = App.SocketService.IsConnected;
        SendStateTextBlock.Text = App.SocketService.IsConnected
            ? "Client connected and ready to send."
            : "Connect the client in scenario 2 before sending.";
    }
}
