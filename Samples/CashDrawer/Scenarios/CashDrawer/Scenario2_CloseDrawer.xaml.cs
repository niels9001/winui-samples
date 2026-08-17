using System;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Navigation;
using Windows.Devices.PointOfService;

namespace SDKTemplate;

public sealed partial class Scenario2_CloseDrawer : Page
{
    private readonly MainPage rootPage = MainPage.Current;
    private CashDrawer? drawer;
    private ClaimedCashDrawer? claimedDrawer;
    private CashDrawerCloseAlarm? closeAlarm;

    public Scenario2_CloseDrawer()
    {
        InitializeComponent();
    }

    protected override void OnNavigatedTo(NavigationEventArgs e)
    {
        DisposeDrawer();
        DrawerStatusBlock.Text = CashDrawerStatusKind.Offline.ToString();
        InitDrawerButton.IsEnabled = true;
        DrawerWaitButton.IsEnabled = false;
        rootPage.NotifyUser(
            "Select Initialize drawer to begin.",
            NotifyType.StatusMessage);
    }

    protected override void OnNavigatedFrom(NavigationEventArgs e)
    {
        DisposeDrawer();
    }

    private async void InitDrawerButton_Click(object sender, RoutedEventArgs e)
    {
        InitDrawerButton.IsEnabled = false;

        try
        {
            drawer = await DeviceHelpers.GetFirstCashDrawerAsync();
            if (drawer is null)
            {
                rootPage.NotifyUser(
                    "Cash drawer not found. Connect a compatible cash drawer and try again.",
                    NotifyType.ErrorMessage);
                InitDrawerButton.IsEnabled = true;
                return;
            }

            claimedDrawer = await drawer.ClaimDrawerAsync();
            if (claimedDrawer is null)
            {
                rootPage.NotifyUser(
                    "The cash drawer could not be claimed.",
                    NotifyType.ErrorMessage);
                DisposeDrawer();
                InitDrawerButton.IsEnabled = true;
                return;
            }

            if (!claimedDrawer.IsEnabled && !await claimedDrawer.EnableAsync())
            {
                rootPage.NotifyUser(
                    "The claimed cash drawer could not be enabled.",
                    NotifyType.ErrorMessage);
                DisposeDrawer();
                InitDrawerButton.IsEnabled = true;
                return;
            }

            drawer.StatusUpdated += OnDrawerStatusUpdated;
            DrawerStatusBlock.Text = drawer.Status.StatusKind.ToString();
            DrawerWaitButton.IsEnabled = true;

            rootPage.NotifyUser(
                $"Cash drawer enabled. Device ID: {claimedDrawer.DeviceId}",
                NotifyType.StatusMessage);
        }
        catch (Exception ex)
        {
            DisposeDrawer();
            InitDrawerButton.IsEnabled = true;
            rootPage.NotifyOperationError("Initializing the cash drawer", ex);
        }
    }

    private async void WaitForDrawerCloseButton_Click(object sender, RoutedEventArgs e)
    {
        if (claimedDrawer is null)
        {
            rootPage.NotifyUser(
                "Initialize the cash drawer first.",
                NotifyType.ErrorMessage);
            return;
        }

        if (!claimedDrawer.IsDrawerOpen)
        {
            rootPage.NotifyUser(
                "The cash drawer is already closed.",
                NotifyType.StatusMessage);
            return;
        }

        closeAlarm = claimedDrawer.CloseAlarm;
        if (closeAlarm is null)
        {
            rootPage.NotifyUser(
                "This cash drawer does not provide a close alarm.",
                NotifyType.ErrorMessage);
            return;
        }

        DrawerWaitButton.IsEnabled = false;

        try
        {
            closeAlarm.AlarmTimeout = TimeSpan.FromSeconds(30);
            closeAlarm.BeepDelay = TimeSpan.FromSeconds(3);
            closeAlarm.BeepDuration = TimeSpan.FromSeconds(1);
            closeAlarm.BeepFrequency = 700;
            closeAlarm.AlarmTimeoutExpired -= OnAlarmTimeoutExpired;
            closeAlarm.AlarmTimeoutExpired += OnAlarmTimeoutExpired;

            rootPage.NotifyUser(
                "Waiting for the cash drawer to close.",
                NotifyType.StatusMessage);

            bool closed = await closeAlarm.StartAsync();
            rootPage.NotifyUser(
                closed
                    ? "The cash drawer closed."
                    : "The cash drawer close wait did not complete.",
                closed ? NotifyType.StatusMessage : NotifyType.ErrorMessage);
        }
        catch (Exception ex)
        {
            rootPage.NotifyOperationError("Waiting for the cash drawer to close", ex);
        }
        finally
        {
            DrawerWaitButton.IsEnabled = claimedDrawer is not null;
        }
    }

    private void OnDrawerStatusUpdated(
        CashDrawer sender,
        CashDrawerStatusUpdatedEventArgs args)
    {
        DispatcherQueue.TryEnqueue(() =>
        {
            DrawerStatusBlock.Text = args.Status.StatusKind.ToString();
            rootPage.NotifyUser(
                $"Drawer status changed to {args.Status.StatusKind}.",
                NotifyType.StatusMessage);
        });
    }

    private void OnAlarmTimeoutExpired(CashDrawerCloseAlarm sender, object args)
    {
        DispatcherQueue.TryEnqueue(() =>
            rootPage.NotifyUser(
                "The alarm expired while the drawer was still open.",
                NotifyType.ErrorMessage));
    }

    private void DisposeDrawer()
    {
        if (closeAlarm is not null)
        {
            closeAlarm.AlarmTimeoutExpired -= OnAlarmTimeoutExpired;
            closeAlarm = null;
        }

        if (drawer is not null)
        {
            drawer.StatusUpdated -= OnDrawerStatusUpdated;
        }

        claimedDrawer?.Dispose();
        claimedDrawer = null;

        drawer?.Dispose();
        drawer = null;
    }
}
