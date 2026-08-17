using System;
using System.Threading.Tasks;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Navigation;
using Windows.Devices.PointOfService;

namespace SDKTemplate;

public sealed partial class Scenario3_MultipleDrawers : Page
{
    private readonly MainPage rootPage = MainPage.Current;
    private CashDrawer? drawer1;
    private CashDrawer? drawer2;
    private ClaimedCashDrawer? claimedDrawer1;
    private ClaimedCashDrawer? claimedDrawer2;

    public Scenario3_MultipleDrawers()
    {
        InitializeComponent();
    }

    private enum DrawerInstance
    {
        Instance1,
        Instance2
    }

    protected override void OnNavigatedTo(NavigationEventArgs e)
    {
        ResetScenario();
        rootPage.NotifyUser(
            "Claim either instance to begin.",
            NotifyType.StatusMessage);
    }

    protected override void OnNavigatedFrom(NavigationEventArgs e)
    {
        ReleaseInstance(DrawerInstance.Instance1);
        ReleaseInstance(DrawerInstance.Instance2);
    }

    private async void ClaimButton1_Click(object sender, RoutedEventArgs e)
    {
        await ClaimInstanceAsync(DrawerInstance.Instance1);
    }

    private async void ClaimButton2_Click(object sender, RoutedEventArgs e)
    {
        await ClaimInstanceAsync(DrawerInstance.Instance2);
    }

    private void ReleaseButton1_Click(object sender, RoutedEventArgs e)
    {
        ReleaseInstance(DrawerInstance.Instance1);
        rootPage.NotifyUser(
            "Instance 1 released its cash drawer claim.",
            NotifyType.StatusMessage);
    }

    private void ReleaseButton2_Click(object sender, RoutedEventArgs e)
    {
        ReleaseInstance(DrawerInstance.Instance2);
        rootPage.NotifyUser(
            "Instance 2 released its cash drawer claim.",
            NotifyType.StatusMessage);
    }

    private async Task ClaimInstanceAsync(DrawerInstance instance)
    {
        SetClaimButtonEnabled(instance, false);
        rootPage.NotifyUser(
            $"Creating cash drawer {GetInstanceName(instance)}.",
            NotifyType.StatusMessage);

        try
        {
            CashDrawer? drawer = await DeviceHelpers.GetFirstCashDrawerAsync();
            if (drawer is null)
            {
                rootPage.NotifyUser(
                    "Cash drawer not found. Connect a compatible cash drawer and try again.",
                    NotifyType.ErrorMessage);
                return;
            }

            SetDrawer(instance, drawer);

            ClaimedCashDrawer? claimedDrawer = await drawer.ClaimDrawerAsync();
            if (claimedDrawer is null)
            {
                ReleaseInstance(instance);
                rootPage.NotifyUser(
                    $"{GetInstanceName(instance)} could not claim the cash drawer.",
                    NotifyType.ErrorMessage);
                return;
            }

            SetClaimedDrawer(instance, claimedDrawer);
            if (instance == DrawerInstance.Instance1)
            {
                claimedDrawer.ReleaseDeviceRequested += OnReleaseDeviceRequested1;
            }
            else
            {
                claimedDrawer.ReleaseDeviceRequested += OnReleaseDeviceRequested2;
            }

            SetClaimedUi(instance);
            rootPage.NotifyUser(
                $"{GetInstanceName(instance)} claimed the cash drawer.",
                NotifyType.StatusMessage);
        }
        catch (Exception ex)
        {
            ReleaseInstance(instance);
            rootPage.NotifyOperationError(
                $"Claiming the cash drawer with {GetInstanceName(instance)}",
                ex);
        }
        finally
        {
            if (GetClaimedDrawer(instance) is null)
            {
                SetClaimButtonEnabled(instance, true);
            }
        }
    }

    private void OnReleaseDeviceRequested1(ClaimedCashDrawer sender, object args)
    {
        DispatcherQueue.TryEnqueue(
            async () => await HandleReleaseRequestAsync(DrawerInstance.Instance1, sender));
    }

    private void OnReleaseDeviceRequested2(ClaimedCashDrawer sender, object args)
    {
        DispatcherQueue.TryEnqueue(
            async () => await HandleReleaseRequestAsync(DrawerInstance.Instance2, sender));
    }

    private async Task HandleReleaseRequestAsync(
        DrawerInstance instance,
        ClaimedCashDrawer sender)
    {
        if (GetClaimedDrawer(instance) is null)
        {
            return;
        }

        try
        {
            bool retain = instance == DrawerInstance.Instance1
                ? RetainCheckBox1.IsChecked == true
                : RetainCheckBox2.IsChecked == true;

            if (retain)
            {
                bool retained = await sender.RetainDeviceAsync();
                rootPage.NotifyUser(
                    retained
                        ? $"{GetInstanceName(instance)} retained the cash drawer."
                        : $"{GetInstanceName(instance)} could not retain the cash drawer.",
                    retained ? NotifyType.StatusMessage : NotifyType.ErrorMessage);
            }
            else
            {
                ReleaseInstance(instance);
                rootPage.NotifyUser(
                    $"{GetInstanceName(instance)} released the cash drawer on request.",
                    NotifyType.StatusMessage);
            }
        }
        catch (Exception ex)
        {
            rootPage.NotifyOperationError(
                $"Handling the release request for {GetInstanceName(instance)}",
                ex);
        }
    }

    private void ResetScenario()
    {
        ReleaseInstance(DrawerInstance.Instance1);
        ReleaseInstance(DrawerInstance.Instance2);

        RetainCheckBox1.IsChecked = true;
        RetainCheckBox2.IsChecked = true;
    }

    private void SetClaimedUi(DrawerInstance instance)
    {
        if (instance == DrawerInstance.Instance1)
        {
            ClaimButton1.IsEnabled = false;
            ReleaseButton1.IsEnabled = true;
        }
        else
        {
            ClaimButton2.IsEnabled = false;
            ReleaseButton2.IsEnabled = true;
        }
    }

    private void SetClaimButtonEnabled(DrawerInstance instance, bool enabled)
    {
        if (instance == DrawerInstance.Instance1)
        {
            ClaimButton1.IsEnabled = enabled;
        }
        else
        {
            ClaimButton2.IsEnabled = enabled;
        }
    }

    private void ReleaseInstance(DrawerInstance instance)
    {
        if (instance == DrawerInstance.Instance1)
        {
            if (claimedDrawer1 is not null)
            {
                claimedDrawer1.ReleaseDeviceRequested -= OnReleaseDeviceRequested1;
                claimedDrawer1.Dispose();
                claimedDrawer1 = null;
            }

            drawer1?.Dispose();
            drawer1 = null;
            ClaimButton1.IsEnabled = true;
            ReleaseButton1.IsEnabled = false;
        }
        else
        {
            if (claimedDrawer2 is not null)
            {
                claimedDrawer2.ReleaseDeviceRequested -= OnReleaseDeviceRequested2;
                claimedDrawer2.Dispose();
                claimedDrawer2 = null;
            }

            drawer2?.Dispose();
            drawer2 = null;
            ClaimButton2.IsEnabled = true;
            ReleaseButton2.IsEnabled = false;
        }
    }

    private void SetDrawer(DrawerInstance instance, CashDrawer drawer)
    {
        if (instance == DrawerInstance.Instance1)
        {
            drawer1 = drawer;
        }
        else
        {
            drawer2 = drawer;
        }
    }

    private void SetClaimedDrawer(
        DrawerInstance instance,
        ClaimedCashDrawer claimedDrawer)
    {
        if (instance == DrawerInstance.Instance1)
        {
            claimedDrawer1 = claimedDrawer;
        }
        else
        {
            claimedDrawer2 = claimedDrawer;
        }
    }

    private ClaimedCashDrawer? GetClaimedDrawer(DrawerInstance instance)
    {
        return instance == DrawerInstance.Instance1
            ? claimedDrawer1
            : claimedDrawer2;
    }

    private static string GetInstanceName(DrawerInstance instance)
    {
        return instance == DrawerInstance.Instance1 ? "Instance 1" : "Instance 2";
    }
}
