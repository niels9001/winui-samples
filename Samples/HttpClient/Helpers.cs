using System.Text;
using Microsoft.UI.Xaml.Controls;
using Windows.Web;
using Windows.Web.Http;
using Windows.Web.Http.Filters;
using Windows.Web.Http.Headers;
using WinHttpClient = Windows.Web.Http.HttpClient;

namespace SDKTemplate;

internal static class Helpers
{
    internal static async Task DisplayTextResultAsync(
        HttpResponseMessage response,
        TextBox output,
        CancellationToken token)
    {
        output.Text += SerializeHeaders(response);
        string responseBody =
            await response.Content.ReadAsStringAsync().AsTask(token);
        token.ThrowIfCancellationRequested();
        output.Text += responseBody.Replace(
            "<br>",
            Environment.NewLine,
            StringComparison.OrdinalIgnoreCase);
    }

    internal static void DisplayWebError(
        MainPage rootPage,
        Exception exception)
    {
        WebErrorStatus status = WebError.GetStatus(exception.HResult);
        string message = status == WebErrorStatus.Unknown
            ? $"Unknown web error (0x{exception.HResult:X8}): {exception.Message}"
            : $"Web error: {status}";
        rootPage.NotifyUser(message, NotifyType.ErrorMessage);
    }

    internal static string SerializeHeaders(HttpResponseMessage response)
    {
        var output = new StringBuilder();
        output.AppendLine(
            $"{(int)response.StatusCode} {response.ReasonPhrase}");
        SerializeHeaderCollection(response.Headers, output);
        SerializeHeaderCollection(response.Content.Headers, output);
        output.AppendLine();
        return output.ToString();
    }

    internal static WinHttpClient CreateHttpClientWithPlugIn()
    {
        IHttpFilter filter = new HttpBaseProtocolFilter();
        filter = new PlugInFilter(filter);
        var client = new WinHttpClient(filter);
        client.DefaultRequestHeaders.UserAgent.Add(
            new HttpProductInfoHeaderValue("WinUIHttpClientSample", "1.0"));
        return client;
    }

    internal static void ScenarioStarted(
        Button startButton,
        Button cancelButton,
        TextBox? output)
    {
        startButton.IsEnabled = false;
        cancelButton.IsEnabled = true;
        if (output is not null)
        {
            output.Text = string.Empty;
        }
    }

    internal static void ScenarioCompleted(
        Button startButton,
        Button cancelButton)
    {
        startButton.IsEnabled = true;
        cancelButton.IsEnabled = false;
    }

    internal static Uri? TryParseHttpUri(string value)
    {
        if (!Uri.TryCreate(value.Trim(), UriKind.Absolute, out Uri? uri))
        {
            return null;
        }

        return uri.Scheme is "http" or "https" ? uri : null;
    }

    private static void SerializeHeaderCollection(
        IEnumerable<KeyValuePair<string, string>> headers,
        StringBuilder output)
    {
        foreach ((string name, string value) in headers)
        {
            output.AppendLine($"{name}: {value}");
        }
    }
}
