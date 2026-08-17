using System;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Navigation;

namespace SDKTemplate.Scenarios;

public sealed partial class StartListenerPage : Page
{
    public StartListenerPage()
    {
        InitializeComponent();
        LocalHostsComboBox.ItemsSource = App.SocketService.GetLocalHosts();
        if (LocalHostsComboBox.Items.Count > 0)
        {
            LocalHostsComboBox.SelectedIndex = 0;
        }
    }

    protected override void OnNavigatedTo(NavigationEventArgs e)
    {
        UpdateState();
    }

    private async void StartListenerButton_Click(
        object sender,
        RoutedEventArgs e)
    {
        StartListenerButton.IsEnabled = false;

        try
        {
            ListenerBindMode bindMode =
                (ListenerBindMode)BindModeRadioButtons.SelectedIndex;
            LocalHostItem? selectedHost =
                bindMode == ListenerBindMode.AnyAddress
                    ? null
                    : LocalHostsComboBox.SelectedItem as LocalHostItem;

            await App.SocketService.StartListenerAsync(
                ServiceNameTextBox.Text.Trim(),
                bindMode,
                selectedHost);
        }
        catch (Exception exception)
        {
            MainPage.Current.NotifyOperationError(
                "Starting the listener",
                exception);
        }
        finally
        {
            UpdateState();
        }
    }

    private void BindModeRadioButtons_SelectionChanged(
        object sender,
        SelectionChangedEventArgs e)
    {
        if (LocalHostsComboBox is null)
        {
            return;
        }

        LocalHostsComboBox.IsEnabled =
            BindModeRadioButtons.SelectedIndex !=
            (int)ListenerBindMode.AnyAddress;
        LocalHostsComboBox.Header =
            BindModeRadioButtons.SelectedIndex ==
            (int)ListenerBindMode.Adapter
                ? "Local address and network adapter"
                : "Local address";
    }

    private void UpdateState()
    {
        bool isListening = App.SocketService.IsListening;
        StartListenerButton.IsEnabled = !isListening;
        ServiceNameTextBox.IsEnabled = !isListening;
        BindModeRadioButtons.IsEnabled = !isListening;
        LocalHostsComboBox.IsEnabled =
            !isListening &&
            BindModeRadioButtons.SelectedIndex !=
            (int)ListenerBindMode.AnyAddress;
        ListenerStateTextBlock.Text = isListening
            ? $"Listener active on TCP port {App.SocketService.ListenerServiceName}."
            : "Listener not started.";
    }
}
