using Microsoft.UI.Dispatching;
using Microsoft.UI.Xaml;

namespace SDKTemplate;

public partial class App : Application
{
    public static Window MainWindow { get; private set; } = null!;

    public static DispatcherQueue MainDispatcherQueue { get; private set; } = null!;

    public App()
    {
        InitializeComponent();
    }

    protected override void OnLaunched(LaunchActivatedEventArgs args)
    {
        var window = new MainWindow();
        MainWindow = window;
        MainDispatcherQueue = window.DispatcherQueue;

        window.NavigateToMainPage();
        window.Activate();
    }
}
