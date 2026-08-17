using Microsoft.UI.Dispatching;
using Microsoft.UI.Xaml;

namespace SDKTemplate;

public partial class App : Application
{
    public static MainWindow MainWindow { get; private set; } = null!;

    public static DispatcherQueue MainDispatcherQueue { get; private set; } = null!;

    public App()
    {
        InitializeComponent();
    }

    protected override void OnLaunched(LaunchActivatedEventArgs args)
    {
        MainWindow = new MainWindow();
        MainDispatcherQueue = MainWindow.DispatcherQueue;
        MainWindow.NavigateToMainPage();
        MainWindow.Activate();
    }
}
