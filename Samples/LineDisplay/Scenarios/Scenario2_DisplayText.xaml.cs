using System;
using System.Threading.Tasks;
using Windows.Foundation;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Navigation;
using Windows.Devices.PointOfService;

namespace SDKTemplate;

public sealed partial class Scenario2_DisplayText : Page
{
    private readonly MainPage _rootPage = MainPage.Current;
    private ClaimedLineDisplay? _lineDisplay;

    public Scenario2_DisplayText()
    {
        InitializeComponent();
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
        BlinkCheckBox.IsEnabled = false;
        DisplayTextButton.IsEnabled = false;

        _lineDisplay = await _rootPage.ClaimScenarioLineDisplayAsync();
        if (_lineDisplay is null)
        {
            return;
        }

        try
        {
            BlinkCheckBox.IsEnabled =
                _lineDisplay.Capabilities.CanBlink !=
                LineDisplayTextAttributeGranularity.NotSupported;
            DisplayTextButton.IsEnabled = true;
            _rootPage.NotifyUser(Strings.Get("LineDisplayReady"), NotifyType.StatusMessage);
        }
        catch (Exception ex)
        {
            DisposeLineDisplay();
            _rootPage.NotifyOperationError(Strings.Get("ReadingCapabilitiesOperation"), ex);
        }
    }

    private async void DisplayTextButton_Click(object sender, RoutedEventArgs e)
    {
        if (_lineDisplay is null)
        {
            _rootPage.NotifyUser(Strings.Get("SelectLineDisplayFirst"), NotifyType.ErrorMessage);
            return;
        }

        DisplayTextButton.IsEnabled = false;

        try
        {
            string text = Strings.Get("GreetingText");
            var position = new Point(0, 0);
            if (CenterCheckBox.IsChecked == true &&
                text.Length < _lineDisplay.DefaultWindow.SizeInCharacters.Width)
            {
                position.X =
                    ((int)_lineDisplay.DefaultWindow.SizeInCharacters.Width - text.Length) / 2;
            }

            LineDisplayTextAttribute attribute = BlinkCheckBox.IsChecked == true
                ? LineDisplayTextAttribute.Blink
                : LineDisplayTextAttribute.Normal;

            bool succeeded =
                await _lineDisplay.DefaultWindow.TryClearTextAsync() &&
                await _lineDisplay.DefaultWindow.TryDisplayTextAsync(
                    text,
                    attribute,
                    position);

            _rootPage.NotifyUser(
                succeeded
                    ? Strings.Get("TextDisplayed")
                    : Strings.Get("UnableToDisplayText"),
                succeeded ? NotifyType.StatusMessage : NotifyType.ErrorMessage);
        }
        catch (Exception ex)
        {
            _rootPage.NotifyOperationError(Strings.Get("DisplayingTextOperation"), ex);
        }
        finally
        {
            DisplayTextButton.IsEnabled = _lineDisplay is not null;
        }
    }

    private void DisposeLineDisplay()
    {
        _lineDisplay?.Dispose();
        _lineDisplay = null;
    }
}
