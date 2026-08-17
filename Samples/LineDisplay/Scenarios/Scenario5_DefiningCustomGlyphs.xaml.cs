using System;
using System.Threading.Tasks;
using Windows.Foundation;
using Microsoft.UI.Xaml.Automation;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Navigation;
using Windows.Devices.PointOfService;
using Windows.Security.Cryptography;
using Windows.Storage.Streams;

namespace SDKTemplate;

public sealed partial class Scenario5_DefiningCustomGlyphs : Page
{
    private readonly MainPage _rootPage = MainPage.Current;
    private ClaimedLineDisplay? _lineDisplay;
    private IBuffer? _glyphBuffer;

    public Scenario5_DefiningCustomGlyphs()
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
        SupportedGlyphsComboBox.Items.Clear();
        DefineGlyphButton.IsEnabled = false;
        ResetButton.IsEnabled = false;

        _lineDisplay = await _rootPage.ClaimScenarioLineDisplayAsync();
        if (_lineDisplay is null)
        {
            ResetButton.IsEnabled = true;
            return;
        }

        try
        {
            if (!_lineDisplay.Capabilities.CanDisplayCustomGlyphs)
            {
                _rootPage.NotifyUser(
                    Strings.Get("CustomGlyphsNotSupported"),
                    NotifyType.ErrorMessage);
                ResetButton.IsEnabled = true;
                return;
            }

            string sampleText = Strings.Get("GlyphSampleText");
            int index = 0;
            foreach (uint glyphCode in _lineDisplay.CustomGlyphs.SupportedGlyphCodes)
            {
                string glyph = GetGlyphText(glyphCode);
                string label = string.IsNullOrEmpty(glyph)
                    ? Strings.Format("GlyphCodeFormat", glyphCode)
                    : Strings.Format("GlyphCodeWithCharacterFormat", glyphCode, glyph);
                var item = new ComboBoxItem
                {
                    Content = label,
                    Tag = glyphCode,
                };

                AutomationProperties.SetName(item, label);
                AutomationProperties.SetAutomationId(item, $"Glyph{index++}");
                SupportedGlyphsComboBox.Items.Add(item);

                if (!string.IsNullOrEmpty(glyph) && sampleText.Length < 10)
                {
                    sampleText += glyph;
                }
            }

            if (SupportedGlyphsComboBox.Items.Count > 0)
            {
                SupportedGlyphsComboBox.SelectedIndex = 0;
            }

            Size glyphSize = _lineDisplay.CustomGlyphs.SizeInPixels;
            _glyphBuffer = CreateSolidGlyphBuffer(
                (int)glyphSize.Width,
                (int)glyphSize.Height);
            await _lineDisplay.DefaultWindow.TryDisplayTextAsync(sampleText);

            ResetButton.IsEnabled = true;
            _rootPage.NotifyUser(Strings.Get("LineDisplayReady"), NotifyType.StatusMessage);
        }
        catch (Exception ex)
        {
            DisposeLineDisplay();
            ResetButton.IsEnabled = true;
            _rootPage.NotifyOperationError(Strings.Get("ReadingCustomGlyphsOperation"), ex);
        }
    }

    private async void DefineGlyphButton_Click(object sender, Microsoft.UI.Xaml.RoutedEventArgs e)
    {
        if (_lineDisplay is null ||
            _glyphBuffer is null ||
            SupportedGlyphsComboBox.SelectedItem is null)
        {
            _rootPage.NotifyUser(Strings.Get("SelectGlyph"), NotifyType.ErrorMessage);
            return;
        }

        DefineGlyphButton.IsEnabled = false;

        try
        {
            uint glyphCode = Helpers.GetSelectedItemTag<uint>(SupportedGlyphsComboBox);
            bool succeeded =
                await _lineDisplay.CustomGlyphs.TryRedefineAsync(
                    glyphCode,
                    _glyphBuffer) &&
                await _lineDisplay.DefaultWindow.TryRefreshAsync();

            _rootPage.NotifyUser(
                succeeded
                    ? Strings.Format("GlyphRedefinedFormat", glyphCode)
                    : Strings.Get("GlyphRedefinitionFailed"),
                succeeded ? NotifyType.StatusMessage : NotifyType.ErrorMessage);
        }
        catch (Exception ex)
        {
            _rootPage.NotifyOperationError(Strings.Get("RedefiningGlyphOperation"), ex);
        }
        finally
        {
            DefineGlyphButton.IsEnabled =
                _lineDisplay is not null &&
                SupportedGlyphsComboBox.SelectedItem is not null;
        }
    }

    private async void ResetButton_Click(object sender, Microsoft.UI.Xaml.RoutedEventArgs e)
    {
        await InitializeAsync();
    }

    private void SupportedGlyphsComboBox_SelectionChanged(
        object sender,
        SelectionChangedEventArgs e)
    {
        DefineGlyphButton.IsEnabled =
            _lineDisplay is not null &&
            SupportedGlyphsComboBox.SelectedItem is not null;
    }

    private static IBuffer CreateSolidGlyphBuffer(int widthInPixels, int heightInPixels)
    {
        int bytesPerRow = (widthInPixels + 7) / 8;
        var buffer = new byte[bytesPerRow * heightInPixels];
        Array.Fill(buffer, byte.MaxValue);
        return CryptographicBuffer.CreateFromByteArray(buffer);
    }

    private static string GetGlyphText(uint glyphCode)
    {
        return glyphCode <= 0x10FFFF &&
            (glyphCode < 0xD800 || glyphCode > 0xDFFF)
                ? char.ConvertFromUtf32((int)glyphCode)
                : string.Empty;
    }

    private void DisposeLineDisplay()
    {
        _lineDisplay?.Dispose();
        _lineDisplay = null;
        _glyphBuffer = null;
    }
}
