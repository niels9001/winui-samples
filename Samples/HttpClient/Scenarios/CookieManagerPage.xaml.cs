using System.Text;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Navigation;
using Windows.Web.Http;
using Windows.Web.Http.Filters;
using WinHttpClient = Windows.Web.Http.HttpClient;

namespace SDKTemplate;

public sealed partial class CookieManagerPage : Page
{
    private readonly MainPage rootPage = MainPage.Current;
    private readonly HttpBaseProtocolFilter filter = new();
    private CancellationTokenSource cancellation = new();
    private WinHttpClient? httpClient;
    private HttpScenario scenario = null!;

    public CookieManagerPage()
    {
        InitializeComponent();
    }

    protected override void OnNavigatedTo(NavigationEventArgs e)
    {
        scenario = (HttpScenario)e.Parameter;
        cancellation = new CancellationTokenSource();
        httpClient = new WinHttpClient(filter);
        ConfigureScenario();
    }

    protected override void OnNavigatedFrom(NavigationEventArgs e)
    {
        cancellation.Cancel();
        cancellation.Dispose();
        httpClient?.Dispose();
        filter.Dispose();
    }

    private void ConfigureScenario()
    {
        TitleText.Text = scenario.Title;
        AddressField.Text = App.TestServerStartupError is null
            ? App.TestServer.CreateUri("?setCookies=1").ToString()
            : string.Empty;
        AddressPanel.Visibility = Visibility.Collapsed;
        CookieFields.Visibility = Visibility.Collapsed;
        SecondaryButton.Visibility = Visibility.Collapsed;
        CancelButton.Visibility = Visibility.Collapsed;
        OutputField.Visibility = Visibility.Collapsed;

        switch (scenario.Kind)
        {
            case HttpScenarioKind.GetCookies:
                DescriptionText.Text =
                    "Inspect the cookies that HttpCookieManager would send to an " +
                    "address, or send a request whose response sets two cookies.";
                AddressPanel.Visibility = Visibility.Visible;
                SecondaryButton.Visibility = Visibility.Visible;
                CancelButton.Visibility = Visibility.Visible;
                OutputField.Visibility = Visibility.Visible;
                PrimaryButton.Content = "Get stored cookies";
                SecondaryButton.Content = "Send HTTP GET";
                break;
            case HttpScenarioKind.SetCookie:
                DescriptionText.Text =
                    "Add a cookie to HttpCookieManager or replace a cookie with " +
                    "the same name, domain, and path.";
                CookieFields.Visibility = Visibility.Visible;
                OutputField.Visibility = Visibility.Visible;
                PrimaryButton.Content = "Set cookie";
                break;
            case HttpScenarioKind.DeleteCookie:
                DescriptionText.Text =
                    "Delete a cookie identified by its name, domain, and path.";
                CookieFields.Visibility = Visibility.Visible;
                ValueField.IsEnabled = false;
                PersistentCookieToggle.IsEnabled = false;
                SecureToggle.IsEnabled = false;
                HttpOnlyToggle.IsEnabled = false;
                OutputField.Visibility = Visibility.Visible;
                PrimaryButton.Content = "Delete cookie";
                break;
            default:
                throw new InvalidOperationException(
                    $"Unsupported cookie scenario: {scenario.Kind}.");
        }
    }

    private void PrimaryButton_Click(object sender, RoutedEventArgs e)
    {
        switch (scenario.Kind)
        {
            case HttpScenarioKind.GetCookies:
                GetCookies();
                break;
            case HttpScenarioKind.SetCookie:
                SetCookie();
                break;
            case HttpScenarioKind.DeleteCookie:
                DeleteCookie();
                break;
        }
    }

    private async void SecondaryButton_Click(
        object sender,
        RoutedEventArgs e)
    {
        Uri? resourceUri = Helpers.TryParseHttpUri(AddressField.Text);
        if (resourceUri is null)
        {
            rootPage.NotifyUser(
                "Enter a valid HTTP or HTTPS URI.",
                NotifyType.ErrorMessage);
            return;
        }

        CancellationToken token = cancellation.Token;
        Helpers.ScenarioStarted(SecondaryButton, CancelButton, OutputField);
        rootPage.NotifyUser("In progress", NotifyType.StatusMessage);

        try
        {
            HttpRequestResult result =
                await httpClient!.TryGetAsync(resourceUri).AsTask(token);
            if (result.Succeeded)
            {
                using HttpResponseMessage response = result.ResponseMessage;
                await Helpers.DisplayTextResultAsync(
                    response,
                    OutputField,
                    token);
                rootPage.NotifyUser(
                    "Request completed. Use 'Get stored cookies' to inspect the result.",
                    NotifyType.StatusMessage);
            }
            else
            {
                Helpers.DisplayWebError(rootPage, result.ExtendedError);
            }
        }
        catch (OperationCanceledException)
        {
            rootPage.NotifyUser("Request canceled.", NotifyType.ErrorMessage);
        }
        catch (Exception ex)
        {
            rootPage.NotifyOperationError("Sending the HTTP request", ex);
        }
        finally
        {
            Helpers.ScenarioCompleted(SecondaryButton, CancelButton);
        }
    }

    private void GetCookies()
    {
        Uri? resourceUri = Helpers.TryParseHttpUri(AddressField.Text);
        if (resourceUri is null)
        {
            rootPage.NotifyUser(
                "Enter a valid HTTP or HTTPS URI.",
                NotifyType.ErrorMessage);
            return;
        }

        try
        {
            HttpCookieCollection cookies =
                filter.CookieManager.GetCookies(resourceUri);
            OutputField.Text = FormatCookies(cookies);
            rootPage.NotifyUser(
                $"{cookies.Count} cookie(s) found.",
                NotifyType.StatusMessage);
        }
        catch (Exception ex)
        {
            rootPage.NotifyOperationError("Reading cookies", ex);
        }
    }

    private void SetCookie()
    {
        if (!TryCreateCookie(out HttpCookie? cookie) || cookie is null)
        {
            return;
        }

        try
        {
            bool replaced = filter.CookieManager.SetCookie(cookie, false);
            OutputField.Text =
                $"{cookie.Name}={cookie.Value}{Environment.NewLine}" +
                $"Domain: {cookie.Domain}{Environment.NewLine}" +
                $"Path: {cookie.Path}{Environment.NewLine}" +
                $"Expires: {cookie.Expires?.ToString() ?? "session"}";
            rootPage.NotifyUser(
                replaced ? "Cookie replaced." : "Cookie set.",
                NotifyType.StatusMessage);
        }
        catch (Exception ex)
        {
            rootPage.NotifyOperationError("Setting the cookie", ex);
        }
    }

    private void DeleteCookie()
    {
        if (!TryCreateCookie(out HttpCookie? cookie) || cookie is null)
        {
            return;
        }

        try
        {
            filter.CookieManager.DeleteCookie(cookie);
            OutputField.Text =
                $"Deleted {cookie.Name} for {cookie.Domain}{cookie.Path}.";
            rootPage.NotifyUser("Cookie deleted.", NotifyType.StatusMessage);
        }
        catch (Exception ex)
        {
            rootPage.NotifyOperationError("Deleting the cookie", ex);
        }
    }

    private bool TryCreateCookie(out HttpCookie? cookie)
    {
        cookie = null;
        if (string.IsNullOrWhiteSpace(NameField.Text) ||
            string.IsNullOrWhiteSpace(DomainField.Text) ||
            string.IsNullOrWhiteSpace(PathField.Text))
        {
            rootPage.NotifyUser(
                "Name, domain, and path are required.",
                NotifyType.ErrorMessage);
            return false;
        }

        try
        {
            cookie = new HttpCookie(
                NameField.Text.Trim(),
                DomainField.Text.Trim(),
                PathField.Text.Trim())
            {
                Value = ValueField.Text,
                Expires = PersistentCookieToggle.IsOn
                    ? DateTimeOffset.Now.AddHours(1)
                    : null,
                Secure = SecureToggle.IsOn,
                HttpOnly = HttpOnlyToggle.IsOn
            };
            return true;
        }
        catch (ArgumentException ex)
        {
            rootPage.NotifyUser(ex.Message, NotifyType.ErrorMessage);
            return false;
        }
    }

    private static string FormatCookies(HttpCookieCollection cookies)
    {
        var output = new StringBuilder();
        output.AppendLine($"{cookies.Count} cookie(s) found.");

        foreach (HttpCookie cookie in cookies)
        {
            output.AppendLine("--------------------");
            output.AppendLine($"Name: {cookie.Name}");
            output.AppendLine($"Domain: {cookie.Domain}");
            output.AppendLine($"Path: {cookie.Path}");
            output.AppendLine($"Value: {cookie.Value}");
            output.AppendLine($"Expires: {cookie.Expires}");
            output.AppendLine($"Secure: {cookie.Secure}");
            output.AppendLine($"HttpOnly: {cookie.HttpOnly}");
        }

        return output.ToString();
    }

    private void CancelButton_Click(object sender, RoutedEventArgs e)
    {
        cancellation.Cancel();
        cancellation.Dispose();
        cancellation = new CancellationTokenSource();
    }
}
