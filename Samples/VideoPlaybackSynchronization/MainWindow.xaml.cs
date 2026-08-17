using Microsoft.UI.Xaml;

namespace SDKTemplate;

public sealed partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();

        ExtendsContentIntoTitleBar = true;
        SetTitleBar(AppTitleBar);

        string title = Strings.Get("AppDisplayName");
        Title = title;
        AppTitleBar.Title = title;
        AppWindow.SetIcon("Assets/AppIcon.ico");
    }

    public void NavigateToMainPage()
    {
        RootFrame.Navigate(typeof(MainPage));
    }
}
