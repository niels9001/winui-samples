using Microsoft.UI.Xaml;

namespace SDKTemplate;

public sealed partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();

        Title = AppResources.GetString("AppDisplayName");
        ExtendsContentIntoTitleBar = true;
        SetTitleBar(AppTitleBar);

        AppWindow.SetIcon("Assets/AppIcon.ico");
    }

    public void NavigateToMainPage()
    {
        RootFrame.Navigate(typeof(MainPage));
    }
}
