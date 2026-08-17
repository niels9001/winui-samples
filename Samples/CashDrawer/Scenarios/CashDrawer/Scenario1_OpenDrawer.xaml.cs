using System;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Navigation;
using Windows.Devices.PointOfService;

namespace SDKTemplate;

public sealed partial class Scenario1_OpenDrawer : Page
{
    private readonly MainPage rootPage = MainPage.Current;
    private CashDrawer? drawer;
    private ClaimedCashDrawer? claimedDrawer;

    public Scenario1_OpenDrawer()
    {
        InitializeComponent();
    }

    protected override void OnNavigatedTo(NavigationEventArgs e)
    {
        DisposeDrawer();
        InitDrawerButton.IsEnabled = true;
        OpenDrawerButton.IsEnabled = false;
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

            OpenDrawerButton.IsEnabled = true;
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

    private async void OpenDrawerButton_Click(object sender, RoutedEventArgs e)
    {
        if (claimedDrawer is null || !claimedDrawer.IsEnabled)
        {
            rootPage.NotifyUser(
                "Initialize and enable the cash drawer first.",
                NotifyType.ErrorMessage);
            return;
        }

        OpenDrawerButton.IsEnabled = false;

        try
        {
            bool opened = await claimedDrawer.OpenDrawerAsync();
            rootPage.NotifyUser(
                opened ? "Cash drawer opened." : "The cash drawer did not open.",
                opened ? NotifyType.StatusMessage : NotifyType.ErrorMessage);
        }
        catch (Exception ex)
        {
            rootPage.NotifyOperationError("Opening the cash drawer", ex);
        }
        finally
        {
            OpenDrawerButton.IsEnabled = claimedDrawer is not null;
        }
    }

    private void DisposeDrawer()
    {
        claimedDrawer?.Dispose();
        claimedDrawer = null;

        drawer?.Dispose();
        drawer = null;
    }
}
