using System;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Windows.Globalization;
using Windows.System.UserProfile;

namespace SDKTemplate;

public sealed partial class Scenario2_Lang : Page
{
    private readonly MainPage rootPage = MainPage.Current;

    public Scenario2_Lang()
    {
        InitializeComponent();
    }

    private void ShowResults_Click(object sender, RoutedEventArgs e)
    {
        try
        {
            if (GlobalizationPreferences.Languages.Count == 0)
            {
                rootPage.NotifyUser(
                    "Windows did not report a preferred language.",
                    NotifyType.ErrorMessage);
                return;
            }

            var userLanguage =
                new Language(GlobalizationPreferences.Languages[0]);
            var exampleLanguage = new Language("ja");

            OutputTextBox.Text =
                "User's preferred language" + Environment.NewLine +
                ReportLanguageData(userLanguage) +
                Environment.NewLine + Environment.NewLine +
                "Example language from BCP-47 tag (ja)" + Environment.NewLine +
                ReportLanguageData(exampleLanguage);

            rootPage.NotifyUser(
                "Language characteristics retrieved.",
                NotifyType.StatusMessage);
        }
        catch (Exception ex)
        {
            rootPage.NotifyOperationError(
                "Retrieving language characteristics",
                ex);
        }
    }

    private static string ReportLanguageData(Language language)
    {
        return
            $"Display name: {language.DisplayName}{Environment.NewLine}" +
            $"Language tag: {language.LanguageTag}{Environment.NewLine}" +
            $"Native name: {language.NativeName}{Environment.NewLine}" +
            $"Script code: {language.Script}";
    }
}
