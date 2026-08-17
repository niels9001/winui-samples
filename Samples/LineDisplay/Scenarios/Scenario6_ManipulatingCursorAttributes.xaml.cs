using System;
using System.Globalization;
using System.Threading.Tasks;
using Windows.Foundation;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Automation;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Navigation;
using Windows.Devices.PointOfService;

namespace SDKTemplate;

public sealed partial class Scenario6_ManipulatingCursorAttributes : Page
{
    private readonly MainPage _rootPage = MainPage.Current;
    private ClaimedLineDisplay? _lineDisplay;

    public Scenario6_ManipulatingCursorAttributes()
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
        CursorTypeComboBox.Items.Clear();

        _lineDisplay = await _rootPage.ClaimScenarioLineDisplayAsync();
        if (_lineDisplay is null)
        {
            ResetButton.IsEnabled = true;
            return;
        }

        try
        {
            bool canCustomize = _lineDisplay.DefaultWindow.Cursor.CanCustomize;
            CursorTypeComboBox.IsEnabled = canCustomize;
            if (canCustomize)
            {
                AddSupportedCursorTypes();
            }

            LineDisplayCursorAttributes attributes =
                _lineDisplay.DefaultWindow.Cursor.GetAttributes();
            AutoAdvanceCheckBox.IsChecked = attributes.IsAutoAdvanceEnabled;
            BlinkCursorCheckBox.IsChecked = attributes.IsBlinkEnabled;
            CursorPositionXTextBox.Text =
                attributes.Position.X.ToString(CultureInfo.CurrentCulture);
            CursorPositionYTextBox.Text =
                attributes.Position.Y.ToString(CultureInfo.CurrentCulture);
            SelectCursorType(attributes.CursorType);

            AutoAdvanceCheckBox.IsEnabled = true;
            BlinkCursorCheckBox.IsEnabled =
                _lineDisplay.DefaultWindow.Cursor.IsBlinkSupported;
            SetCursorPositionCheckBox.IsEnabled = true;
            UpdateButton.IsEnabled = true;
            DisplayTextButton.IsEnabled = true;
            ResetButton.IsEnabled = true;
            _rootPage.NotifyUser(Strings.Get("LineDisplayReady"), NotifyType.StatusMessage);
        }
        catch (Exception ex)
        {
            DisposeLineDisplay();
            DisableControls();
            ResetButton.IsEnabled = true;
            _rootPage.NotifyOperationError(Strings.Get("ReadingCursorOperation"), ex);
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
            LineDisplayCursorAttributes attributes =
                _lineDisplay.DefaultWindow.Cursor.GetAttributes();
            attributes.IsAutoAdvanceEnabled = AutoAdvanceCheckBox.IsChecked == true;

            if (_lineDisplay.DefaultWindow.Cursor.CanCustomize &&
                CursorTypeComboBox.SelectedItem is not null)
            {
                attributes.CursorType =
                    Helpers.GetSelectedItemTag<LineDisplayCursorType>(CursorTypeComboBox);
            }

            if (_lineDisplay.DefaultWindow.Cursor.IsBlinkSupported)
            {
                attributes.IsBlinkEnabled = BlinkCursorCheckBox.IsChecked == true;
            }

            if (SetCursorPositionCheckBox.IsChecked == true)
            {
                var position = new Point(
                    Helpers.ParseUnsignedIntegerWithFallback(
                        CursorPositionXTextBox,
                        -1),
                    Helpers.ParseUnsignedIntegerWithFallback(
                        CursorPositionYTextBox,
                        -1));
                Size windowSize = _lineDisplay.DefaultWindow.SizeInCharacters;
                if (position.X < 0 ||
                    position.X >= windowSize.Width ||
                    position.Y < 0 ||
                    position.Y >= windowSize.Height)
                {
                    _rootPage.NotifyUser(
                        Strings.Get("CursorPositionOutsideWindow"),
                        NotifyType.ErrorMessage);
                    return;
                }

                attributes.Position = position;
            }

            bool succeeded =
                await _lineDisplay.DefaultWindow.Cursor.TryUpdateAttributesAsync(attributes);
            _rootPage.NotifyUser(
                succeeded
                    ? Strings.Get("CursorUpdated")
                    : Strings.Get("CursorUpdateFailed"),
                succeeded ? NotifyType.StatusMessage : NotifyType.ErrorMessage);
        }
        catch (Exception ex)
        {
            _rootPage.NotifyOperationError(Strings.Get("UpdatingCursorOperation"), ex);
        }
        finally
        {
            UpdateButton.IsEnabled = _lineDisplay is not null;
        }
    }

    private async void DisplayTextButton_Click(object sender, RoutedEventArgs e)
    {
        if (_lineDisplay is null)
        {
            return;
        }

        try
        {
            bool succeeded = await _lineDisplay.DefaultWindow.TryDisplayTextAsync(
                Strings.Get("CursorSampleText"));
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
    }

    private async void ResetButton_Click(object sender, RoutedEventArgs e)
    {
        await InitializeAsync();
    }

    private void AddSupportedCursorTypes()
    {
        if (_lineDisplay is null)
        {
            return;
        }

        if (_lineDisplay.DefaultWindow.Cursor.IsBlockSupported)
        {
            AddCursorType(LineDisplayCursorType.Block, "CursorTypeBlock");
        }

        if (_lineDisplay.DefaultWindow.Cursor.IsHalfBlockSupported)
        {
            AddCursorType(LineDisplayCursorType.HalfBlock, "CursorTypeHalfBlock");
        }

        if (_lineDisplay.DefaultWindow.Cursor.IsOtherSupported)
        {
            AddCursorType(LineDisplayCursorType.Other, "CursorTypeOther");
        }

        if (_lineDisplay.DefaultWindow.Cursor.IsReverseSupported)
        {
            AddCursorType(LineDisplayCursorType.Reverse, "CursorTypeReverse");
        }

        if (_lineDisplay.DefaultWindow.Cursor.IsUnderlineSupported)
        {
            AddCursorType(LineDisplayCursorType.Underline, "CursorTypeUnderline");
        }

        if (CursorTypeComboBox.Items.Count > 0)
        {
            CursorTypeComboBox.SelectedIndex = 0;
        }
    }

    private void AddCursorType(LineDisplayCursorType cursorType, string resourceId)
    {
        string label = Strings.Get(resourceId);
        var item = new ComboBoxItem
        {
            Content = label,
            Tag = cursorType,
        };

        AutomationProperties.SetName(item, label);
        AutomationProperties.SetAutomationId(item, $"CursorType{cursorType}");
        CursorTypeComboBox.Items.Add(item);
    }

    private void SelectCursorType(LineDisplayCursorType cursorType)
    {
        foreach (object item in CursorTypeComboBox.Items)
        {
            if (item is ComboBoxItem comboBoxItem &&
                comboBoxItem.Tag is LineDisplayCursorType itemType &&
                itemType == cursorType)
            {
                CursorTypeComboBox.SelectedItem = comboBoxItem;
                break;
            }
        }
    }

    private void DisableControls()
    {
        CursorTypeComboBox.IsEnabled = false;
        AutoAdvanceCheckBox.IsEnabled = false;
        BlinkCursorCheckBox.IsEnabled = false;
        SetCursorPositionCheckBox.IsEnabled = false;
        UpdateButton.IsEnabled = false;
        DisplayTextButton.IsEnabled = false;
        ResetButton.IsEnabled = false;
    }

    private void DisposeLineDisplay()
    {
        _lineDisplay?.Dispose();
        _lineDisplay = null;
    }
}
