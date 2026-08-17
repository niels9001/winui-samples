using Microsoft.UI.Xaml;

namespace SDKTemplate;

public partial class App : Application
{
    public static Window MainWindow { get; private set; } = null!;

    internal static SampleHttpServer TestServer { get; private set; } = null!;

    internal static Exception? TestServerStartupError { get; private set; }

    public App()
    {
        InitializeComponent();
    }

    protected override void OnLaunched(LaunchActivatedEventArgs args)
    {
        try
        {
            TestServer = SampleHttpServer.Start();
        }
        catch (Exception ex)
        {
            TestServerStartupError = ex;
        }

        var window = new MainWindow();
        MainWindow = window;
        window.Closed += (_, _) => TestServer?.Dispose();
        window.NavigateToMainPage();
        window.Activate();
    }
}
