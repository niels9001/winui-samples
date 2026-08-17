using Microsoft.UI.Xaml;

namespace SDKTemplate;

public sealed partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();

        ExtendsContentIntoTitleBar = true;
        SetTitleBar(AppTitleBar);
        Closed += MainWindow_Closed;

        string title = Strings.Get("AppDisplayName");
        Title = title;
        AppTitleBar.Title = title;
    }

    public void NavigateToMainPage()
    {
        RootFrame.Navigate(typeof(MainPage));
    }

    private void MainWindow_Closed(object sender, WindowEventArgs args)
    {
        if (RootFrame.Content is MainPage page)
        {
            page.Dispose();
        }
    }
}
