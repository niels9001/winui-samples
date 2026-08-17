using System;
using System.IO;
using System.Net;
using System.Net.Security;
using System.Net.Sockets;
using System.Security.Authentication;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Threading;
using System.Threading.Tasks;

namespace SDKTemplate;

internal sealed class LocalTlsTestServer : IAsyncDisposable
{
    private readonly CancellationTokenSource _cancellation = new();
    private readonly X509Certificate2 _certificate;
    private readonly TcpListener _listener;
    private readonly Task _acceptLoop;

    internal LocalTlsTestServer()
    {
        _certificate = CreateCertificate();
        _listener = new TcpListener(IPAddress.Loopback, 0);
        _listener.Start();
        Port = ((IPEndPoint)_listener.LocalEndpoint).Port;
        _acceptLoop = AcceptLoopAsync(_cancellation.Token);
    }

    internal event EventHandler<string>? Diagnostic;

    internal int Port { get; }

    public async ValueTask DisposeAsync()
    {
        await _cancellation.CancelAsync();
        _listener.Stop();

        try
        {
            await _acceptLoop;
        }
        catch (OperationCanceledException)
        {
        }

        _certificate.Dispose();
        _cancellation.Dispose();
    }

    private async Task AcceptLoopAsync(CancellationToken cancellationToken)
    {
        while (!cancellationToken.IsCancellationRequested)
        {
            TcpClient client;
            try
            {
                client = await _listener.AcceptTcpClientAsync(cancellationToken);
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

            using (client)
            {
                using var stream = new SslStream(
                    client.GetStream(),
                    leaveInnerStreamOpen: false);

                try
                {
                    await stream.AuthenticateAsServerAsync(
                        new SslServerAuthenticationOptions
                        {
                            ServerCertificate = _certificate,
                            EnabledSslProtocols = SslProtocols.Tls12,
                            ClientCertificateRequired = false,
                        },
                        cancellationToken);
                    Diagnostic?.Invoke(
                        this,
                        "The local TLS server completed a secure handshake.");
                }
                catch (AuthenticationException)
                {
                    Diagnostic?.Invoke(
                        this,
                        "The client rejected the intentionally untrusted test certificate.");
                }
                catch (IOException exception)
                    when (!cancellationToken.IsCancellationRequested)
                {
                    Diagnostic?.Invoke(
                        this,
                        $"The TLS test connection ended: {exception.Message}");
                }
            }
        }
    }

    private static X509Certificate2 CreateCertificate()
    {
        using RSA rsa = RSA.Create(2048);
        var request = new CertificateRequest(
            "CN=www.fabrikam.com",
            rsa,
            HashAlgorithmName.SHA256,
            RSASignaturePadding.Pkcs1);
        request.CertificateExtensions.Add(
            new X509BasicConstraintsExtension(false, false, 0, false));
        request.CertificateExtensions.Add(
            new X509KeyUsageExtension(
                X509KeyUsageFlags.DigitalSignature |
                X509KeyUsageFlags.KeyEncipherment,
                false));
        request.CertificateExtensions.Add(
            new X509SubjectKeyIdentifierExtension(request.PublicKey, false));

        var subjectAlternativeNames = new SubjectAlternativeNameBuilder();
        subjectAlternativeNames.AddDnsName("www.fabrikam.com");
        request.CertificateExtensions.Add(subjectAlternativeNames.Build());

        using X509Certificate2 generated = request.CreateSelfSigned(
            DateTimeOffset.UtcNow.AddDays(-1),
            DateTimeOffset.UtcNow.AddDays(30));
        return X509CertificateLoader.LoadPkcs12(
            generated.Export(X509ContentType.Pfx),
            password: null);
    }
}
