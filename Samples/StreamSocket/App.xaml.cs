using Microsoft.UI.Xaml;

namespace SDKTemplate;

public partial class App : Application
{
    public static MainWindow MainWindow { get; private set; } = null!;

    internal static SocketService SocketService { get; } = new();

    public App()
    {
        InitializeComponent();
    }

    protected override void OnLaunched(LaunchActivatedEventArgs args)
    {
        MainWindow = new MainWindow();
        MainWindow.NavigateToMainPage();
        MainWindow.Activate();
    }
}
