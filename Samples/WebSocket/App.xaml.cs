using Microsoft.UI.Windowing;
using Microsoft.UI.Xaml;

namespace SDKTemplate;

/// <summary>
/// Provides application-specific behavior to supplement the default Application class.
/// </summary>
public partial class App : Application
{
    public static MainWindow MainWindow { get; private set; } = null!;

    internal static LoopbackWebSocketServer? LoopbackServer { get; private set; }

    internal static ClientCertificateService? ClientCertificateService { get; private set; }

    internal static string? StartupError { get; private set; }

    private static int _shutdownStarted;

    public App()
    {
        InitializeComponent();
    }

    protected override void OnLaunched(LaunchActivatedEventArgs args)
    {
        try
        {
            LoopbackServer = LoopbackWebSocketServer.Start();
            ClientCertificateService = new ClientCertificateService(LoopbackServer);
        }
        catch (Exception exception)
        {
            StartupError = exception.Message;
        }

        MainWindow = new MainWindow();
        MainWindow.AppWindow.Closing += OnMainWindowClosing;
        MainWindow.NavigateToMainPage();
        MainWindow.Activate();
    }

    private static async void OnMainWindowClosing(
        AppWindow sender,
        AppWindowClosingEventArgs args)
    {
        args.Cancel = true;
        if (Interlocked.Exchange(ref _shutdownStarted, 1) != 0)
        {
            return;
        }

        ClientCertificateService? certificateService =
            ClientCertificateService;
        ClientCertificateService = null;
        if (certificateService is not null)
        {
            try
            {
                await certificateService.DisposeAsync();
            }
            catch (Exception exception)
            {
                System.Diagnostics.Debug.WriteLine(exception);
            }
        }

        if (LoopbackServer is not null)
        {
            try
            {
                await LoopbackServer.DisposeAsync();
            }
            catch (Exception exception)
            {
                System.Diagnostics.Debug.WriteLine(exception);
            }

            LoopbackServer = null;
        }

        sender.Closing -= OnMainWindowClosing;
        MainWindow.Close();
    }
}
