using System.Runtime.InteropServices.WindowsRuntime;
using Windows.Foundation;
using Windows.Web.Http;
using Windows.Web.Http.Filters;

namespace SDKTemplate;

public sealed class HttpRetryFilter : IHttpFilter
{
    private const int MaximumRetries = 3;
    private readonly IHttpFilter innerFilter;

    public HttpRetryFilter(IHttpFilter innerFilter)
    {
        this.innerFilter = innerFilter ??
            throw new ArgumentNullException(nameof(innerFilter));
    }

    public IAsyncOperationWithProgress<HttpResponseMessage, HttpProgress>
        SendRequestAsync(HttpRequestMessage request)
    {
        return AsyncInfo.Run<HttpResponseMessage, HttpProgress>(
            async (token, progress) =>
            {
                HttpRequestMessage currentRequest = request;
                int retries = 0;

                while (true)
                {
                    var operation = innerFilter.SendRequestAsync(currentRequest);
                    var requestProgress = new Progress<HttpProgress>(value =>
                    {
                        value.Retries += (uint)retries;
                        progress.Report(value);
                    });
                    HttpResponseMessage response = await operation.AsTask(
                        token,
                        requestProgress);

                    if (response.StatusCode != HttpStatusCode.ServiceUnavailable ||
                        response.Headers.RetryAfter is null ||
                        retries >= MaximumRetries)
                    {
                        return response;
                    }

                    TimeSpan delay = GetRetryDelay(response);
                    response.Dispose();
                    await Task.Delay(delay, token);

                    retries++;
                    currentRequest = CopyRequest(request);
                }
            });
    }

    public void Dispose()
    {
        innerFilter.Dispose();
        GC.SuppressFinalize(this);
    }

    private static TimeSpan GetRetryDelay(HttpResponseMessage response)
    {
        var retryAfter = response.Headers.RetryAfter;
        TimeSpan delay = retryAfter.Delta ??
            retryAfter.Date.GetValueOrDefault() - DateTimeOffset.Now;
        return delay > TimeSpan.Zero ? delay : TimeSpan.Zero;
    }

    private static HttpRequestMessage CopyRequest(HttpRequestMessage source)
    {
        var copy = new HttpRequestMessage(source.Method, source.RequestUri);
        foreach ((string name, string value) in source.Headers)
        {
            if (!copy.Headers.TryAppendWithoutValidation(name, value))
            {
                copy.Dispose();
                throw new InvalidOperationException(
                    $"Unable to copy the '{name}' request header.");
            }
        }

        foreach ((string name, object value) in source.Properties)
        {
            copy.Properties[name] = value;
        }

        return copy;
    }
}
