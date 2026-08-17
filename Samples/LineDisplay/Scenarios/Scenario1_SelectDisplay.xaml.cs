using System.Collections.ObjectModel;
using System.Linq;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Navigation;
using Windows.Devices.Enumeration;
using Windows.Devices.PointOfService;

namespace SDKTemplate;

public sealed partial class Scenario1_SelectDisplay : Page
{
    private readonly MainPage _rootPage = MainPage.Current;
    private DeviceWatcher? _watcher;

    public Scenario1_SelectDisplay()
    {
        InitializeComponent();
    }

    internal ObservableCollection<LineDisplayDevice> Devices { get; } = [];

    protected override void OnNavigatedTo(NavigationEventArgs e)
    {
        StartWatcher();
    }

    protected override void OnNavigatedFrom(NavigationEventArgs e)
    {
        StopWatcher();
    }

    private void StartWatcher()
    {
        StopWatcher();
        Devices.Clear();
        SelectButton.IsEnabled = false;
        _rootPage.NotifyUser(Strings.Get("SearchingForLineDisplays"), NotifyType.StatusMessage);

        try
        {
            _watcher = DeviceInformation.CreateWatcher(
                LineDisplay.GetDeviceSelector(PosConnectionTypes.All));
            _watcher.Added += Watcher_Added;
            _watcher.Removed += Watcher_Removed;
            _watcher.EnumerationCompleted += Watcher_EnumerationCompleted;
            _watcher.Start();
        }
        catch (System.Exception ex)
        {
            StopWatcher();
            _rootPage.NotifyOperationError(Strings.Get("EnumeratingLineDisplaysOperation"), ex);
        }
    }

    private void StopWatcher()
    {
        DeviceWatcher? watcher = _watcher;
        _watcher = null;

        if (watcher is null)
        {
            return;
        }

        watcher.Added -= Watcher_Added;
        watcher.Removed -= Watcher_Removed;
        watcher.EnumerationCompleted -= Watcher_EnumerationCompleted;

        if (watcher.Status is DeviceWatcherStatus.Started or
            DeviceWatcherStatus.EnumerationCompleted)
        {
            watcher.Stop();
        }
    }

    private void Watcher_Added(DeviceWatcher sender, DeviceInformation deviceInformation)
    {
        DispatcherQueue.TryEnqueue(() =>
        {
            if (!ReferenceEquals(sender, _watcher) ||
                Devices.Any(device => device.Id == deviceInformation.Id))
            {
                return;
            }

            Devices.Add(new LineDisplayDevice(deviceInformation.Id, deviceInformation.Name));
        });
    }

    private void Watcher_Removed(
        DeviceWatcher sender,
        DeviceInformationUpdate deviceInformationUpdate)
    {
        DispatcherQueue.TryEnqueue(() =>
        {
            if (!ReferenceEquals(sender, _watcher))
            {
                return;
            }

            LineDisplayDevice? device =
                Devices.FirstOrDefault(item => item.Id == deviceInformationUpdate.Id);
            if (device is null)
            {
                return;
            }

            Devices.Remove(device);
            if (_rootPage.SelectedLineDisplayId == device.Id)
            {
                _rootPage.SelectedLineDisplayId = null;
                _rootPage.NotifyUser(
                    Strings.Get("SelectedLineDisplayDisconnected"),
                    NotifyType.ErrorMessage);
            }
        });
    }

    private void Watcher_EnumerationCompleted(DeviceWatcher sender, object args)
    {
        DispatcherQueue.TryEnqueue(() =>
        {
            if (!ReferenceEquals(sender, _watcher))
            {
                return;
            }

            _rootPage.NotifyUser(
                Devices.Count == 0
                    ? Strings.Get("NoLineDisplaysFound")
                    : Strings.Format("LineDisplaysFoundFormat", Devices.Count),
                Devices.Count == 0
                    ? NotifyType.ErrorMessage
                    : NotifyType.StatusMessage);
        });
    }

    private void DisplaysListView_SelectionChanged(
        object sender,
        SelectionChangedEventArgs e)
    {
        SelectButton.IsEnabled = DisplaysListView.SelectedItem is LineDisplayDevice;
    }

    private async void SelectButton_Click(object sender, RoutedEventArgs e)
    {
        if (DisplaysListView.SelectedItem is not LineDisplayDevice device)
        {
            _rootPage.NotifyUser(Strings.Get("SelectDeviceFromList"), NotifyType.ErrorMessage);
            return;
        }

        SelectButton.IsEnabled = false;

        try
        {
            using ClaimedLineDisplay? lineDisplay =
                await ClaimedLineDisplay.FromIdAsync(device.Id);
            if (lineDisplay is null)
            {
                _rootPage.NotifyUser(
                    Strings.Get("UnableToClaimLineDisplay"),
                    NotifyType.ErrorMessage);
                return;
            }

            if (!await lineDisplay.DefaultWindow.TryClearTextAsync())
            {
                _rootPage.NotifyUser(
                    Strings.Get("UnableToClearLineDisplay"),
                    NotifyType.ErrorMessage);
                return;
            }

            _rootPage.SelectedLineDisplayId = device.Id;
            _rootPage.NotifyUser(
                Strings.Format("SelectedLineDisplayFormat", device.Name),
                NotifyType.StatusMessage);
        }
        catch (System.Exception ex)
        {
            _rootPage.NotifyOperationError(Strings.Get("SelectingLineDisplayOperation"), ex);
        }
        finally
        {
            SelectButton.IsEnabled = DisplaysListView.SelectedItem is LineDisplayDevice;
        }
    }

    private void RefreshButton_Click(object sender, RoutedEventArgs e)
    {
        StartWatcher();
    }
}

internal sealed record LineDisplayDevice(string Id, string Name);
