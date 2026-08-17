using System;
using System.Threading.Tasks;
using Windows.Foundation;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Automation;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Navigation;
using Windows.Devices.PointOfService;

namespace SDKTemplate;

public sealed partial class Scenario4_UpdatingLineDisplayAttributes : Page
{
    private readonly MainPage _rootPage = MainPage.Current;
    private ClaimedLineDisplay? _lineDisplay;

    public Scenario4_UpdatingLineDisplayAttributes()
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
        DisableControls();
        SupportedScreenSizesComboBox.Items.Clear();

        _lineDisplay = await _rootPage.ClaimScenarioLineDisplayAsync();
        if (_lineDisplay is null)
        {
            return;
        }

        try
        {
            BlinkRateSlider.IsEnabled = _lineDisplay.Capabilities.CanChangeBlinkRate;
            BrightnessSlider.IsEnabled = _lineDisplay.Capabilities.IsBrightnessSupported;
            SupportedScreenSizesComboBox.IsEnabled =
                _lineDisplay.Capabilities.CanChangeScreenSize;
            CharacterSetMappingEnabledCheckBox.IsEnabled =
                _lineDisplay.Capabilities.CanMapCharacterSets;

            if (SupportedScreenSizesComboBox.IsEnabled)
            {
                int index = 0;
                foreach (Size screenSize in _lineDisplay.SupportedScreenSizesInCharacters)
                {
                    string label = Strings.Format(
                        "ScreenSizeFormat",
                        screenSize.Width,
                        screenSize.Height);
                    var item = new ComboBoxItem
                    {
                        Content = label,
                        Tag = screenSize,
                    };

                    AutomationProperties.SetName(item, label);
                    AutomationProperties.SetAutomationId(item, $"ScreenSize{index++}");
                    SupportedScreenSizesComboBox.Items.Add(item);
                }

                if (SupportedScreenSizesComboBox.Items.Count > 0)
                {
                    SupportedScreenSizesComboBox.SelectedIndex = 0;
                }
            }

            SetValuesFromLineDisplay();
            UpdateButton.IsEnabled = true;

            LineDisplayTextAttribute attribute =
                _lineDisplay.Capabilities.CanBlink ==
                LineDisplayTextAttributeGranularity.NotSupported
                    ? LineDisplayTextAttribute.Normal
                    : LineDisplayTextAttribute.Blink;
            await _lineDisplay.DefaultWindow.TryDisplayTextAsync(
                Strings.Get("AttributeSampleText"),
                attribute);

            _rootPage.NotifyUser(Strings.Get("LineDisplayReady"), NotifyType.StatusMessage);
        }
        catch (Exception ex)
        {
            DisposeLineDisplay();
            DisableControls();
            _rootPage.NotifyOperationError(Strings.Get("ReadingAttributesOperation"), ex);
        }
    }

    private async void UpdateButton_Click(object sender, RoutedEventArgs e)
    {
        if (_lineDisplay is null)
        {
            _rootPage.NotifyUser(Strings.Get("SelectLineDisplayFirst"), NotifyType.ErrorMessage);
            return;
        }

        UpdateButton.IsEnabled = false;

        try
        {
            LineDisplayAttributes attributes = _lineDisplay.GetAttributes();

            if (_lineDisplay.Capabilities.CanChangeBlinkRate)
            {
                attributes.BlinkRate = TimeSpan.FromMilliseconds(BlinkRateSlider.Value);
            }

            if (_lineDisplay.Capabilities.IsBrightnessSupported)
            {
                attributes.Brightness = (int)BrightnessSlider.Value;
            }

            if (_lineDisplay.Capabilities.CanChangeScreenSize)
            {
                if (SupportedScreenSizesComboBox.SelectedItem is null)
                {
                    _rootPage.NotifyUser(
                        Strings.Get("SelectScreenSize"),
                        NotifyType.ErrorMessage);
                    return;
                }

                attributes.ScreenSizeInCharacters =
                    Helpers.GetSelectedItemTag<Size>(SupportedScreenSizesComboBox);
            }

            if (_lineDisplay.Capabilities.CanMapCharacterSets)
            {
                attributes.IsCharacterSetMappingEnabled =
                    CharacterSetMappingEnabledCheckBox.IsChecked == true;
            }

            bool succeeded = await _lineDisplay.TryUpdateAttributesAsync(attributes);
            if (succeeded)
            {
                SetValuesFromLineDisplay();
            }

            _rootPage.NotifyUser(
                succeeded
                    ? Strings.Get("AttributesUpdated")
                    : Strings.Get("AttributesUpdateFailed"),
                succeeded ? NotifyType.StatusMessage : NotifyType.ErrorMessage);
        }
        catch (Exception ex)
        {
            _rootPage.NotifyOperationError(Strings.Get("UpdatingAttributesOperation"), ex);
        }
        finally
        {
            UpdateButton.IsEnabled = _lineDisplay is not null;
        }
    }

    private void SetValuesFromLineDisplay()
    {
        if (_lineDisplay is null)
        {
            return;
        }

        LineDisplayAttributes attributes = _lineDisplay.GetAttributes();
        BlinkRateSlider.Value = attributes.BlinkRate.TotalMilliseconds;
        BrightnessSlider.Value = attributes.Brightness;
        CharacterSetMappingEnabledCheckBox.IsChecked =
            attributes.IsCharacterSetMappingEnabled;
    }

    private void DisableControls()
    {
        BlinkRateSlider.IsEnabled = false;
        BrightnessSlider.IsEnabled = false;
        SupportedScreenSizesComboBox.IsEnabled = false;
        CharacterSetMappingEnabledCheckBox.IsEnabled = false;
        UpdateButton.IsEnabled = false;
    }

    private void DisposeLineDisplay()
    {
        _lineDisplay?.Dispose();
        _lineDisplay = null;
    }
}
