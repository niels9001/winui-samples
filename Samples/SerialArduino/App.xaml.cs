using Microsoft.UI.Dispatching;
using Microsoft.UI.Xaml;

namespace SDKTemplate;

public partial class App : Application
{
    public static Window MainWindow { get; private set; } = null!;

    public static DispatcherQueue MainDispatcherQueue { get; private set; } = null!;

    internal static SerialArduinoService SerialService { get; private set; } = null!;

    public App()
    {
        InitializeComponent();
    }

    protected override void OnLaunched(LaunchActivatedEventArgs args)
    {
        var window = new MainWindow();
        MainWindow = window;
        MainDispatcherQueue = window.DispatcherQueue;
        SerialService = new SerialArduinoService(MainDispatcherQueue);

        window.Closed += Window_Closed;
        window.NavigateToMainPage();
        window.Activate();
    }

    private static void Window_Closed(object sender, WindowEventArgs args)
    {
        SerialService.Dispose();
    }
}
