using Microsoft.UI.Xaml;

namespace SDKTemplate;

/// <summary>
/// The application window. Hosts the SDKTemplate shell page in a Frame.
/// </summary>
public sealed partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();

        ExtendsContentIntoTitleBar = true;
        SetTitleBar(AppTitleBar);

    }

    public void NavigateToMainPage()
    {
        RootFrame.Navigate(typeof(MainPage));
    }
}
