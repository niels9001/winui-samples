using System;
using System.Runtime.InteropServices;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Navigation;
using Windows.UI.ViewManagement;

namespace SDKTemplate;

public sealed partial class MainPage : Page
{
    private UserInteractionMode? _currentMode;

    public MainPage()
    {
        InitializeComponent();
    }

    protected override void OnNavigatedTo(NavigationEventArgs e)
    {
        base.OnNavigatedTo(e);
        App.MainWindow.SizeChanged += MainWindow_SizeChanged;
        UpdateContent(announceResult: true);
    }

    protected override void OnNavigatedFrom(NavigationEventArgs e)
    {
        App.MainWindow.SizeChanged -= MainWindow_SizeChanged;
        base.OnNavigatedFrom(e);
    }

    private void MainWindow_SizeChanged(
        object sender,
        WindowSizeChangedEventArgs args)
    {
        UpdateContent(announceResult: false);
    }

    private void RefreshModeButton_Click(
        object sender,
        RoutedEventArgs e)
    {
        UpdateContent(announceResult: true);
    }

    private void UpdateContent(bool announceResult)
    {
        try
        {
            nint hwnd =
                WinRT.Interop.WindowNative.GetWindowHandle(App.MainWindow);
            UIViewSettings settings =
                UIViewSettingsInterop.GetForWindow(hwnd);
            UserInteractionMode mode = settings.UserInteractionMode;
            bool modeChanged = _currentMode != mode;
            _currentMode = mode;

            CurrentModeTextBlock.Text = mode.ToString();
            ModeExplanationTextBlock.Text =
                mode == UserInteractionMode.Touch
                    ? "Touch-optimized spacing is active."
                    : "Mouse-optimized spacing is active.";
            ApplyCheckBoxStyle(mode);

            if (announceResult || modeChanged)
            {
                StatusInfoBar.Message =
                    $"Windows reports {mode} interaction mode for this window.";
                StatusInfoBar.Severity = InfoBarSeverity.Success;
                StatusInfoBar.IsOpen = true;
            }
        }
        catch (Exception exception) when (
            exception is COMException or InvalidOperationException)
        {
            CurrentModeTextBlock.Text = "Unavailable";
            ModeExplanationTextBlock.Text =
                "Windows did not return interaction settings for this window.";
            StatusInfoBar.Message =
                $"Reading the interaction mode failed (0x{exception.HResult:X8}): {exception.Message}";
            StatusInfoBar.Severity = InfoBarSeverity.Error;
            StatusInfoBar.IsOpen = true;
        }
    }

    private void ApplyCheckBoxStyle(UserInteractionMode mode)
    {
        string styleKey = mode == UserInteractionMode.Touch
            ? "TouchCheckBoxStyle"
            : "MouseCheckBoxStyle";
        var style = (Style)Resources[styleKey];
        FirstCheckBox.Style = style;
        SecondCheckBox.Style = style;
        ThirdCheckBox.Style = style;
    }
}
