using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Windows.Data.Json;

namespace SDKTemplate;

public sealed partial class MainPage : Page
{
    private JsonUser CurrentUser
    {
        get => (JsonUser)DataContext;
        set => DataContext = value;
    }

    public MainPage()
    {
        InitializeComponent();
        ParseJson();
    }

    private void Parse_Click(object sender, RoutedEventArgs e)
    {
        ParseJson();
    }

    private void Stringify_Click(object sender, RoutedEventArgs e)
    {
        try
        {
            JsonInput.Text = CurrentUser.Stringify();
            NotifyUser(
                "Object values serialized successfully.",
                InfoBarSeverity.Success);
        }
        catch (Exception ex)
        {
            NotifyOperationError("Serializing the JSON object", ex);
        }
    }

    private void AddSchool_Click(object sender, RoutedEventArgs e)
    {
        CurrentUser.Education.Add(new School());
        NotifyUser("School added.", InfoBarSeverity.Success);
    }

    private void DeleteSchool_Click(object sender, RoutedEventArgs e)
    {
        if (sender is FrameworkElement element &&
            element.DataContext is School school)
        {
            CurrentUser.Education.Remove(school);
            NotifyUser("School removed.", InfoBarSeverity.Success);
        }
    }

    private void ParseJson()
    {
        try
        {
            CurrentUser = new JsonUser(JsonInput.Text);
            NotifyUser(
                "JSON parsed successfully.",
                InfoBarSeverity.Success);
        }
        catch (Exception ex)
        {
            JsonErrorStatus status = JsonError.GetJsonStatus(ex.HResult);
            if (status == JsonErrorStatus.Unknown)
            {
                NotifyOperationError("Parsing the JSON string", ex);
            }
            else
            {
                NotifyUser(
                    $"{status}: {ex.Message}",
                    InfoBarSeverity.Error);
            }
        }
    }

    private void NotifyOperationError(string operation, Exception exception)
    {
        NotifyUser(
            $"{operation} failed (0x{exception.HResult:X8}): {exception.Message}",
            InfoBarSeverity.Error);
    }

    private void NotifyUser(string message, InfoBarSeverity severity)
    {
        StatusInfoBar.Message = message;
        StatusInfoBar.Severity = severity;
        StatusInfoBar.IsOpen = true;
    }
}
