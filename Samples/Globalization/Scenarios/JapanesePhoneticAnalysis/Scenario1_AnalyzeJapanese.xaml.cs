using System.Text;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Windows.Globalization;

namespace SDKTemplate;

public sealed partial class Scenario1_AnalyzeJapanese : Page
{
    private readonly MainPage rootPage = MainPage.Current;

    public Scenario1_AnalyzeJapanese()
    {
        InitializeComponent();
    }

    private void AnalyzeButton_Click(object sender, RoutedEventArgs e)
    {
        try
        {
            string input = InputTextBox.Text;
            bool usePronunciationUnits =
                PronunciationRadioButton.IsChecked == true;
            IReadOnlyList<JapanesePhoneme> phonemes =
                JapanesePhoneticAnalyzer.GetWords(
                    input,
                    usePronunciationUnits);

            if (input.Length > 0 && phonemes.Count == 0)
            {
                OutputTextBox.Text = string.Empty;
                rootPage.NotifyUser(
                    "No result was returned. JapanesePhoneticAnalyzer accepts at most 100 characters.",
                    NotifyType.ErrorMessage);
                return;
            }

            var output = new StringBuilder();
            foreach (JapanesePhoneme phoneme in phonemes)
            {
                if (output.Length > 0 && phoneme.IsPhraseStart)
                {
                    output.AppendLine();
                }

                output.Append(phoneme.DisplayText);
                output.Append(" (");
                output.Append(phoneme.YomiText);
                output.Append(") ");
            }

            OutputTextBox.Text = output.ToString().TrimEnd();
            rootPage.NotifyUser(
                $"Analysis returned {phonemes.Count} segment(s).",
                NotifyType.StatusMessage);
        }
        catch (Exception ex)
        {
            rootPage.NotifyOperationError(
                "Analyzing Japanese text",
                ex);
        }
    }
}
