using System.Runtime.InteropServices.WindowsRuntime;
using Windows.Foundation;
using Windows.Web.Http;
using Windows.Web.Http.Filters;

namespace SDKTemplate;

public sealed class PlugInFilter : IHttpFilter
{
    private readonly IHttpFilter innerFilter;

    public PlugInFilter(IHttpFilter innerFilter)
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
                request.Headers.TryAppendWithoutValidation(
                    "X-WinUI-Sample",
                    "Request");
                HttpResponseMessage response = await innerFilter
                    .SendRequestAsync(request)
                    .AsTask(token, progress);
                token.ThrowIfCancellationRequested();
                response.Headers.TryAppendWithoutValidation(
                    "X-WinUI-Sample",
                    "Response");
                return response;
            });
    }

    public void Dispose()
    {
        innerFilter.Dispose();
        GC.SuppressFinalize(this);
    }
}
