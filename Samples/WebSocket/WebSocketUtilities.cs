using Windows.Foundation;
using Windows.Networking.Sockets;
using Windows.Web;

namespace SDKTemplate;

internal static class WebSocketUtilities
{
    private const int IllegalMethodCallHResult = unchecked((int)0x8000000E);

    internal static bool TryGetUri(
        string candidate,
        out Uri? uri,
        out string error)
    {
        uri = null;

        if (!Uri.TryCreate(candidate.Trim(), UriKind.Absolute, out Uri? parsed))
        {
            error = AppResources.Get("InvalidUri");
            return false;
        }

        if (!string.IsNullOrEmpty(parsed.Fragment))
        {
            error = AppResources.Get("UriFragmentNotSupported");
            return false;
        }

        if (parsed.Scheme is not ("ws" or "wss"))
        {
            error = AppResources.Get("UnsupportedUriScheme");
            return false;
        }

        uri = parsed;
        error = string.Empty;
        return true;
    }

    internal static string BuildWebSocketError(Exception exception)
    {
        Exception baseException = exception.GetBaseException();
        if ((uint)baseException.HResult == 0x800C000E)
        {
            return AppResources.Get("CertificateValidationRejected");
        }

        WebErrorStatus status = WebSocketError.GetStatus(baseException.HResult);
        return status switch
        {
            WebErrorStatus.CannotConnect or
            WebErrorStatus.NotFound or
            WebErrorStatus.RequestTimeout =>
                AppResources.Get("CannotConnect"),
            WebErrorStatus.Unknown =>
                AppResources.Format("ComError", baseException.HResult),
            _ => AppResources.Format("WebSocketError", status),
        };
    }

    internal static async Task<bool> ValidateServerCertificateAsync(
        WebSocketServerCustomValidationRequestedEventArgs args)
    {
        bool isValid;
        using (Deferral deferral = args.GetDeferral())
        {
            await Task.Delay(100);
            isValid =
                App.LoopbackServer?.MatchesGeneratedServerCertificateChain(
                    args.ServerCertificate,
                    args.ServerIntermediateCertificates) == true;
            if (!isValid)
            {
                args.Reject();
            }
        }

        return isValid;
    }

    internal static void TryUnsubscribe(Action unsubscribe)
    {
        try
        {
            unsubscribe();
        }
        catch (InvalidOperationException exception)
            when (exception.HResult == IllegalMethodCallHResult)
        {
            System.Diagnostics.Debug.WriteLine(exception);
        }
        catch (ObjectDisposedException exception)
        {
            System.Diagnostics.Debug.WriteLine(exception);
        }
    }
}
