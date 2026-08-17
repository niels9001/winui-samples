using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Media.Animation;
using Microsoft.UI.Xaml.Navigation;

namespace SDKTemplate;

public sealed partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();

        ExtendsContentIntoTitleBar = true;
        SetTitleBar(AppTitleBar);
        AppWindow.SetIcon("Assets\\AppIcon.ico");
    }

    public void NavigateToMainPage()
    {
        RootFrame.Navigate(
            typeof(MainPage),
            null,
            new SuppressNavigationTransitionInfo());
    }

    private void AppTitleBar_BackRequested(TitleBar sender, object args)
    {
        if (!RootFrame.CanGoBack)
        {
            return;
        }

        if (MotionSettings.AnimationsEnabled)
        {
            RootFrame.GoBack();
        }
        else
        {
            RootFrame.GoBack(new SuppressNavigationTransitionInfo());
        }
    }

    private void RootFrame_Navigated(object sender, NavigationEventArgs e)
    {
        AppTitleBar.IsBackButtonVisible = RootFrame.CanGoBack;
        AppTitleBar.IsBackButtonEnabled = RootFrame.CanGoBack;
    }
}
