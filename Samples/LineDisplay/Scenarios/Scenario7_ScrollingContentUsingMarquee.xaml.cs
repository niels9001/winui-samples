using System;
using System.Threading.Tasks;
using Windows.Foundation;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Automation;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Navigation;
using Windows.Devices.PointOfService;

namespace SDKTemplate;

public sealed partial class Scenario7_ScrollingContentUsingMarquee : Page
{
    private readonly MainPage _rootPage = MainPage.Current;
    private ClaimedLineDisplay? _lineDisplay;
    private LineDisplayWindow? _horizontalScrollableWindow;
    private LineDisplayWindow? _verticalScrollableWindow;

    public Scenario7_ScrollingContentUsingMarquee()
    {
        InitializeComponent();
        AddMarqueeFormat(LineDisplayMarqueeFormat.None, "MarqueeFormatNone");
        AddMarqueeFormat(LineDisplayMarqueeFormat.Place, "MarqueeFormatPlace");
        AddMarqueeFormat(LineDisplayMarqueeFormat.Walk, "MarqueeFormatWalk");
        MarqueeFormatComboBox.SelectedIndex = 0;
    }

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
        ScrollDirectionComboBox.Items.Clear();
        StartScrollingButton.IsEnabled = false;
        StopScrollingButton.IsEnabled = false;

        _lineDisplay = await _rootPage.ClaimScenarioLineDisplayAsync();
        if (_lineDisplay is null)
        {
            return;
        }

        try
        {
            Size screenSize = _lineDisplay.GetAttributes().ScreenSizeInCharacters;
            uint windowCount = 1;

            if (_lineDisplay.Capabilities.IsHorizontalMarqueeSupported &&
                windowCount < _lineDisplay.Capabilities.SupportedWindows)
            {
                _horizontalScrollableWindow =
                    await _lineDisplay.TryCreateWindowAsync(
                        new Rect(0, 0, screenSize.Width, screenSize.Height),
                        new Size(screenSize.Width * 2, screenSize.Height));

                if (_horizontalScrollableWindow is not null)
                {
                    windowCount++;
                    AddScrollDirection(LineDisplayScrollDirection.Left, "ScrollDirectionLeft");
                    AddScrollDirection(LineDisplayScrollDirection.Right, "ScrollDirectionRight");
                }
            }

            if (_lineDisplay.Capabilities.IsVerticalMarqueeSupported &&
                windowCount < _lineDisplay.Capabilities.SupportedWindows)
            {
                _verticalScrollableWindow =
                    await _lineDisplay.TryCreateWindowAsync(
                        new Rect(0, 0, screenSize.Width, screenSize.Height),
                        new Size(screenSize.Width, screenSize.Height * 2));

                if (_verticalScrollableWindow is not null)
                {
                    AddScrollDirection(LineDisplayScrollDirection.Up, "ScrollDirectionUp");
                    AddScrollDirection(LineDisplayScrollDirection.Down, "ScrollDirectionDown");
                }
            }

            if (ScrollDirectionComboBox.Items.Count > 0)
            {
                ScrollDirectionComboBox.SelectedIndex = 0;
                StartScrollingButton.IsEnabled = true;
                StopScrollingButton.IsEnabled = true;
                _rootPage.NotifyUser(Strings.Get("LineDisplayReady"), NotifyType.StatusMessage);
            }
            else
            {
                _rootPage.NotifyUser(
                    Strings.Get("MarqueeNotSupported"),
                    NotifyType.ErrorMessage);
            }
        }
        catch (Exception ex)
        {
            DisposeLineDisplay();
            _rootPage.NotifyOperationError(Strings.Get("InitializingMarqueeOperation"), ex);
        }
    }

    private async void StartScrollingButton_Click(object sender, RoutedEventArgs e)
    {
        if (ScrollDirectionComboBox.SelectedItem is null ||
            MarqueeFormatComboBox.SelectedItem is null)
        {
            _rootPage.NotifyUser(Strings.Get("SelectScrollDirection"), NotifyType.ErrorMessage);
            return;
        }

        LineDisplayScrollDirection direction =
            Helpers.GetSelectedItemTag<LineDisplayScrollDirection>(
                ScrollDirectionComboBox);
        LineDisplayWindow? selectedWindow =
            direction is LineDisplayScrollDirection.Left or
                LineDisplayScrollDirection.Right
                ? _horizontalScrollableWindow
                : _verticalScrollableWindow;
        if (selectedWindow is null)
        {
            _rootPage.NotifyUser(Strings.Get("MarqueeWindowUnavailable"), NotifyType.ErrorMessage);
            return;
        }

        StartScrollingButton.IsEnabled = false;

        try
        {
            await StopAllScrollingAsync();

            bool prepared =
                await selectedWindow.TryRefreshAsync() &&
                await selectedWindow.TryClearTextAsync() &&
                await selectedWindow.TryDisplayTextAsync(
                    Strings.Get("MarqueeSampleText"));
            if (!prepared)
            {
                _rootPage.NotifyUser(
                    Strings.Get("PreparingMarqueeFailed"),
                    NotifyType.ErrorMessage);
                return;
            }

            selectedWindow.Marquee.Format =
                Helpers.GetSelectedItemTag<LineDisplayMarqueeFormat>(
                    MarqueeFormatComboBox);
            selectedWindow.Marquee.RepeatWaitInterval =
                TimeSpan.FromMilliseconds(RepeatWaitIntervalSlider.Value);
            selectedWindow.Marquee.ScrollWaitInterval =
                TimeSpan.FromMilliseconds(ScrollWaitIntervalSlider.Value);

            bool succeeded =
                await selectedWindow.Marquee.TryStartScrollingAsync(direction);
            _rootPage.NotifyUser(
                succeeded
                    ? Strings.Get("MarqueeStarted")
                    : Strings.Get("MarqueeStartFailed"),
                succeeded ? NotifyType.StatusMessage : NotifyType.ErrorMessage);
        }
        catch (Exception ex)
        {
            _rootPage.NotifyOperationError(Strings.Get("StartingMarqueeOperation"), ex);
        }
        finally
        {
            StartScrollingButton.IsEnabled =
                ScrollDirectionComboBox.Items.Count > 0;
        }
    }

    private async void StopScrollingButton_Click(object sender, RoutedEventArgs e)
    {
        StopScrollingButton.IsEnabled = false;

        try
        {
            bool succeeded = await StopAllScrollingAsync();
            _rootPage.NotifyUser(
                succeeded
                    ? Strings.Get("MarqueeStopped")
                    : Strings.Get("MarqueeStopFailed"),
                succeeded ? NotifyType.StatusMessage : NotifyType.ErrorMessage);
        }
        catch (Exception ex)
        {
            _rootPage.NotifyOperationError(Strings.Get("StoppingMarqueeOperation"), ex);
        }
        finally
        {
            StopScrollingButton.IsEnabled =
                ScrollDirectionComboBox.Items.Count > 0;
        }
    }

    private async Task<bool> StopAllScrollingAsync()
    {
        bool succeeded = true;
        if (_horizontalScrollableWindow is not null)
        {
            succeeded =
                await _horizontalScrollableWindow.Marquee.TryStopScrollingAsync() &&
                succeeded;
        }

        if (_verticalScrollableWindow is not null)
        {
            succeeded =
                await _verticalScrollableWindow.Marquee.TryStopScrollingAsync() &&
                succeeded;
        }

        return succeeded;
    }

    private void AddMarqueeFormat(
        LineDisplayMarqueeFormat format,
        string resourceId)
    {
        string label = Strings.Get(resourceId);
        var item = new ComboBoxItem
        {
            Content = label,
            Tag = format,
        };

        AutomationProperties.SetName(item, label);
        AutomationProperties.SetAutomationId(item, $"MarqueeFormat{format}");
        MarqueeFormatComboBox.Items.Add(item);
    }

    private void AddScrollDirection(
        LineDisplayScrollDirection direction,
        string resourceId)
    {
        string label = Strings.Get(resourceId);
        var item = new ComboBoxItem
        {
            Content = label,
            Tag = direction,
        };

        AutomationProperties.SetName(item, label);
        AutomationProperties.SetAutomationId(item, $"ScrollDirection{direction}");
        ScrollDirectionComboBox.Items.Add(item);
    }

    private void DisposeLineDisplay()
    {
        _horizontalScrollableWindow?.Dispose();
        _horizontalScrollableWindow = null;
        _verticalScrollableWindow?.Dispose();
        _verticalScrollableWindow = null;
        _lineDisplay?.Dispose();
        _lineDisplay = null;
    }
}
