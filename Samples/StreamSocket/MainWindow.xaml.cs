using Microsoft.UI.Xaml;

namespace SDKTemplate;

public sealed partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();

        ExtendsContentIntoTitleBar = true;
        SetTitleBar(AppTitleBar);
        AppWindow.SetIcon("Assets/AppIcon.ico");
        Closed += MainWindow_Closed;
    }

    public void NavigateToMainPage()
    {
        RootFrame.Navigate(typeof(MainPage));
    }

    private void MainWindow_Closed(object sender, WindowEventArgs args)
    {
        App.SocketService.Dispose();
    }
}
