using System.Collections.Concurrent;
using System.Diagnostics;
using System.Net;
using System.Net.Security;
using System.Net.Sockets;
using System.Net.WebSockets;
using System.Security.Authentication;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Text;

namespace SDKTemplate;

internal sealed class LoopbackWebSocketServer : IAsyncDisposable
{
    private const string CertificateIssuerName = "www.fabrikam.com";

    private const int MaximumHeaderBytes = 16 * 1024;
    private const int MaximumHeaderLineBytes = 8 * 1024;
    private const int MaximumMessageBytes = 64 * 1024;
    private const string WebSocketProtocolGuid = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

    private readonly CancellationTokenSource _cancellation = new();
    private readonly ConcurrentDictionary<int, Task> _connections = new();
    private readonly X509Certificate2 _rootCertificate;
    private readonly X509Certificate2 _serverCertificate;
    private readonly X509Certificate2 _clientCertificate;
    private readonly byte[] _rootCertificateHash;
    private readonly byte[] _serverCertificateHash;
    private readonly SslStreamCertificateContext _serverCertificateContext;
    private readonly TcpListener _plainListener;
    private readonly TcpListener _secureListener;
    private readonly TcpListener _clientAuthenticationListener;
    private readonly Task[] _acceptLoops;
    private int _connectionId;
    private int _isDisposed;

    private LoopbackWebSocketServer(
        CertificateBundle certificates,
        TcpListener plainListener,
        TcpListener secureListener,
        TcpListener clientAuthenticationListener)
    {
        _rootCertificate = certificates.RootCertificate;
        _serverCertificate = certificates.ServerCertificate;
        _clientCertificate = certificates.ClientCertificate;
        _rootCertificateHash =
            _rootCertificate.GetCertHash(HashAlgorithmName.SHA256);
        _serverCertificateHash =
            _serverCertificate.GetCertHash(HashAlgorithmName.SHA256);
        ClientCertificatePfxData = certificates.ClientCertificatePfxData;
        ClientCertificatePassword = certificates.ClientCertificatePassword;
        ClientCertificateFriendlyName =
            $"WebSocketSampleClientCert-{Guid.NewGuid():N}";
        _serverCertificateContext = SslStreamCertificateContext.Create(
            _serverCertificate,
            new X509Certificate2Collection(_rootCertificate));

        _plainListener = plainListener;
        _secureListener = secureListener;
        _clientAuthenticationListener = clientAuthenticationListener;

        PlainMessageUri = CreateUri("ws", plainListener, "message");
        PlainStreamUri = CreateUri("ws", plainListener, "stream");
        PlainPartialMessageUri = CreateUri("ws", plainListener, "partial");
        SecureMessageUri = CreateUri("wss", secureListener, "message");
        SecureStreamUri = CreateUri("wss", secureListener, "stream");
        SecurePartialMessageUri = CreateUri("wss", secureListener, "partial");
        ClientAuthenticationUri = CreateUri(
            "wss",
            clientAuthenticationListener,
            "client-authentication");

        _acceptLoops =
        [
            AcceptLoopAsync(plainListener, ListenerKind.Plain, _cancellation.Token),
            AcceptLoopAsync(secureListener, ListenerKind.Secure, _cancellation.Token),
            AcceptLoopAsync(
                clientAuthenticationListener,
                ListenerKind.ClientAuthentication,
                _cancellation.Token),
        ];
    }

    internal event EventHandler<string>? Diagnostic;

    internal Uri PlainMessageUri { get; }

    internal Uri PlainStreamUri { get; }

    internal Uri PlainPartialMessageUri { get; }

    internal Uri SecureMessageUri { get; }

    internal Uri SecureStreamUri { get; }

    internal Uri SecurePartialMessageUri { get; }

    internal Uri ClientAuthenticationUri { get; }

    internal string ClientCertificatePfxData { get; }

    internal string ClientCertificatePassword { get; }

    internal string ClientCertificateFriendlyName { get; }

    internal Exception? LastError { get; private set; }

    internal string? LastDiagnostic { get; private set; }

    internal static LoopbackWebSocketServer Start()
    {
        CertificateBundle? certificates = null;
        TcpListener? plainListener = null;
        TcpListener? secureListener = null;
        TcpListener? clientAuthenticationListener = null;

        try
        {
            certificates = CreateCertificates();
            plainListener = StartListener();
            secureListener = StartListener();
            clientAuthenticationListener = StartListener();

            return new LoopbackWebSocketServer(
                certificates,
                plainListener,
                secureListener,
                clientAuthenticationListener);
        }

        catch
        {
            plainListener?.Stop();
            secureListener?.Stop();
            clientAuthenticationListener?.Stop();
            certificates?.Dispose();
            throw;
        }
    }

    internal bool IsGeneratedSecureEndpoint(Uri uri)
    {
        return uri == SecureMessageUri ||
            uri == SecureStreamUri ||
            uri == SecurePartialMessageUri ||
            uri == ClientAuthenticationUri;
    }

    internal bool IsClientAuthenticationEndpoint(Uri uri)
    {
        return uri == ClientAuthenticationUri;
    }

    internal bool MatchesGeneratedServerCertificateChain(
        Windows.Security.Cryptography.Certificates.Certificate serverCertificate,
        IReadOnlyList<Windows.Security.Cryptography.Certificates.Certificate>
            intermediateCertificates)
    {
        if (!CryptographicOperations.FixedTimeEquals(
                _serverCertificateHash,
                serverCertificate.GetHashValue("SHA256")))
        {
            return false;
        }

        foreach (Windows.Security.Cryptography.Certificates.Certificate
            certificate in intermediateCertificates)
        {
            if (!CryptographicOperations.FixedTimeEquals(
                    _rootCertificateHash,
                    certificate.GetHashValue("SHA256")))
            {
                return false;
            }
        }

        return true;
    }

    public async ValueTask DisposeAsync()
    {
        if (Interlocked.Exchange(ref _isDisposed, 1) != 0)
        {
            return;
        }

        await _cancellation.CancelAsync();
        _plainListener.Stop();
        _secureListener.Stop();
        _clientAuthenticationListener.Stop();

        await AwaitExpectedCancellationAsync(Task.WhenAll(_acceptLoops));
        await AwaitExpectedCancellationAsync(Task.WhenAll(_connections.Values));

        _clientCertificate.Dispose();
        _serverCertificate.Dispose();
        _rootCertificate.Dispose();
        _cancellation.Dispose();
        GC.SuppressFinalize(this);
    }

    private static TcpListener StartListener()
    {
        var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Server.ExclusiveAddressUse = true;
        listener.Start();
        return listener;
    }

    private static Uri CreateUri(
        string scheme,
        TcpListener listener,
        string path)
    {
        int port = ((IPEndPoint)listener.LocalEndpoint).Port;
        return new Uri($"{scheme}://127.0.0.1:{port}/{path}");
    }

    private async Task AcceptLoopAsync(
        TcpListener listener,
        ListenerKind listenerKind,
        CancellationToken cancellationToken)
    {
        while (!cancellationToken.IsCancellationRequested)
        {
            TcpClient client;
            try
            {
                client = await listener.AcceptTcpClientAsync(cancellationToken);
            }
            catch (OperationCanceledException)
                when (cancellationToken.IsCancellationRequested)
            {
                return;
            }
            catch (ObjectDisposedException)
                when (cancellationToken.IsCancellationRequested)
            {
                return;
            }
            catch (SocketException)
                when (cancellationToken.IsCancellationRequested)
            {
                return;
            }
            catch (SocketException exception)
            {
                ReportDiagnostic(exception);
                continue;
            }

            int connectionId = Interlocked.Increment(ref _connectionId);
            Task connection = HandleClientAsync(
                client,
                listenerKind,
                cancellationToken);
            _connections.TryAdd(connectionId, connection);
            _ = ObserveConnectionAsync(connectionId, connection);
        }
    }

    private async Task ObserveConnectionAsync(int connectionId, Task connection)
    {
        try
        {
            await connection;
        }
        catch (OperationCanceledException)
            when (_cancellation.IsCancellationRequested)
        {
        }
        catch (ObjectDisposedException)
            when (_cancellation.IsCancellationRequested)
        {
        }
        catch (Exception exception)
        {
            ReportDiagnostic(exception);
        }
        finally
        {
            _connections.TryRemove(connectionId, out _);
        }
    }

    private async Task HandleClientAsync(
        TcpClient client,
        ListenerKind listenerKind,
        CancellationToken cancellationToken)
    {
        using (client)
        using (NetworkStream networkStream = client.GetStream())
        {
            if (listenerKind == ListenerKind.Plain)
            {
                await HandleWebSocketAsync(
                    networkStream,
                    requiresClientCertificate: false,
                    cancellationToken);
                return;
            }

            bool requiresClientCertificate =
                listenerKind == ListenerKind.ClientAuthentication;
            using var secureStream = new SslStream(
                networkStream,
                leaveInnerStreamOpen: false,
                requiresClientCertificate
                    ? ValidateClientCertificate
                    : null);

            await secureStream.AuthenticateAsServerAsync(
                new SslServerAuthenticationOptions
                {
                    ServerCertificateContext = _serverCertificateContext,
                    ClientCertificateRequired = requiresClientCertificate,
                    EnabledSslProtocols = SslProtocols.Tls12 | SslProtocols.Tls13,
                    CertificateRevocationCheckMode = X509RevocationMode.NoCheck,
                },
                cancellationToken);

            await HandleWebSocketAsync(
                secureStream,
                requiresClientCertificate,
                cancellationToken);
        }
    }

    private bool ValidateClientCertificate(
        object sender,
        X509Certificate? certificate,
        X509Chain? chain,
        SslPolicyErrors sslPolicyErrors)
    {
        if (certificate is null)
        {
            return false;
        }

        string expectedHash =
            _clientCertificate.GetCertHashString(HashAlgorithmName.SHA256);
        string actualHash =
            certificate.GetCertHashString(HashAlgorithmName.SHA256);
        return expectedHash.Equals(actualHash, StringComparison.OrdinalIgnoreCase);
    }

    private static async Task HandleWebSocketAsync(
        Stream stream,
        bool requiresClientCertificate,
        CancellationToken cancellationToken)
    {
        HttpRequest request = await ReadRequestAsync(stream, cancellationToken);
        if (!TryGetEndpoint(request.Target, out ServerEndpoint endpoint) ||
            requiresClientCertificate !=
                (endpoint == ServerEndpoint.ClientAuthentication))
        {
            await WriteHttpErrorAsync(
                stream,
                "404 Not Found",
                cancellationToken);
            return;
        }

        if (!request.Headers.TryGetValue(
                "Sec-WebSocket-Key",
                out string? webSocketKey) ||
            !request.Headers.TryGetValue("Upgrade", out string? upgrade) ||
            !upgrade.Equals("websocket", StringComparison.OrdinalIgnoreCase) ||
            !request.Headers.TryGetValue("Connection", out string? connection) ||
            !connection.Contains("upgrade", StringComparison.OrdinalIgnoreCase))
        {
            await WriteHttpErrorAsync(
                stream,
                "400 Bad Request",
                cancellationToken);
            return;
        }

        await WriteWebSocketHandshakeAsync(
            stream,
            webSocketKey,
            cancellationToken);

        using System.Net.WebSockets.WebSocket socket =
            System.Net.WebSockets.WebSocket.CreateFromStream(
                stream,
                isServer: true,
                subProtocol: null,
                keepAliveInterval: TimeSpan.FromSeconds(30));

        switch (endpoint)
        {
            case ServerEndpoint.Message:
                await EchoCompleteMessagesAsync(socket, cancellationToken);
                break;
            case ServerEndpoint.Stream:
                await EchoFramesAsync(
                    socket,
                    WebSocketMessageType.Binary,
                    cancellationToken);
                break;
            case ServerEndpoint.Partial:
                await EchoFramesAsync(
                    socket,
                    WebSocketMessageType.Text,
                    cancellationToken);
                break;
            case ServerEndpoint.ClientAuthentication:
                await WaitForCloseAsync(socket, cancellationToken);
                break;
        }
    }

    private static async Task EchoCompleteMessagesAsync(
        System.Net.WebSockets.WebSocket socket,
        CancellationToken cancellationToken)
    {
        byte[] receiveBuffer = new byte[8 * 1024];
        using var messageBuffer = new MemoryStream();
        WebSocketMessageType? messageType = null;

        while (socket.State == WebSocketState.Open)
        {
            WebSocketReceiveResult result = await socket.ReceiveAsync(
                new ArraySegment<byte>(receiveBuffer),
                cancellationToken);
            if (await CompleteCloseIfRequestedAsync(
                    socket,
                    result,
                    cancellationToken))
            {
                return;
            }

            messageType ??= result.MessageType;
            if (messageType != result.MessageType ||
                messageBuffer.Length + result.Count > MaximumMessageBytes)
            {
                await socket.CloseOutputAsync(
                    WebSocketCloseStatus.MessageTooBig,
                    "The sample accepts messages up to 64 KiB.",
                    cancellationToken);
                return;
            }

            messageBuffer.Write(receiveBuffer, 0, result.Count);
            if (!result.EndOfMessage)
            {
                continue;
            }

            byte[] message = messageBuffer.ToArray();
            await socket.SendAsync(
                new ArraySegment<byte>(message),
                messageType.Value,
                endOfMessage: true,
                cancellationToken);
            messageBuffer.SetLength(0);
            messageType = null;
        }
    }

    private static async Task EchoFramesAsync(
        System.Net.WebSockets.WebSocket socket,
        WebSocketMessageType expectedMessageType,
        CancellationToken cancellationToken)
    {
        byte[] buffer = new byte[8 * 1024];

        while (socket.State == WebSocketState.Open)
        {
            WebSocketReceiveResult result = await socket.ReceiveAsync(
                new ArraySegment<byte>(buffer),
                cancellationToken);
            if (await CompleteCloseIfRequestedAsync(
                    socket,
                    result,
                    cancellationToken))
            {
                return;
            }

            if (result.MessageType != expectedMessageType)
            {
                await socket.CloseOutputAsync(
                    WebSocketCloseStatus.InvalidMessageType,
                    "The endpoint received an unexpected message type.",
                    cancellationToken);
                return;
            }

            await socket.SendAsync(
                new ArraySegment<byte>(buffer, 0, result.Count),
                result.MessageType,
                result.EndOfMessage,
                cancellationToken);
        }
    }

    private static async Task WaitForCloseAsync(
        System.Net.WebSockets.WebSocket socket,
        CancellationToken cancellationToken)
    {
        byte[] buffer = new byte[1024];
        while (socket.State == WebSocketState.Open)
        {
            WebSocketReceiveResult result = await socket.ReceiveAsync(
                new ArraySegment<byte>(buffer),
                cancellationToken);
            if (await CompleteCloseIfRequestedAsync(
                    socket,
                    result,
                    cancellationToken))
            {
                return;
            }
        }
    }

    private static async Task<bool> CompleteCloseIfRequestedAsync(
        System.Net.WebSockets.WebSocket socket,
        WebSocketReceiveResult result,
        CancellationToken cancellationToken)
    {
        if (result.MessageType != WebSocketMessageType.Close)
        {
            return false;
        }

        await socket.CloseOutputAsync(
            result.CloseStatus ?? WebSocketCloseStatus.NormalClosure,
            result.CloseStatusDescription ?? string.Empty,
            cancellationToken);
        return true;
    }

    private static async Task<HttpRequest> ReadRequestAsync(
        Stream stream,
        CancellationToken cancellationToken)
    {
        int bytesRead = 0;
        string requestLine = await ReadLineAsync(
                stream,
                cancellationToken)
            ?? throw new InvalidDataException(
                "The connection ended before the HTTP request line.");
        bytesRead += requestLine.Length + 2;

        string[] requestParts = requestLine.Split(' ', 3);
        if (requestParts.Length != 3 ||
            !requestParts[0].Equals("GET", StringComparison.Ordinal))
        {
            throw new InvalidDataException("The WebSocket request line is invalid.");
        }

        var headers =
            new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        while (true)
        {
            string headerLine = await ReadLineAsync(
                    stream,
                    cancellationToken)
                ?? throw new InvalidDataException(
                    "The connection ended before the HTTP headers.");
            bytesRead += headerLine.Length + 2;
            if (bytesRead > MaximumHeaderBytes)
            {
                throw new InvalidDataException("The HTTP headers are too large.");
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

        return new HttpRequest(requestParts[1], headers);
    }

    private static async Task<string?> ReadLineAsync(
        Stream stream,
        CancellationToken cancellationToken)
    {
        using var line = new MemoryStream();
        byte[] singleByte = new byte[1];
        bool sawCarriageReturn = false;

        while (line.Length <= MaximumHeaderLineBytes)
        {
            int read = await stream.ReadAsync(
                singleByte.AsMemory(0, 1),
                cancellationToken);
            if (read == 0)
            {
                return line.Length == 0
                    ? null
                    : throw new InvalidDataException(
                        "The HTTP request ended in the middle of a line.");
            }

            byte value = singleByte[0];
            if (sawCarriageReturn)
            {
                if (value != (byte)'\n')
                {
                    throw new InvalidDataException(
                        "HTTP lines must end with CRLF.");
                }

                return Encoding.ASCII.GetString(line.ToArray());
            }

            if (value == (byte)'\r')
            {
                sawCarriageReturn = true;
            }
            else
            {
                line.WriteByte(value);
            }
        }

        throw new InvalidDataException("An HTTP header line is too large.");
    }

    private static bool TryGetEndpoint(
        string target,
        out ServerEndpoint endpoint)
    {
        string path = target.Split('?', 2)[0];
        endpoint = path.ToLowerInvariant() switch
        {
            "/message" => ServerEndpoint.Message,
            "/stream" => ServerEndpoint.Stream,
            "/partial" => ServerEndpoint.Partial,
            "/client-authentication" => ServerEndpoint.ClientAuthentication,
            _ => ServerEndpoint.Unknown,
        };
        return endpoint != ServerEndpoint.Unknown;
    }

    private static async Task WriteWebSocketHandshakeAsync(
        Stream stream,
        string webSocketKey,
        CancellationToken cancellationToken)
    {
        byte[] acceptSource = Encoding.ASCII.GetBytes(
            webSocketKey + WebSocketProtocolGuid);
        string accept = Convert.ToBase64String(SHA1.HashData(acceptSource));
        string response =
            "HTTP/1.1 101 Switching Protocols\r\n" +
            "Upgrade: websocket\r\n" +
            "Connection: Upgrade\r\n" +
            $"Sec-WebSocket-Accept: {accept}\r\n\r\n";
        byte[] responseBytes = Encoding.ASCII.GetBytes(response);
        await stream.WriteAsync(responseBytes, cancellationToken);
        await stream.FlushAsync(cancellationToken);
    }

    private static async Task WriteHttpErrorAsync(
        Stream stream,
        string status,
        CancellationToken cancellationToken)
    {
        byte[] response = Encoding.ASCII.GetBytes(
            $"HTTP/1.1 {status}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n");
        await stream.WriteAsync(response, cancellationToken);
        await stream.FlushAsync(cancellationToken);
    }

    private static CertificateBundle CreateCertificates()
    {
        DateTimeOffset notBefore = DateTimeOffset.UtcNow.AddMinutes(-5);
        DateTimeOffset notAfter = DateTimeOffset.UtcNow.AddDays(7);

        using RSA rootKey = RSA.Create(2048);
        var rootRequest = new CertificateRequest(
            $"CN={CertificateIssuerName}",
            rootKey,
            HashAlgorithmName.SHA256,
            RSASignaturePadding.Pkcs1);
        rootRequest.CertificateExtensions.Add(
            new X509BasicConstraintsExtension(true, false, 0, true));
        rootRequest.CertificateExtensions.Add(
            new X509KeyUsageExtension(
                X509KeyUsageFlags.KeyCertSign |
                X509KeyUsageFlags.CrlSign,
                true));
        rootRequest.CertificateExtensions.Add(
            new X509SubjectKeyIdentifierExtension(
                rootRequest.PublicKey,
                false));

        using X509Certificate2 generatedRoot =
            rootRequest.CreateSelfSigned(notBefore, notAfter);
        X509Certificate2 rootCertificate =
            X509CertificateLoader.LoadPkcs12(
                generatedRoot.Export(X509ContentType.Pfx),
                password: null);

        X509Certificate2? serverCertificate = null;
        X509Certificate2? clientCertificate = null;
        try
        {
            serverCertificate = CreateSignedCertificate(
                "CN=fabrikam.com",
                rootCertificate,
                notBefore,
                notAfter,
                isClientCertificate: false);
            clientCertificate = CreateSignedCertificate(
                "CN=WebSocket Sample Client",
                rootCertificate,
                notBefore,
                notAfter,
                isClientCertificate: true);

            string password = Convert.ToBase64String(
                RandomNumberGenerator.GetBytes(24));
            string pfxData = Convert.ToBase64String(
                clientCertificate.Export(X509ContentType.Pfx, password));

            return new CertificateBundle(
                rootCertificate,
                serverCertificate,
                clientCertificate,
                pfxData,
                password);
        }
        catch
        {
            clientCertificate?.Dispose();
            serverCertificate?.Dispose();
            rootCertificate.Dispose();
            throw;
        }
    }

    private static X509Certificate2 CreateSignedCertificate(
        string subjectName,
        X509Certificate2 issuer,
        DateTimeOffset notBefore,
        DateTimeOffset notAfter,
        bool isClientCertificate)
    {
        using RSA key = RSA.Create(2048);
        var request = new CertificateRequest(
            subjectName,
            key,
            HashAlgorithmName.SHA256,
            RSASignaturePadding.Pkcs1);
        request.CertificateExtensions.Add(
            new X509BasicConstraintsExtension(false, false, 0, true));
        request.CertificateExtensions.Add(
            new X509KeyUsageExtension(
                X509KeyUsageFlags.DigitalSignature |
                X509KeyUsageFlags.KeyEncipherment,
                true));
        request.CertificateExtensions.Add(
            new X509EnhancedKeyUsageExtension(
                new OidCollection
                {
                    new Oid(
                        isClientCertificate
                            ? "1.3.6.1.5.5.7.3.2"
                            : "1.3.6.1.5.5.7.3.1"),
                },
                true));
        request.CertificateExtensions.Add(
            new X509SubjectKeyIdentifierExtension(request.PublicKey, false));

        if (!isClientCertificate)
        {
            var subjectAlternativeNames = new SubjectAlternativeNameBuilder();
            subjectAlternativeNames.AddDnsName("fabrikam.com");
            request.CertificateExtensions.Add(subjectAlternativeNames.Build());
        }

        byte[] serialNumber = RandomNumberGenerator.GetBytes(16);
        serialNumber[0] &= 0x7F;
        if (serialNumber.All(value => value == 0))
        {
            serialNumber[^1] = 1;
        }

        using X509Certificate2 generated = request.Create(
            issuer,
            notBefore,
            notAfter,
            serialNumber);
        using X509Certificate2 withPrivateKey =
            generated.CopyWithPrivateKey(key);
        X509KeyStorageFlags keyStorageFlags = isClientCertificate
            ? X509KeyStorageFlags.Exportable
            : X509KeyStorageFlags.DefaultKeySet;
        return X509CertificateLoader.LoadPkcs12(
            withPrivateKey.Export(X509ContentType.Pfx),
            password: null,
            keyStorageFlags);
    }

    private static async Task AwaitExpectedCancellationAsync(Task task)
    {
        try
        {
            await task;
        }
        catch (OperationCanceledException)
        {
        }
        catch (ObjectDisposedException)
        {
        }
        catch (SocketException)
        {
        }
    }

    private void ReportDiagnostic(Exception exception)
    {
        LastError = exception;
        Exception baseException = exception.GetBaseException();
        string message =
            $"{baseException.GetType().Name}: {baseException.Message}";
        LastDiagnostic = message;
        Debug.WriteLine(message);
        Diagnostic?.Invoke(this, message);
    }

    private sealed record HttpRequest(
        string Target,
        Dictionary<string, string> Headers);

    private sealed class CertificateBundle : IDisposable
    {
        internal CertificateBundle(
            X509Certificate2 rootCertificate,
            X509Certificate2 serverCertificate,
            X509Certificate2 clientCertificate,
            string clientCertificatePfxData,
            string clientCertificatePassword)
        {
            RootCertificate = rootCertificate;
            ServerCertificate = serverCertificate;
            ClientCertificate = clientCertificate;
            ClientCertificatePfxData = clientCertificatePfxData;
            ClientCertificatePassword = clientCertificatePassword;
        }

        internal X509Certificate2 RootCertificate { get; }

        internal X509Certificate2 ServerCertificate { get; }

        internal X509Certificate2 ClientCertificate { get; }

        internal string ClientCertificatePfxData { get; }

        internal string ClientCertificatePassword { get; }

        public void Dispose()
        {
            ClientCertificate.Dispose();
            ServerCertificate.Dispose();
            RootCertificate.Dispose();
        }
    }

    private enum ListenerKind
    {
        Plain,
        Secure,
        ClientAuthentication,
    }

    private enum ServerEndpoint
    {
        Unknown,
        Message,
        Stream,
        Partial,
        ClientAuthentication,
    }
}
