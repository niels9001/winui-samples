using System.Runtime.InteropServices.WindowsRuntime;
using System.Text;
using Windows.Data.Json;
using Windows.Foundation;
using Windows.Storage.Streams;
using Windows.Web.Http;
using Windows.Web.Http.Headers;

namespace SDKTemplate;

public sealed class HttpJsonContent : IHttpContent
{
    private readonly byte[] content;

    public HttpJsonContent(IJsonValue value)
    {
        ArgumentNullException.ThrowIfNull(value);
        content = Encoding.UTF8.GetBytes(value.Stringify());
        Headers = new HttpContentHeaderCollection
        {
            ContentType = new HttpMediaTypeHeaderValue("application/json")
            {
                CharSet = "utf-8"
            }
        };
    }

    public HttpContentHeaderCollection Headers { get; }

    public IAsyncOperationWithProgress<ulong, ulong> BufferAllAsync()
    {
        return AsyncInfo.Run<ulong, ulong>((_, progress) =>
        {
            progress.Report((ulong)content.Length);
            return Task.FromResult((ulong)content.Length);
        });
    }

    public IAsyncOperationWithProgress<IBuffer, ulong> ReadAsBufferAsync()
    {
        return AsyncInfo.Run<IBuffer, ulong>((_, progress) =>
        {
            IBuffer buffer = content.AsBuffer();
            progress.Report(buffer.Length);
            return Task.FromResult(buffer);
        });
    }

    public IAsyncOperationWithProgress<IInputStream, ulong>
        ReadAsInputStreamAsync()
    {
        return AsyncInfo.Run<IInputStream, ulong>(
            async (token, progress) =>
            {
                var stream = new InMemoryRandomAccessStream();
                using var writer = new DataWriter(stream);
                writer.WriteBytes(content);
                await writer.StoreAsync().AsTask(token);
                writer.DetachStream();
                progress.Report((ulong)content.Length);
                return stream.GetInputStreamAt(0);
            });
    }

    public IAsyncOperationWithProgress<string, ulong> ReadAsStringAsync()
    {
        return AsyncInfo.Run<string, ulong>((_, progress) =>
        {
            progress.Report((ulong)content.Length);
            return Task.FromResult(Encoding.UTF8.GetString(content));
        });
    }

    public bool TryComputeLength(out ulong length)
    {
        length = (ulong)content.Length;
        return true;
    }

    public IAsyncOperationWithProgress<ulong, ulong> WriteToStreamAsync(
        IOutputStream outputStream)
    {
        return AsyncInfo.Run<ulong, ulong>(
            async (token, progress) =>
            {
                using var writer = new DataWriter(outputStream);
                writer.WriteBytes(content);
                uint written = await writer.StoreAsync().AsTask(token);
                writer.DetachStream();
                progress.Report(written);
                return written;
            });
    }

    public void Dispose()
    {
        GC.SuppressFinalize(this);
    }
}
