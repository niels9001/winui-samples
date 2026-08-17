using System;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Navigation;

namespace SDKTemplate.Scenarios;

public sealed partial class ConnectPage : Page
{
    public ConnectPage()
    {
        InitializeComponent();
    }

    protected override void OnNavigatedTo(NavigationEventArgs e)
    {
        if (App.SocketService.ServerAddress is string serverAddress)
        {
            HostNameTextBox.Text = serverAddress;
        }

        if (App.SocketService.ListenerServiceName is string serviceName)
        {
            ServiceNameTextBox.Text = serviceName;
        }

        AdapterTextBlock.Text =
            App.SocketService.SelectedAdapter is { } adapter
                ? $"Traffic will use adapter {adapter.NetworkAdapterId}."
                : "No client adapter restriction is active.";
        UpdateState();
    }

    private async void ConnectButton_Click(
        object sender,
        RoutedEventArgs e)
    {
        ConnectButton.IsEnabled = false;

        try
        {
            await App.SocketService.ConnectAsync(
                HostNameTextBox.Text.Trim(),
                ServiceNameTextBox.Text.Trim());
        }
        catch (Exception exception)
        {
            MainPage.Current.NotifyOperationError(
                "Connecting the client",
                exception);
        }
        finally
        {
            UpdateState();
        }
    }

    private void UpdateState()
    {
        bool isConnected = App.SocketService.IsConnected;
        ConnectButton.IsEnabled = !isConnected;
        HostNameTextBox.IsEnabled = !isConnected;
        ServiceNameTextBox.IsEnabled = !isConnected;
        ConnectionStateTextBlock.Text = isConnected
            ? "Client connected. Continue to scenario 3."
            : "Client not connected.";
    }
}
