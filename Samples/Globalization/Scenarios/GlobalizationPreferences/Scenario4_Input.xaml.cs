using System;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;

namespace SDKTemplate;

public sealed partial class Scenario4_Input : Page
{
    private readonly MainPage rootPage = MainPage.Current;

    public Scenario4_Input()
    {
        InitializeComponent();
    }

    private void ShowResults_Click(object sender, RoutedEventArgs e)
    {
        try
        {
            OutputTextBox.Text =
                Windows.Globalization.Language.CurrentInputMethodLanguageTag;
            rootPage.NotifyUser(
                "Current input language retrieved.",
                NotifyType.StatusMessage);
        }
        catch (Exception ex)
        {
            rootPage.NotifyOperationError(
                "Retrieving the current input language",
                ex);
        }
    }
}
