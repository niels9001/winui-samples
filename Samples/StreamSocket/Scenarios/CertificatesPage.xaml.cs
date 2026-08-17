using System;
using System.Collections.Generic;
using System.Text;
using System.Threading.Tasks;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Navigation;
using Windows.Networking;
using Windows.Networking.Sockets;
using Windows.Security.Cryptography.Certificates;

namespace SDKTemplate.Scenarios;

public sealed partial class CertificatesPage : Page
{
    private LocalTlsTestServer? _server;

    public CertificatesPage()
    {
        InitializeComponent();
    }

    protected override void OnNavigatedTo(NavigationEventArgs e)
    {
        StartTestServer();
    }

    protected override void OnNavigatedFrom(NavigationEventArgs e)
    {
        LocalTlsTestServer? server = _server;
        _server = null;

        if (server is not null)
        {
            server.Diagnostic -= Server_Diagnostic;
            _ = DisposeServerAsync(server);
        }
    }

    private async void ConnectButton_Click(
        object sender,
        RoutedEventArgs e)
    {
        ConnectButton.IsEnabled = false;
        CertificateOutputTextBox.Text = string.Empty;
        var hostName = new HostName(HostNameTextBox.Text);
        string serviceName = ServiceNameTextBox.Text;

        try
        {
            using var socket = new Windows.Networking.Sockets.StreamSocket();
            socket.Control.ClientCertificate = null;

            bool shouldRetry = await TryConnectAsync(
                socket,
                hostName,
                serviceName);
            if (shouldRetry)
            {
                await TryConnectAsync(socket, hostName, serviceName);
            }
        }
        catch (Exception exception)
        {
            MainPage.Current.NotifyOperationError(
                "Connecting with TLS",
                exception);
        }
        finally
        {
            ConnectButton.IsEnabled = _server is not null;
        }
    }

    private async Task<bool> TryConnectAsync(
        Windows.Networking.Sockets.StreamSocket socket,
        HostName hostName,
        string serviceName)
    {
        try
        {
            MainPage.Current.NotifyUser(
                $"Connecting securely to {hostName.DisplayName}:{serviceName}...",
                NotifyType.StatusMessage);
            await socket.ConnectAsync(
                hostName,
                serviceName,
                SocketProtectionLevel.Tls12);

            CertificateOutputTextBox.Text = GetCertificateInformation(
                socket.Information.ServerCertificate,
                socket.Information.ServerIntermediateCertificates);
            MainPage.Current.NotifyUser(
                "TLS connection established and certificate details loaded.",
                NotifyType.StatusMessage);
            return false;
        }
        catch (Exception exception)
        {
            if (socket.Information.ServerCertificateErrorSeverity !=
                SocketSslErrorSeverity.Ignorable)
            {
                MainPage.Current.NotifyOperationError(
                    "Validating the server certificate",
                    exception);
                return false;
            }
        }

        IReadOnlyList<ChainValidationResult> validationErrors =
            socket.Information.ServerCertificateErrors;
        bool continueConnection =
            await ShouldIgnoreCertificateErrorsAsync(validationErrors);

        if (!continueConnection)
        {
            MainPage.Current.NotifyUser(
                "Connection canceled because the certificate is not trusted.",
                NotifyType.ErrorMessage);
            return false;
        }

        socket.Control.IgnorableServerCertificateErrors.Clear();
        foreach (ChainValidationResult error in validationErrors)
        {
            socket.Control.IgnorableServerCertificateErrors.Add(error);
        }

        MainPage.Current.NotifyUser(
            "Retrying with the selected test-certificate errors ignored...",
            NotifyType.StatusMessage);
        return true;
    }

    private async Task<bool> ShouldIgnoreCertificateErrorsAsync(
        IReadOnlyList<ChainValidationResult> serverCertificateErrors)
    {
        string errors = string.Join(", ", serverCertificateErrors);
        var dialog = new ContentDialog
        {
            XamlRoot = XamlRoot,
            Title = "Server certificate validation errors",
            Content =
                "The local test certificate failed validation with these errors:\n\n" +
                errors +
                "\n\nCertificate problems can indicate an attempt to intercept data. " +
                "Continue only because this sample created the local test certificate.",
            PrimaryButtonText = "Continue test",
            CloseButtonText = "Cancel",
            DefaultButton = ContentDialogButton.Close,
        };

        ContentDialogResult result = await dialog.ShowAsync();
        return result == ContentDialogResult.Primary;
    }

    private void StartTestServer()
    {
        try
        {
            _server = new LocalTlsTestServer();
            _server.Diagnostic += Server_Diagnostic;
            ServiceNameTextBox.Text = _server.Port.ToString();
            ConnectButton.IsEnabled = true;
            MainPage.Current.NotifyUser(
                $"Local TLS test server listening on port {_server.Port}.",
                NotifyType.StatusMessage);
        }
        catch (Exception exception)
        {
            ConnectButton.IsEnabled = false;
            MainPage.Current.NotifyOperationError(
                "Starting the local TLS test server",
                exception);
        }
    }

    private void Server_Diagnostic(object? sender, string message)
    {
        MainPage.Current.NotifyUser(message, NotifyType.StatusMessage);
    }

    private static async Task DisposeServerAsync(LocalTlsTestServer server)
    {
        try
        {
            await server.DisposeAsync();
        }
        catch (Exception exception)
        {
            MainPage.Current.NotifyOperationError(
                "Stopping the local TLS test server",
                exception);
        }
    }

    private static string GetCertificateInformation(
        Certificate serverCertificate,
        IReadOnlyList<Certificate> intermediateCertificates)
    {
        var details = new StringBuilder();
        details.AppendLine(
            $"Friendly name: {serverCertificate.FriendlyName ?? "(not set)"}");
        details.AppendLine($"Subject: {serverCertificate.Subject}");
        details.AppendLine($"Issuer: {serverCertificate.Issuer}");
        details.AppendLine(
            $"Valid from {serverCertificate.ValidFrom:G} to {serverCertificate.ValidTo:G}");

        if (intermediateCertificates.Count == 0)
        {
            details.AppendLine("Intermediate chain: none");
        }
        else
        {
            details.AppendLine("Intermediate chain:");
            foreach (Certificate certificate in intermediateCertificates)
            {
                details.AppendLine($"  {certificate.Subject}");
            }
        }

        return details.ToString().TrimEnd();
    }
}
