using System;
using Microsoft.UI.Xaml.Automation;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Navigation;

namespace SDKTemplate;

public sealed partial class MainPage : Page
{
    internal static MainPage Current { get; private set; } = null!;

    public MainPage()
    {
        InitializeComponent();
        Current = this;
    }

    internal SerialArduinoService SerialService => App.SerialService;

    protected override void OnNavigatedTo(NavigationEventArgs e)
    {
        SerialService.ConnectionChanged += SerialService_ConnectionChanged;
        SerialService.OperationFailed += SerialService_OperationFailed;

        if (NavView.MenuItems.Count == 0)
        {
            int index = 1;
            foreach (Scenario scenario in _scenarios)
            {
                string title = Strings.Format("NavigationItemFormat", index++, scenario.Title);
                var item = new NavigationViewItem
                {
                    Content = title,
                    Tag = scenario.ClassType,
                };

                AutomationProperties.SetName(item, title);
                AutomationProperties.SetAutomationId(item, scenario.AutomationId);
                NavView.MenuItems.Add(item);
            }
        }

        if (NavView.MenuItems.Count > 0)
        {
            NavView.SelectedItem = NavView.MenuItems[0];
        }

        SerialService.StartDiscovery();
    }

    protected override void OnNavigatedFrom(NavigationEventArgs e)
    {
        SerialService.ConnectionChanged -= SerialService_ConnectionChanged;
        SerialService.OperationFailed -= SerialService_OperationFailed;
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

    private void SerialService_ConnectionChanged(
        object? sender,
        SerialConnectionChangedEventArgs args)
    {
        switch (args.Reason)
        {
            case SerialConnectionChangeReason.Connected:
                NotifyUser(
                    Strings.Format("ConnectedToDeviceFormat", args.Device.DisplayName),
                    NotifyType.StatusMessage);
                break;
            case SerialConnectionChangeReason.UserDisconnected:
                NotifyUser(
                    Strings.Format("DisconnectedFromDeviceFormat", args.Device.DisplayName),
                    NotifyType.StatusMessage);
                break;
            case SerialConnectionChangeReason.DeviceRemoved:
                NotifyUser(
                    Strings.Format("ConnectedDeviceRemovedFormat", args.Device.DisplayName),
                    NotifyType.ErrorMessage);
                break;
        }
    }

    private void SerialService_OperationFailed(
        object? sender,
        SerialOperationFailedEventArgs args)
    {
        string operation = GetOperationName(args.Operation);
        string message = args.Exception switch
        {
            SerialOperationTimedOutException =>
                Strings.Format("OperationTimedOutFormat", operation),
            SerialProtocolException protocolException =>
                Strings.Format(
                    "InvalidTemperatureResponseFormat",
                    protocolException.Response),
            SerialWatcherStoppedException =>
                Strings.Get("DeviceWatcherStopped"),
            _ => Strings.Format(
                "OperationFailedFormat",
                operation,
                args.Exception.HResult,
                args.Exception.Message),
        };

        NotifyUser(message, NotifyType.ErrorMessage);
    }

    private static string GetOperationName(SerialOperation operation)
    {
        return Strings.Get(operation switch
        {
            SerialOperation.DiscoverDevices => "DiscoverDevicesOperation",
            SerialOperation.Connect => "ConnectDeviceOperation",
            SerialOperation.Disconnect => "DisconnectDeviceOperation",
            SerialOperation.SetLed => "SetLedOperation",
            SerialOperation.ReadTemperature => "ReadTemperatureOperation",
            _ => "SerialCommunicationOperation",
        });
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
