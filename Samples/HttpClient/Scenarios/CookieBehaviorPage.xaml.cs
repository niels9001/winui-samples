using System.Text;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Navigation;
using Windows.Web.Http;
using Windows.Web.Http.Filters;
using WinHttpClient = Windows.Web.Http.HttpClient;

namespace SDKTemplate;

public sealed partial class CookieBehaviorPage : Page
{
    private readonly MainPage rootPage = MainPage.Current;
    private readonly HttpBaseProtocolFilter filter = new();
    private CancellationTokenSource cancellation = new();
    private WinHttpClient? httpClient;

    public CookieBehaviorPage()
    {
        InitializeComponent();
    }

    protected override void OnNavigatedTo(NavigationEventArgs e)
    {
        cancellation = new CancellationTokenSource();
        httpClient = new WinHttpClient(filter);
        AddressField.Text = App.TestServerStartupError is null
            ? App.TestServer.CreateUri("?setCookies=1").ToString()
            : string.Empty;
    }

    protected override void OnNavigatedFrom(NavigationEventArgs e)
    {
        cancellation.Cancel();
        cancellation.Dispose();
        httpClient?.Dispose();
        filter.Dispose();
    }

    private async void InitialRequestButton_Click(
        object sender,
        RoutedEventArgs e)
    {
        Uri? resourceUri = ValidateAddress();
        if (resourceUri is null)
        {
            return;
        }

        bool succeeded = await SendRequestAsync(
            resourceUri,
            InitialRequestButton,
            displayCookies: true);
        if (succeeded)
        {
            NextRequestButton.IsEnabled = true;
        }
    }

    private async void NextRequestButton_Click(
        object sender,
        RoutedEventArgs e)
    {
        Uri? resourceUri = ValidateAddress();
        if (resourceUri is null)
        {
            return;
        }

        filter.CookieUsageBehavior = CookieUsageToggle.IsOn
            ? HttpCookieUsageBehavior.Default
            : HttpCookieUsageBehavior.NoCookies;
        await SendRequestAsync(
            resourceUri,
            NextRequestButton,
            displayCookies: false);
    }

    private async Task<bool> SendRequestAsync(
        Uri resourceUri,
        Button initiatingButton,
        bool displayCookies)
    {
        CancellationToken token = cancellation.Token;
        Helpers.ScenarioStarted(initiatingButton, CancelButton, OutputField);
        rootPage.NotifyUser("In progress", NotifyType.StatusMessage);

        try
        {
            HttpRequestResult result =
                await httpClient!.TryGetAsync(resourceUri).AsTask(token);
            if (!result.Succeeded)
            {
                Helpers.DisplayWebError(rootPage, result.ExtendedError);
                return false;
            }

            using HttpResponseMessage response = result.ResponseMessage;
            if (displayCookies)
            {
                HttpCookieCollection cookies =
                    filter.CookieManager.GetCookies(resourceUri);
                var output = new StringBuilder();
                output.AppendLine($"{cookies.Count} cookie(s) received:");
                foreach (HttpCookie cookie in cookies)
                {
                    output.AppendLine($"{cookie.Name}={cookie.Value}");
                }

                OutputField.Text = output.ToString();
            }
            else
            {
                await Helpers.DisplayTextResultAsync(
                    response,
                    OutputField,
                    token);
            }

            rootPage.NotifyUser("Completed.", NotifyType.StatusMessage);
            return true;
        }
        catch (OperationCanceledException)
        {
            rootPage.NotifyUser("Request canceled.", NotifyType.ErrorMessage);
            return false;
        }
        catch (Exception ex)
        {
            rootPage.NotifyOperationError("Sending the HTTP request", ex);
            return false;
        }
        finally
        {
            Helpers.ScenarioCompleted(initiatingButton, CancelButton);
        }
    }

    private Uri? ValidateAddress()
    {
        Uri? resourceUri = Helpers.TryParseHttpUri(AddressField.Text);
        if (resourceUri is null)
        {
            rootPage.NotifyUser(
                "Enter a valid HTTP or HTTPS URI.",
                NotifyType.ErrorMessage);
        }

        return resourceUri;
    }

    private void CancelButton_Click(object sender, RoutedEventArgs e)
    {
        cancellation.Cancel();
        cancellation.Dispose();
        cancellation = new CancellationTokenSource();
    }
}
