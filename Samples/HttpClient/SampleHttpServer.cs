using System.Collections.Concurrent;
using System.Globalization;
using System.Net;
using System.Net.Sockets;
using System.Text;

namespace SDKTemplate;

internal sealed class SampleHttpServer : IDisposable
{
    private const int MaximumHeaderLineLength = 16 * 1024;
    private const int MaximumRequestBodyLength = 1024 * 1024;

    private readonly TcpListener listener;
    private readonly CancellationTokenSource cancellation = new();
    private readonly ConcurrentDictionary<string, int> retryCounts = new();
    private readonly Task serverTask;
    private int requestNumber;

    private SampleHttpServer(TcpListener listener)
    {
        this.listener = listener;
        int port = ((IPEndPoint)listener.LocalEndpoint).Port;
        BaseUri = new Uri($"http://127.0.0.1:{port}/");
        serverTask = Task.Run(() => AcceptRequestsAsync(cancellation.Token));
    }

    public Uri BaseUri { get; }

    public Exception? LastError { get; private set; }

    public static SampleHttpServer Start()
    {
        var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        return new SampleHttpServer(listener);
    }

    public Uri CreateUri(string relativePath)
    {
        return new Uri(BaseUri, relativePath.TrimStart('/'));
    }

    public void Dispose()
    {
        cancellation.Cancel();
        listener.Stop();
        cancellation.Dispose();
        GC.SuppressFinalize(this);
    }

    private async Task AcceptRequestsAsync(CancellationToken token)
    {
        while (!token.IsCancellationRequested)
        {
            try
            {
                using TcpClient client =
                    await listener.AcceptTcpClientAsync(token);
                await HandleClientAsync(client, token);
            }
            catch (OperationCanceledException) when (token.IsCancellationRequested)
            {
                return;
            }
            catch (SocketException) when (token.IsCancellationRequested)
            {
                return;
            }
            catch (Exception ex) when (
                ex is IOException or InvalidDataException or FormatException)
            {
                LastError = ex;
            }
        }
    }

    private async Task HandleClientAsync(
        TcpClient client,
        CancellationToken token)
    {
        NetworkStream stream = client.GetStream();
        HttpRequestData? request = await ReadRequestAsync(stream, token);
        if (request is null)
        {
            return;
        }

        Uri requestUri = CreateUri(request.Target);
        Dictionary<string, string> query = ParseQuery(requestUri.Query);
        var responseHeaders = new List<KeyValuePair<string, string>>();
        string body;
        int statusCode = 200;
        string reasonPhrase = "OK";

        if (requestUri.AbsolutePath.Equals(
            "/items.xml",
            StringComparison.OrdinalIgnoreCase))
        {
            responseHeaders.Add(new("Content-Type", "application/xml; charset=utf-8"));
            body =
                "<items><item name=\"First item\"/><item name=\"Second item\"/>" +
                "<item name=\"Third item\"/></items>";
        }
        else
        {
            responseHeaders.Add(new("Content-Type", "text/plain; charset=utf-8"));
            body = CreateEchoBody(request, requestUri);
        }

        if (query.TryGetValue("cacheable", out string? cacheable) &&
            cacheable == "1")
        {
            responseHeaders.Add(new("Cache-Control", "public, max-age=30"));
            responseHeaders.Add(new(
                "Last-Modified",
                DateTimeOffset.UtcNow.AddMinutes(-1)
                    .ToString("R", CultureInfo.InvariantCulture)));
            body +=
                $"{Environment.NewLine}Server request number: " +
                Interlocked.Increment(ref requestNumber);
        }

        if (query.TryGetValue("extraData", out string? extraDataText) &&
            int.TryParse(
                extraDataText,
                NumberStyles.None,
                CultureInfo.InvariantCulture,
                out int extraDataLength))
        {
            body += Environment.NewLine +
                new string('@', Math.Clamp(extraDataLength, 0, 100_000));
        }

        if (query.TryGetValue("setCookies", out string? setCookies) &&
            setCookies == "1")
        {
            responseHeaders.Add(new(
                "Set-Cookie",
                "SampleCookie1=FirstValue; Path=/; SameSite=Lax"));
            responseHeaders.Add(new(
                "Set-Cookie",
                "SampleCookie2=SecondValue; Path=/; HttpOnly; SameSite=Lax"));
        }

        if (query.TryGetValue("retryAfter", out string? retryAfter))
        {
            int attempt = retryCounts.AddOrUpdate(
                request.Target,
                1,
                (_, current) => current + 1);

            if ((attempt & 1) == 1)
            {
                statusCode = 503;
                reasonPhrase = "Service Unavailable";
                responseHeaders.Add(new(
                    "Retry-After",
                    retryAfter == "date"
                        ? DateTimeOffset.UtcNow.AddSeconds(1)
                            .ToString("R", CultureInfo.InvariantCulture)
                        : "1"));
                body = "The first request returns 503 so the retry filter can resend it.";
            }
            else
            {
                body += $"{Environment.NewLine}Retry attempt: {attempt / 2}";
            }
        }

        bool useChunkedResponse =
            query.TryGetValue("chunkedResponse", out string? chunked) &&
            chunked == "1";
        if (useChunkedResponse)
        {
            body += Environment.NewLine + new string('#', 24_000);
        }

        await WriteResponseAsync(
            stream,
            statusCode,
            reasonPhrase,
            responseHeaders,
            body,
            useChunkedResponse,
            token);
    }

    private static string CreateEchoBody(
        HttpRequestData request,
        Uri requestUri)
    {
        var output = new StringBuilder();
        output.AppendLine($"Method: {request.Method}");
        output.AppendLine($"Target: {requestUri.PathAndQuery}");
        output.AppendLine("Request headers:");

        foreach ((string name, string value) in request.Headers)
        {
            output.AppendLine($"{name}: {value}");
        }

        output.AppendLine();
        output.AppendLine($"Request body length: {request.Body.Length}");
        if (request.Body.Length > 0)
        {
            string requestBody = Encoding.UTF8.GetString(request.Body);
            output.AppendLine(requestBody.Length > 2_000
                ? requestBody[..2_000] + "..."
                : requestBody);
        }

        return output.ToString();
    }

    private static async Task<HttpRequestData?> ReadRequestAsync(
        NetworkStream stream,
        CancellationToken token)
    {
        string? requestLine = await ReadLineAsync(stream, token);
        if (string.IsNullOrWhiteSpace(requestLine))
        {
            return null;
        }

        string[] requestParts = requestLine.Split(' ', 3);
        if (requestParts.Length != 3)
        {
            throw new InvalidDataException("The HTTP request line is malformed.");
        }

        var headers =
            new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        while (true)
        {
            string? headerLine = await ReadLineAsync(stream, token);
            if (headerLine is null)
            {
                throw new InvalidDataException(
                    "The HTTP request ended before its headers were complete.");
            }

            if (headerLine.Length == 0)
            {
                break;
            }

            int colon = headerLine.IndexOf(':');
            if (colon <= 0)
            {
                throw new InvalidDataException("An HTTP header is malformed.");
            }

            headers[headerLine[..colon].Trim()] =
                headerLine[(colon + 1)..].Trim();
        }

        byte[] body = [];
        if (headers.TryGetValue("Transfer-Encoding", out string? encoding) &&
            encoding.Contains("chunked", StringComparison.OrdinalIgnoreCase))
        {
            body = await ReadChunkedBodyAsync(stream, token);
        }
        else if (headers.TryGetValue(
            "Content-Length",
            out string? contentLengthText))
        {
            if (!int.TryParse(
                    contentLengthText,
                    NumberStyles.None,
                    CultureInfo.InvariantCulture,
                    out int contentLength) ||
                contentLength < 0 ||
                contentLength > MaximumRequestBodyLength)
            {
                throw new InvalidDataException(
                    "The HTTP request has an invalid content length.");
            }

            body = await ReadExactlyAsync(stream, contentLength, token);
        }

        return new HttpRequestData(
            requestParts[0],
            requestParts[1],
            headers,
            body);
    }

    private static async Task<byte[]> ReadChunkedBodyAsync(
        NetworkStream stream,
        CancellationToken token)
    {
        using var body = new MemoryStream();

        while (true)
        {
            string sizeLine = await ReadLineAsync(stream, token) ??
                throw new InvalidDataException(
                    "The chunked request ended before a chunk size was received.");
            string sizeText = sizeLine.Split(';', 2)[0];
            if (!int.TryParse(
                    sizeText,
                    NumberStyles.HexNumber,
                    CultureInfo.InvariantCulture,
                    out int chunkSize) ||
                chunkSize < 0 ||
                body.Length + chunkSize > MaximumRequestBodyLength)
            {
                throw new InvalidDataException(
                    "The chunked request has an invalid chunk size.");
            }

            if (chunkSize == 0)
            {
                while (!string.IsNullOrEmpty(
                    await ReadLineAsync(stream, token)))
                {
                }

                return body.ToArray();
            }

            byte[] chunk = await ReadExactlyAsync(stream, chunkSize, token);
            await body.WriteAsync(chunk, token);

            if (!string.IsNullOrEmpty(await ReadLineAsync(stream, token)))
            {
                throw new InvalidDataException(
                    "A chunk was not followed by a valid terminator.");
            }
        }
    }

    private static async Task<byte[]> ReadExactlyAsync(
        NetworkStream stream,
        int length,
        CancellationToken token)
    {
        byte[] bytes = new byte[length];
        int offset = 0;

        while (offset < length)
        {
            int read = await stream.ReadAsync(
                bytes.AsMemory(offset, length - offset),
                token);
            if (read == 0)
            {
                throw new InvalidDataException(
                    "The HTTP request body ended unexpectedly.");
            }

            offset += read;
        }

        return bytes;
    }

    private static async Task<string?> ReadLineAsync(
        NetworkStream stream,
        CancellationToken token)
    {
        var bytes = new List<byte>();
        byte[] singleByte = new byte[1];

        while (bytes.Count <= MaximumHeaderLineLength)
        {
            int read = await stream.ReadAsync(singleByte, token);
            if (read == 0)
            {
                return bytes.Count == 0
                    ? null
                    : Encoding.ASCII.GetString(bytes.ToArray());
            }

            if (singleByte[0] == (byte)'\n')
            {
                if (bytes.Count > 0 && bytes[^1] == (byte)'\r')
                {
                    bytes.RemoveAt(bytes.Count - 1);
                }

                return Encoding.ASCII.GetString(bytes.ToArray());
            }

            bytes.Add(singleByte[0]);
        }

        throw new InvalidDataException("An HTTP header line is too long.");
    }

    private static async Task WriteResponseAsync(
        NetworkStream stream,
        int statusCode,
        string reasonPhrase,
        IReadOnlyList<KeyValuePair<string, string>> additionalHeaders,
        string body,
        bool chunked,
        CancellationToken token)
    {
        byte[] bodyBytes = Encoding.UTF8.GetBytes(body);
        var headers = new StringBuilder();
        headers.AppendLine($"HTTP/1.1 {statusCode} {reasonPhrase}");
        headers.AppendLine(
            $"Date: {DateTimeOffset.UtcNow.ToString("R", CultureInfo.InvariantCulture)}");
        headers.AppendLine("Server: WinUI-HttpClient-Sample");
        headers.AppendLine("Connection: close");

        foreach ((string name, string value) in additionalHeaders)
        {
            headers.AppendLine($"{name}: {value}");
        }

        if (chunked)
        {
            headers.AppendLine("Transfer-Encoding: chunked");
        }
        else
        {
            headers.AppendLine(
                $"Content-Length: {bodyBytes.Length.ToString(CultureInfo.InvariantCulture)}");
        }

        headers.AppendLine();
        await stream.WriteAsync(
            Encoding.ASCII.GetBytes(headers.ToString()),
            token);

        if (!chunked)
        {
            await stream.WriteAsync(bodyBytes, token);
            return;
        }

        const int chunkSize = 2_048;
        for (int offset = 0; offset < bodyBytes.Length; offset += chunkSize)
        {
            int count = Math.Min(chunkSize, bodyBytes.Length - offset);
            string prefix =
                count.ToString("X", CultureInfo.InvariantCulture) + "\r\n";
            await stream.WriteAsync(Encoding.ASCII.GetBytes(prefix), token);
            await stream.WriteAsync(
                bodyBytes.AsMemory(offset, count),
                token);
            await stream.WriteAsync("\r\n"u8.ToArray(), token);
            await Task.Delay(20, token);
        }

        await stream.WriteAsync("0\r\n\r\n"u8.ToArray(), token);
    }

    private static Dictionary<string, string> ParseQuery(string query)
    {
        var values =
            new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        foreach (string pair in query.TrimStart('?').Split(
            '&',
            StringSplitOptions.RemoveEmptyEntries))
        {
            string[] parts = pair.Split('=', 2);
            values[Uri.UnescapeDataString(parts[0])] =
                parts.Length == 2
                    ? Uri.UnescapeDataString(parts[1])
                    : string.Empty;
        }

        return values;
    }

    private sealed record HttpRequestData(
        string Method,
        string Target,
        IReadOnlyDictionary<string, string> Headers,
        byte[] Body);
}
