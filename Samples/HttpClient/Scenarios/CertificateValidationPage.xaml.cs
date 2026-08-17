using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Navigation;
using Windows.Foundation;
using Windows.Security.Cryptography.Certificates;
using Windows.Web.Http;
using Windows.Web.Http.Filters;
using WinHttpClient = Windows.Web.Http.HttpClient;

namespace SDKTemplate;

public sealed partial class CertificateValidationPage : Page
{
    private readonly MainPage rootPage = MainPage.Current;
    private CancellationTokenSource cancellation = new();
    private string? certificateDetails;
    private Exception? validationError;
    private bool customValidatorRejected;

    public CertificateValidationPage()
    {
        InitializeComponent();
    }

    protected override void OnNavigatedTo(NavigationEventArgs e)
    {
        cancellation = new CancellationTokenSource();
    }

    protected override void OnNavigatedFrom(NavigationEventArgs e)
    {
        cancellation.Cancel();
        cancellation.Dispose();
    }

    private async void StartButton_Click(object sender, RoutedEventArgs e)
    {
        Uri? resourceUri = Helpers.TryParseHttpUri(AddressField.Text);
        if (resourceUri is null || resourceUri.Scheme != Uri.UriSchemeHttps)
        {
            rootPage.NotifyUser(
                "Enter a valid HTTPS URI.",
                NotifyType.ErrorMessage);
            return;
        }

        CancellationToken token = cancellation.Token;
        Helpers.ScenarioStarted(StartButton, CancelButton, OutputField);
        rootPage.NotifyUser("In progress", NotifyType.StatusMessage);
        certificateDetails = null;
        validationError = null;
        customValidatorRejected = false;

        var filter = new HttpBaseProtocolFilter();
        bool customValidation =
            CustomValidationRadio.IsChecked == true ||
            IgnoreAndCustomValidationRadio.IsChecked == true;

        if (IgnoreAndCustomValidationRadio.IsChecked == true)
        {
            filter.IgnorableServerCertificateErrors.Add(
                ChainValidationResult.Untrusted);
            filter.IgnorableServerCertificateErrors.Add(
                ChainValidationResult.InvalidName);
        }

        if (customValidation)
        {
            filter.ServerCustomValidationRequested +=
                CustomServerCertificateValidator;
        }

        filter.CacheControl.ReadBehavior = HttpCacheReadBehavior.NoCache;
        filter.CacheControl.WriteBehavior = HttpCacheWriteBehavior.NoCache;

        try
        {
            using var client = new WinHttpClient(filter);
            using var request =
                new HttpRequestMessage(HttpMethod.Get, resourceUri);
            HttpRequestResult result = await client.TrySendRequestAsync(
                    request,
                    HttpCompletionOption.ResponseHeadersRead)
                .AsTask(token);

            if (result.Succeeded)
            {
                using HttpResponseMessage response = result.ResponseMessage;
                OutputField.Text =
                    Helpers.SerializeHeaders(response) +
                    (certificateDetails ?? "The OS accepted the server certificate.");
                rootPage.NotifyUser(
                    "Response received; the server certificate was accepted.",
                    NotifyType.StatusMessage);
            }
            else if (customValidation &&
                customValidatorRejected &&
                validationError is null)
            {
                OutputField.Text =
                    (certificateDetails ?? string.Empty) +
                    Environment.NewLine +
                    $"Expected rejection: {result.ExtendedError.Message}";
                rootPage.NotifyUser(
                    "The custom validator rejected the certificate as expected.",
                    NotifyType.StatusMessage);
            }
            else
            {
                Helpers.DisplayWebError(rootPage, result.ExtendedError);
                OutputField.Text = validationError?.Message ??
                    result.ExtendedError.Message;
            }
        }
        catch (OperationCanceledException)
        {
            rootPage.NotifyUser("Request canceled.", NotifyType.ErrorMessage);
        }
        catch (Exception ex)
        {
            rootPage.NotifyOperationError(
                "Validating the server certificate",
                ex);
        }
        finally
        {
            if (customValidation)
            {
                filter.ServerCustomValidationRequested -=
                    CustomServerCertificateValidator;
            }

            filter.Dispose();
            Helpers.ScenarioCompleted(StartButton, CancelButton);
        }
    }

    private async void CustomServerCertificateValidator(
        HttpBaseProtocolFilter sender,
        HttpServerCustomValidationRequestedEventArgs args)
    {
        Deferral deferral = args.GetDeferral();
        try
        {
            Certificate certificate = args.ServerCertificate;
            certificateDetails =
                $"Subject: {certificate.Subject}{Environment.NewLine}" +
                $"Issuer: {certificate.Issuer}{Environment.NewLine}" +
                $"SHA-1: {Convert.ToHexString(certificate.GetHashValue())}" +
                Environment.NewLine;

            await Task.Delay(50);

            // A real app can compare the hash with a securely provisioned pin.
            // This sample rejects it so the custom-validation path is observable.
            customValidatorRejected = true;
            args.Reject();
        }
        catch (Exception ex)
        {
            validationError = ex;
            args.Reject();
        }
        finally
        {
            deferral.Complete();
        }
    }

    private void ValidationMode_Checked(object sender, RoutedEventArgs e)
    {
        if (AddressField is null || sender is not RadioButton radio)
        {
            return;
        }

        AddressField.Text = (string?)radio.Tag == "IgnoreAndCustom"
            ? "https://self-signed.badssl.com/"
            : "https://www.microsoft.com/";
    }

    private void CancelButton_Click(object sender, RoutedEventArgs e)
    {
        cancellation.Cancel();
        cancellation.Dispose();
        cancellation = new CancellationTokenSource();
    }
}
