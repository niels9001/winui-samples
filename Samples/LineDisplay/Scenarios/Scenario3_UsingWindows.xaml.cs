using System;
using System.Collections.ObjectModel;
using System.Globalization;
using System.Threading.Tasks;
using Windows.Foundation;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Navigation;
using Windows.Devices.PointOfService;

namespace SDKTemplate;

public sealed partial class Scenario3_UsingWindows : Page
{
    private readonly MainPage _rootPage = MainPage.Current;
    private ClaimedLineDisplay? _lineDisplay;
    private int _nextWindowId;
    private uint _maximumWindows;

    public Scenario3_UsingWindows()
    {
        InitializeComponent();
    }

    internal ObservableCollection<WindowInfo> WindowList { get; } = [];

    protected override async void OnNavigatedTo(NavigationEventArgs e)
    {
        await InitializeAsync();
    }

    protected override void OnNavigatedFrom(NavigationEventArgs e)
    {
        DisposeLineDisplay();
    }

    private async Task InitializeAsync()
    {
        DisposeLineDisplay();
        _lineDisplay = await _rootPage.ClaimScenarioLineDisplayAsync();
        if (_lineDisplay is null)
        {
            UpdateButtonStates();
            return;
        }

        try
        {
            _maximumWindows = _lineDisplay.Capabilities.SupportedWindows;
            if (_maximumWindows > 0)
            {
                WindowList.Add(
                    new WindowInfo(_lineDisplay.DefaultWindow, _nextWindowId++, true));
                WindowsListView.SelectedIndex = 0;
            }

            Size screenSize = _lineDisplay.GetAttributes().ScreenSizeInCharacters;
            string width = screenSize.Width.ToString(CultureInfo.CurrentCulture);
            string height = screenSize.Height.ToString(CultureInfo.CurrentCulture);
            NewViewportWidthTextBox.Text = width;
            NewViewportHeightTextBox.Text = height;
            NewViewportXTextBox.Text = "0";
            NewViewportYTextBox.Text = "0";
            NewWindowWidthTextBox.Text = width;
            NewWindowHeightTextBox.Text = height;

            UpdateButtonStates();
            _rootPage.NotifyUser(Strings.Get("LineDisplayReady"), NotifyType.StatusMessage);
        }
        catch (Exception ex)
        {
            DisposeLineDisplay();
            UpdateButtonStates();
            _rootPage.NotifyOperationError(Strings.Get("ReadingCapabilitiesOperation"), ex);
        }
    }

    private async void NewWindowButton_Click(object sender, RoutedEventArgs e)
    {
        if (_lineDisplay is null)
        {
            _rootPage.NotifyUser(Strings.Get("SelectLineDisplayFirst"), NotifyType.ErrorMessage);
            return;
        }

        var viewportBounds = new Rect
        {
            X = Helpers.ParseUnsignedIntegerWithFallback(NewViewportXTextBox, -1),
            Y = Helpers.ParseUnsignedIntegerWithFallback(NewViewportYTextBox, -1),
            Width = Helpers.ParseUnsignedIntegerWithFallback(NewViewportWidthTextBox, 0),
            Height = Helpers.ParseUnsignedIntegerWithFallback(NewViewportHeightTextBox, 0),
        };

        if (viewportBounds.Width <= 0 || viewportBounds.Height <= 0)
        {
            _rootPage.NotifyUser(
                Strings.Get("ViewportSizeMustBePositive"),
                NotifyType.ErrorMessage);
            return;
        }

        Size screenSize = _lineDisplay.GetAttributes().ScreenSizeInCharacters;
        if (viewportBounds.X < 0 ||
            viewportBounds.Y < 0 ||
            viewportBounds.X + viewportBounds.Width > screenSize.Width ||
            viewportBounds.Y + viewportBounds.Height > screenSize.Height)
        {
            _rootPage.NotifyUser(
                Strings.Get("ViewportMustFitScreen"),
                NotifyType.ErrorMessage);
            return;
        }

        var windowSize = new Size(
            Helpers.ParseUnsignedIntegerWithFallback(NewWindowWidthTextBox, 0),
            Helpers.ParseUnsignedIntegerWithFallback(NewWindowHeightTextBox, 0));

        if (windowSize.Width <= 0 || windowSize.Height <= 0)
        {
            _rootPage.NotifyUser(
                Strings.Get("WindowSizeMustBePositive"),
                NotifyType.ErrorMessage);
            return;
        }

        if (viewportBounds.Width > windowSize.Width ||
            viewportBounds.Height > windowSize.Height)
        {
            _rootPage.NotifyUser(
                Strings.Get("WindowMustContainViewport"),
                NotifyType.ErrorMessage);
            return;
        }

        if (windowSize.Height > viewportBounds.Height &&
            !_lineDisplay.Capabilities.IsVerticalMarqueeSupported)
        {
            _rootPage.NotifyUser(
                Strings.Get("VerticalMarqueeNotSupported"),
                NotifyType.ErrorMessage);
            return;
        }

        if (windowSize.Width > viewportBounds.Width &&
            !_lineDisplay.Capabilities.IsHorizontalMarqueeSupported)
        {
            _rootPage.NotifyUser(
                Strings.Get("HorizontalMarqueeNotSupported"),
                NotifyType.ErrorMessage);
            return;
        }

        if (windowSize.Width > viewportBounds.Width &&
            windowSize.Height > viewportBounds.Height)
        {
            _rootPage.NotifyUser(
                Strings.Get("TwoDimensionalScrollingNotSupported"),
                NotifyType.ErrorMessage);
            return;
        }

        NewWindowButton.IsEnabled = false;

        try
        {
            LineDisplayWindow? newWindow =
                await _lineDisplay.TryCreateWindowAsync(viewportBounds, windowSize);
            if (newWindow is null)
            {
                _rootPage.NotifyUser(
                    Strings.Get("UnableToCreateWindow"),
                    NotifyType.ErrorMessage);
                return;
            }

            var windowInfo = new WindowInfo(newWindow, _nextWindowId++, false);
            WindowList.Add(windowInfo);
            WindowsListView.SelectedItem = windowInfo;
            _rootPage.NotifyUser(
                Strings.Format("WindowCreatedFormat", windowInfo.Id),
                NotifyType.StatusMessage);
        }
        catch (Exception ex)
        {
            _rootPage.NotifyOperationError(Strings.Get("CreatingWindowOperation"), ex);
        }
        finally
        {
            UpdateButtonStates();
        }
    }

    private async void RefreshWindowButton_Click(object sender, RoutedEventArgs e)
    {
        if (WindowsListView.SelectedItem is not WindowInfo targetWindow)
        {
            return;
        }

        try
        {
            bool succeeded = await targetWindow.Window.TryRefreshAsync();
            _rootPage.NotifyUser(
                succeeded
                    ? Strings.Format("WindowRefreshedFormat", targetWindow.Id)
                    : Strings.Format("WindowRefreshFailedFormat", targetWindow.Id),
                succeeded ? NotifyType.StatusMessage : NotifyType.ErrorMessage);
        }
        catch (Exception ex)
        {
            _rootPage.NotifyOperationError(Strings.Get("RefreshingWindowOperation"), ex);
        }
    }

    private void DestroyWindowButton_Click(object sender, RoutedEventArgs e)
    {
        if (WindowsListView.SelectedItem is not WindowInfo targetWindow ||
            targetWindow.IsDefault)
        {
            return;
        }

        try
        {
            targetWindow.Window.Dispose();
            WindowList.Remove(targetWindow);
            WindowsListView.SelectedIndex = WindowList.Count > 0 ? 0 : -1;
            _rootPage.NotifyUser(
                Strings.Format("WindowDestroyedFormat", targetWindow.Id),
                NotifyType.StatusMessage);
        }
        catch (Exception ex)
        {
            _rootPage.NotifyOperationError(Strings.Get("DestroyingWindowOperation"), ex);
        }
        finally
        {
            UpdateButtonStates();
        }
    }

    private async void DisplayWindowTextButton_Click(object sender, RoutedEventArgs e)
    {
        if (WindowsListView.SelectedItem is not WindowInfo targetWindow)
        {
            return;
        }

        try
        {
            bool succeeded =
                await targetWindow.Window.TryDisplayTextAsync(DisplayTextTextBox.Text);
            _rootPage.NotifyUser(
                succeeded
                    ? Strings.Format("WindowTextDisplayedFormat", targetWindow.Id)
                    : Strings.Format("WindowTextDisplayFailedFormat", targetWindow.Id),
                succeeded ? NotifyType.StatusMessage : NotifyType.ErrorMessage);
        }
        catch (Exception ex)
        {
            _rootPage.NotifyOperationError(Strings.Get("DisplayingWindowTextOperation"), ex);
        }
    }

    private void WindowsListView_SelectionChanged(
        object sender,
        SelectionChangedEventArgs e)
    {
        UpdateButtonStates();
    }

    private void UpdateButtonStates()
    {
        WindowInfo? selectedWindow = WindowsListView.SelectedItem as WindowInfo;
        NewWindowButton.IsEnabled =
            _lineDisplay is not null && WindowList.Count < _maximumWindows;
        RefreshWindowButton.IsEnabled = selectedWindow is not null;
        DestroyWindowButton.IsEnabled = selectedWindow is { IsDefault: false };
        DisplayWindowTextButton.IsEnabled = selectedWindow is not null;
    }

    private void DisposeLineDisplay()
    {
        foreach (WindowInfo windowInfo in WindowList)
        {
            if (!windowInfo.IsDefault)
            {
                windowInfo.Window.Dispose();
            }
        }

        WindowList.Clear();
        _lineDisplay?.Dispose();
        _lineDisplay = null;
        _nextWindowId = 0;
        _maximumWindows = 0;
    }
}

internal sealed class WindowInfo
{
    internal WindowInfo(LineDisplayWindow window, int id, bool isDefault)
    {
        Window = window;
        Id = id;
        IsDefault = isDefault;
        DisplayName = isDefault
            ? Strings.Format("DefaultWindowNameFormat", id)
            : Strings.Format("WindowNameFormat", id);
    }

    internal LineDisplayWindow Window { get; }

    public int Id { get; }

    internal bool IsDefault { get; }

    public string DisplayName { get; }
}
