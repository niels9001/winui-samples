using System.Globalization;
using System.Runtime.InteropServices.WindowsRuntime;
using System.Text;
using System.Xml.Linq;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Navigation;
using Windows.Data.Json;
using Windows.Web.Http;
using Windows.Web.Http.Filters;
using Windows.Web.Http.Headers;
using WinHttpClient = Windows.Web.Http.HttpClient;

namespace SDKTemplate;

public sealed partial class RequestScenarioPage : Page
{
    private readonly MainPage rootPage = MainPage.Current;
    private CancellationTokenSource cancellation = new();
    private HttpScenario scenario = null!;
    private WinHttpClient? httpClient;
    private HttpBaseProtocolFilter? cacheFilter;
    private HttpMeteredConnectionFilter? meteredFilter;
    private bool cacheFilterUsed;
    private string completionMessage = "Completed.";

    public RequestScenarioPage()
    {
        InitializeComponent();
    }

    protected override void OnNavigatedTo(NavigationEventArgs e)
    {
        scenario = (HttpScenario)e.Parameter;
        cancellation = new CancellationTokenSource();
        ConfigureScenario();
        CreateClient();
    }

    protected override void OnNavigatedFrom(NavigationEventArgs e)
    {
        cancellation.Cancel();
        cancellation.Dispose();
        DisposeClient();
    }

    private void ConfigureScenario()
    {
        TitleText.Text = scenario.Title;
        BodyPanel.Visibility = Visibility.Collapsed;
        CacheOptionsPanel.Visibility = Visibility.Collapsed;
        ProgressOptionsPanel.Visibility = Visibility.Collapsed;
        ProgressPanel.Visibility = Visibility.Collapsed;
        RetryOptionsPanel.Visibility = Visibility.Collapsed;
        MeteredOptionsPanel.Visibility = Visibility.Collapsed;
        ListOutput.Visibility = Visibility.Collapsed;
        RequestBodyField.Text = "Hello from the WinUI 3 HttpClient sample.";

        switch (scenario.Kind)
        {
            case HttpScenarioKind.GetText:
                DescriptionText.Text =
                    "Download text while controlling HTTP cache read/write behavior " +
                    "and the maximum HTTP protocol version offered by the client.";
                AddressField.Text = LocalAddress("?cacheable=1");
                CacheOptionsPanel.Visibility = Visibility.Visible;
                break;
            case HttpScenarioKind.GetStream:
                DescriptionText.Text =
                    "Download a response as an unbuffered input stream and process " +
                    "its bytes incrementally.";
                AddressField.Text = LocalAddress("?extraData=2000");
                break;
            case HttpScenarioKind.GetList:
                DescriptionText.Text =
                    "Download an XML document, inspect the response, and bind its " +
                    "items to a list.";
                AddressField.Text = LocalAddress("items.xml");
                ListOutput.Visibility = Visibility.Visible;
                break;
            case HttpScenarioKind.PostText:
                DescriptionText.Text =
                    "Upload text with HttpStringContent and display the server response.";
                AddressField.Text = LocalAddress(string.Empty);
                BodyPanel.Visibility = Visibility.Visible;
                break;
            case HttpScenarioKind.PostStream:
                DescriptionText.Text =
                    "Upload generated binary data with HttpStreamContent.";
                AddressField.Text = LocalAddress(string.Empty);
                break;
            case HttpScenarioKind.PostMultipart:
                DescriptionText.Text =
                    "Upload a MIME form with HttpMultipartFormDataContent.";
                AddressField.Text = LocalAddress(string.Empty);
                BodyPanel.Visibility = Visibility.Visible;
                break;
            case HttpScenarioKind.PostStreamWithProgress:
                DescriptionText.Text =
                    "Upload a deliberately slow stream and observe HttpProgress for " +
                    "request and response transfer stages.";
                AddressField.Text = LocalAddress(string.Empty);
                ProgressOptionsPanel.Visibility = Visibility.Visible;
                ProgressPanel.Visibility = Visibility.Visible;
                break;
            case HttpScenarioKind.PostCustomContent:
                DescriptionText.Text =
                    "Upload JSON through a managed implementation of IHttpContent.";
                AddressField.Text = LocalAddress(string.Empty);
                BodyPanel.Visibility = Visibility.Visible;
                RequestBodyField.Text = "{\"score\":100,\"enabled\":false}";
                break;
            case HttpScenarioKind.RetryFilter:
                DescriptionText.Text =
                    "Use a managed IHttpFilter to retry a 503 response according to " +
                    "its Retry-After header.";
                RetryOptionsPanel.Visibility = Visibility.Visible;
                UpdateRetryAddress();
                break;
            case HttpScenarioKind.MeteredConnectionFilter:
                DescriptionText.Text =
                    "Use a managed IHttpFilter to allow requests according to the " +
                    "connection cost, request priority, and explicit opt-in.";
                AddressField.Text = LocalAddress(string.Empty);
                MeteredOptionsPanel.Visibility = Visibility.Visible;
                break;
            default:
                throw new InvalidOperationException(
                    $"Unsupported request scenario: {scenario.Kind}.");
        }
    }

    private void CreateClient()
    {
        DisposeClient();

        switch (scenario.Kind)
        {
            case HttpScenarioKind.GetText:
                CreateCacheClient();
                break;
            case HttpScenarioKind.PostStreamWithProgress:
            case HttpScenarioKind.PostCustomContent:
                httpClient = new WinHttpClient();
                break;
            case HttpScenarioKind.RetryFilter:
                httpClient = new WinHttpClient(
                    new HttpRetryFilter(new HttpBaseProtocolFilter()));
                break;
            case HttpScenarioKind.MeteredConnectionFilter:
                meteredFilter = new HttpMeteredConnectionFilter(
                    new HttpBaseProtocolFilter());
                httpClient = new WinHttpClient(meteredFilter);
                break;
            default:
                httpClient = Helpers.CreateHttpClientWithPlugIn();
                break;
        }
    }

    private void CreateCacheClient()
    {
        cacheFilter = new HttpBaseProtocolFilter
        {
            MaxVersion = MaxHttpVersionToggle.IsOn
                ? HttpVersion.Http20
                : HttpVersion.Http11
        };
        MaxHttpVersionToggle.IsOn =
            cacheFilter.MaxVersion == HttpVersion.Http20;
        httpClient = new WinHttpClient(cacheFilter);
        cacheFilterUsed = false;
    }

    private void DisposeClient()
    {
        httpClient?.Dispose();
        httpClient = null;
        cacheFilter?.Dispose();
        cacheFilter = null;
        meteredFilter?.Dispose();
        meteredFilter = null;
    }

    private async void Start_Click(object sender, RoutedEventArgs e)
    {
        Uri? resourceUri = Helpers.TryParseHttpUri(AddressField.Text);
        if (resourceUri is null)
        {
            rootPage.NotifyUser("Enter a valid HTTP or HTTPS URI.", NotifyType.ErrorMessage);
            return;
        }

        if (httpClient is null)
        {
            rootPage.NotifyUser("The HTTP client is not available.", NotifyType.ErrorMessage);
            return;
        }

        CancellationToken token = cancellation.Token;
        completionMessage = "Completed.";
        Helpers.ScenarioStarted(StartButton, CancelButton, OutputField);
        ListOutput.ItemsSource = null;
        rootPage.NotifyUser("In progress", NotifyType.StatusMessage);

        try
        {
            bool succeeded = scenario.Kind switch
            {
                HttpScenarioKind.GetText =>
                    await RunGetTextAsync(resourceUri, token),
                HttpScenarioKind.GetStream =>
                    await RunGetStreamAsync(resourceUri, token),
                HttpScenarioKind.GetList =>
                    await RunGetListAsync(resourceUri, token),
                HttpScenarioKind.PostText =>
                    await RunPostTextAsync(resourceUri, token),
                HttpScenarioKind.PostStream =>
                    await RunPostStreamAsync(resourceUri, token),
                HttpScenarioKind.PostMultipart =>
                    await RunPostMultipartAsync(resourceUri, token),
                HttpScenarioKind.PostStreamWithProgress =>
                    await RunPostWithProgressAsync(resourceUri, token),
                HttpScenarioKind.PostCustomContent =>
                    await RunPostCustomContentAsync(resourceUri, token),
                HttpScenarioKind.RetryFilter =>
                    await RunGetAsync(resourceUri, token),
                HttpScenarioKind.MeteredConnectionFilter =>
                    await RunMeteredRequestAsync(resourceUri, token),
                _ => throw new InvalidOperationException(
                    $"Unsupported request scenario: {scenario.Kind}.")
            };

            if (succeeded)
            {
                rootPage.NotifyUser(completionMessage, NotifyType.StatusMessage);
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
            Helpers.ScenarioCompleted(StartButton, CancelButton);
        }
    }

    private async Task<bool> RunGetTextAsync(
        Uri resourceUri,
        CancellationToken token)
    {
        if (cacheFilter is null || httpClient is null)
        {
            throw new InvalidOperationException("The cache filter is unavailable.");
        }

        cacheFilter.CacheControl.ReadBehavior = CacheReadCombo.SelectedIndex switch
        {
            1 => HttpCacheReadBehavior.MostRecent,
            2 => HttpCacheReadBehavior.OnlyFromCache,
            3 => HttpCacheReadBehavior.NoCache,
            _ => HttpCacheReadBehavior.Default
        };
        cacheFilter.CacheControl.WriteBehavior =
            CacheWriteCombo.SelectedIndex == 1
                ? HttpCacheWriteBehavior.NoCache
                : HttpCacheWriteBehavior.Default;
        cacheFilterUsed = true;

        HttpRequestResult result =
            await httpClient.TryGetAsync(resourceUri).AsTask(token);
        if (!result.Succeeded)
        {
            Helpers.DisplayWebError(rootPage, result.ExtendedError);
            return false;
        }

        using HttpResponseMessage response = result.ResponseMessage;
        await Helpers.DisplayTextResultAsync(response, OutputField, token);
        completionMessage =
            $"Completed from {response.Source} using {response.Version}.";
        return true;
    }

    private async Task<bool> RunGetStreamAsync(
        Uri resourceUri,
        CancellationToken token)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, resourceUri);
        HttpRequestResult result = await httpClient!.TrySendRequestAsync(
                request,
                HttpCompletionOption.ResponseHeadersRead)
            .AsTask(token);
        if (!result.Succeeded)
        {
            Helpers.DisplayWebError(rootPage, result.ExtendedError);
            return false;
        }

        using HttpResponseMessage response = result.ResponseMessage;
        OutputField.Text = Helpers.SerializeHeaders(response);
        using Stream responseStream =
            (await response.Content.ReadAsInputStreamAsync())
            .AsStreamForRead();
        byte[] buffer = new byte[512];
        int totalBytes = 0;
        var firstBytes = new List<byte>();

        while (true)
        {
            int read = await responseStream.ReadAsync(buffer, token);
            if (read == 0)
            {
                break;
            }

            totalBytes += read;
            int bytesToKeep = Math.Min(read, 128 - firstBytes.Count);
            if (bytesToKeep > 0)
            {
                firstBytes.AddRange(buffer.AsSpan(0, bytesToKeep).ToArray());
            }
        }

        OutputField.Text +=
            $"Bytes read from stream: {totalBytes}{Environment.NewLine}" +
            $"First {firstBytes.Count} bytes (hex):{Environment.NewLine}" +
            Convert.ToHexString(firstBytes.ToArray());
        return true;
    }

    private async Task<bool> RunGetListAsync(
        Uri resourceUri,
        CancellationToken token)
    {
        HttpRequestResult result =
            await httpClient!.TryGetAsync(resourceUri).AsTask(token);
        if (!result.Succeeded)
        {
            Helpers.DisplayWebError(rootPage, result.ExtendedError);
            return false;
        }

        using HttpResponseMessage response = result.ResponseMessage;
        response.EnsureSuccessStatusCode();
        string xml = await response.Content.ReadAsStringAsync().AsTask(token);
        OutputField.Text = Helpers.SerializeHeaders(response) + xml;
        XElement root = XElement.Parse(xml);
        ListOutput.ItemsSource = root.Elements("item")
            .Select(item => item.Attribute("name")?.Value ?? "(unnamed)")
            .ToList();
        return true;
    }

    private async Task<bool> RunPostTextAsync(
        Uri resourceUri,
        CancellationToken token)
    {
        using var content = new HttpStringContent(RequestBodyField.Text);
        return await PostAndDisplayAsync(resourceUri, content, token);
    }

    private async Task<bool> RunPostStreamAsync(
        Uri resourceUri,
        CancellationToken token)
    {
        byte[] data = Enumerable.Repeat((byte)'@', 1_000).ToArray();
        using var stream = new MemoryStream(data);
        using var content = new HttpStreamContent(stream.AsInputStream());
        using var request = new HttpRequestMessage(HttpMethod.Post, resourceUri)
        {
            Content = content
        };
        HttpRequestResult result =
            await httpClient!.TrySendRequestAsync(request).AsTask(token);
        return await DisplayResultAsync(result, token);
    }

    private async Task<bool> RunPostMultipartAsync(
        Uri resourceUri,
        CancellationToken token)
    {
        using var form = new HttpMultipartFormDataContent();
        form.Add(
            new HttpStringContent(RequestBodyField.Text),
            "sampleData");
        return await PostAndDisplayAsync(resourceUri, form, token);
    }

    private async Task<bool> RunPostWithProgressAsync(
        Uri resourceUri,
        CancellationToken token)
    {
        const uint streamLength = 100_000;
        using var content = new HttpStreamContent(
            new SlowInputStream(streamLength));
        if (!ChunkedRequestToggle.IsOn)
        {
            content.Headers.ContentLength = streamLength;
        }

        var progress = new Progress<HttpProgress>(UpdateProgress);
        HttpRequestResult result = await httpClient!
            .TryPostAsync(resourceUri, content)
            .AsTask(token, progress);
        bool succeeded = await DisplayResultAsync(result, token);
        if (succeeded)
        {
            RequestProgressBar.Value = 100;
        }

        return succeeded;
    }

    private async Task<bool> RunPostCustomContentAsync(
        Uri resourceUri,
        CancellationToken token)
    {
        using var content =
            new HttpJsonContent(JsonValue.Parse(RequestBodyField.Text));
        return await PostAndDisplayAsync(resourceUri, content, token);
    }

    private async Task<bool> RunGetAsync(
        Uri resourceUri,
        CancellationToken token)
    {
        if (scenario.Kind == HttpScenarioKind.RetryFilter)
        {
            string separator = string.IsNullOrEmpty(resourceUri.Query)
                ? "?"
                : "&";
            resourceUri = new Uri(
                resourceUri +
                $"{separator}operation={Guid.NewGuid():N}");
        }

        HttpRequestResult result =
            await httpClient!.TryGetAsync(resourceUri).AsTask(token);
        return await DisplayResultAsync(result, token);
    }

    private async Task<bool> RunMeteredRequestAsync(
        Uri resourceUri,
        CancellationToken token)
    {
        if (meteredFilter is null)
        {
            throw new InvalidOperationException(
                "The metered connection filter is unavailable.");
        }

        meteredFilter.OptIn = MeteredOptInToggle.IsOn;
        var request = new HttpRequestMessage(HttpMethod.Get, resourceUri);
        request.Properties[
            HttpMeteredConnectionFilter.MeteredConnectionPriorityPropertyName] =
            PriorityCombo.SelectedIndex;

        HttpRequestResult result =
            await httpClient!.TrySendRequestAsync(request).AsTask(token);
        OutputField.Text =
            $"Connection behavior: {meteredFilter.CurrentBehavior}" +
            Environment.NewLine + Environment.NewLine;
        bool succeeded = await DisplayResultAsync(result, token, append: true);
        request.Dispose();
        return succeeded;
    }

    private async Task<bool> PostAndDisplayAsync(
        Uri resourceUri,
        IHttpContent content,
        CancellationToken token)
    {
        HttpRequestResult result =
            await httpClient!.TryPostAsync(resourceUri, content).AsTask(token);
        return await DisplayResultAsync(result, token);
    }

    private async Task<bool> DisplayResultAsync(
        HttpRequestResult result,
        CancellationToken token,
        bool append = false)
    {
        if (!result.Succeeded)
        {
            Helpers.DisplayWebError(rootPage, result.ExtendedError);
            return false;
        }

        using HttpResponseMessage response = result.ResponseMessage;
        if (!append)
        {
            OutputField.Text = string.Empty;
        }

        await Helpers.DisplayTextResultAsync(response, OutputField, token);
        return true;
    }

    private void UpdateProgress(HttpProgress progress)
    {
        ProgressText.Text =
            $"Stage: {progress.Stage}; retries: {progress.Retries}; " +
            $"sent: {progress.BytesSent}/" +
            $"{FormatNullable(progress.TotalBytesToSend)} bytes; received: " +
            $"{progress.BytesReceived}/" +
            $"{FormatNullable(progress.TotalBytesToReceive)} bytes";

        double percentage = progress.Stage switch
        {
            HttpProgressStage.SendingContent
                when progress.TotalBytesToSend is ulong total && total > 0 =>
                    progress.BytesSent * 50d / total,
            HttpProgressStage.ReceivingContent
                when progress.TotalBytesToReceive is ulong total && total > 0 =>
                    50d + progress.BytesReceived * 50d / total,
            HttpProgressStage.ReceivingHeaders => 50d,
            _ => RequestProgressBar.Value
        };
        RequestProgressBar.Value = Math.Clamp(percentage, 0, 100);
    }

    private static string FormatNullable(ulong? value)
    {
        return value?.ToString(CultureInfo.InvariantCulture) ?? "unknown";
    }

    private void Cancel_Click(object sender, RoutedEventArgs e)
    {
        cancellation.Cancel();
        cancellation.Dispose();
        cancellation = new CancellationTokenSource();
    }

    private void MaxHttpVersionToggle_Toggled(
        object sender,
        RoutedEventArgs e)
    {
        if (scenario?.Kind != HttpScenarioKind.GetText ||
            cacheFilter is null)
        {
            return;
        }

        if (cacheFilterUsed)
        {
            DisposeClient();
            CreateCacheClient();
            return;
        }

        cacheFilter.MaxVersion = MaxHttpVersionToggle.IsOn
            ? HttpVersion.Http20
            : HttpVersion.Http11;
    }

    private void ChunkedResponseToggle_Toggled(
        object sender,
        RoutedEventArgs e)
    {
        if (scenario?.Kind == HttpScenarioKind.PostStreamWithProgress)
        {
            AddressField.Text = LocalAddress(
                ChunkedResponseToggle.IsOn
                    ? "?chunkedResponse=1"
                    : string.Empty);
        }
    }

    private void RetryAfterToggle_Toggled(
        object sender,
        RoutedEventArgs e)
    {
        if (scenario?.Kind == HttpScenarioKind.RetryFilter)
        {
            UpdateRetryAddress();
        }
    }

    private void UpdateRetryAddress()
    {
        AddressField.Text = LocalAddress(
            RetryAfterToggle.IsOn
                ? "?retryAfter=delta"
                : "?retryAfter=date");
    }

    private static string LocalAddress(string relativePath)
    {
        return App.TestServerStartupError is null
            ? App.TestServer.CreateUri(relativePath).ToString()
            : string.Empty;
    }
}
