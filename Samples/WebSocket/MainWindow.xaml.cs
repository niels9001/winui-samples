using Microsoft.UI.Xaml;

namespace SDKTemplate;

/// <summary>
/// The application window.
/// </summary>
public sealed partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();

        string title = AppResources.Get("AppDisplayName");
        Title = title;
        AppTitleBar.Title = title;
        ExtendsContentIntoTitleBar = true;
        SetTitleBar(AppTitleBar);

        AppWindow.SetIcon("Assets\\AppIcon.ico");
    }

    public void NavigateToMainPage()
    {
        RootFrame.Navigate(typeof(MainPage));
    }
}
