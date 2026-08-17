using Windows.Security.Cryptography.Certificates;

namespace SDKTemplate;

internal sealed class ClientCertificateService : IAsyncDisposable
{
    private readonly SemaphoreSlim _gate = new(1, 1);
    private readonly LoopbackWebSocketServer _server;
    private CertificateStore? _certificateStore;
    private Certificate? _certificate;
    private int _isDisposing;

    internal ClientCertificateService(LoopbackWebSocketServer server)
    {
        _server = server;
    }

    internal async Task<Certificate> GetClientCertificateAsync()
    {
        ObjectDisposedException.ThrowIf(
            Volatile.Read(ref _isDisposing) != 0,
            this);
        await _gate.WaitAsync();
        try
        {
            ObjectDisposedException.ThrowIf(
                Volatile.Read(ref _isDisposing) != 0,
                this);
            if (_certificate is not null)
            {
                return _certificate;
            }

            CertificateQuery query = CreateQuery();
            IReadOnlyList<Certificate> existing =
                await CertificateStores.FindAllAsync(query);

            _certificateStore ??= CertificateStores.GetStoreByName(
                StandardCertificateStoreNames.Personal);
            foreach (Certificate certificate in existing)
            {
                _certificateStore.Delete(certificate);
            }

            await CertificateEnrollmentManager.ImportPfxDataAsync(
                _server.ClientCertificatePfxData,
                _server.ClientCertificatePassword,
                ExportOption.NotExportable,
                KeyProtectionLevel.NoConsent,
                InstallOptions.DeleteExpired,
                _server.ClientCertificateFriendlyName);

            IReadOnlyList<Certificate> imported =
                await CertificateStores.FindAllAsync(query);
            _certificate = imported.FirstOrDefault() ??
                throw new InvalidOperationException(
                    AppResources.Get("ClientCertificateNotFound"));
            return _certificate;
        }
        finally
        {
            _gate.Release();
        }
    }

    public async ValueTask DisposeAsync()
    {
        if (Interlocked.Exchange(ref _isDisposing, 1) != 0)
        {
            return;
        }

        await _gate.WaitAsync();
        try
        {
            _certificateStore ??= CertificateStores.GetStoreByName(
                StandardCertificateStoreNames.Personal);
            IReadOnlyList<Certificate> imported =
                await CertificateStores.FindAllAsync(CreateQuery());
            foreach (Certificate certificate in imported)
            {
                _certificateStore.Delete(certificate);
            }

            _certificate = null;
        }
        finally
        {
            _gate.Release();
            _gate.Dispose();
        }
    }

    private CertificateQuery CreateQuery()
    {
        return new CertificateQuery
        {
            FriendlyName = _server.ClientCertificateFriendlyName,
        };
    }
}
