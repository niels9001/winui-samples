using System;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Navigation;
using SDKTemplate.ViewModels;

namespace SDKTemplate;

public sealed partial class ArticlePage : Page
{
    private readonly DispatcherTimer _loadTimer;

    public ArticlePage()
    {
        InitializeComponent();
        VisualStateManager.GoToState(this, "ContentNotLoadedState", false);

        _loadTimer = new DispatcherTimer
        {
            Interval = TimeSpan.FromSeconds(0.55),
        };
        _loadTimer.Tick += LoadTimer_Tick;
    }

    public ArticleViewModel Article { get; private set; } = new();

    protected override void OnNavigatedTo(NavigationEventArgs e)
    {
        base.OnNavigatedTo(e);

        Article = e.Parameter as ArticleViewModel
            ?? throw new ArgumentException(
                "Article navigation requires an ArticleViewModel.",
                nameof(e));

        Bindings.Update();
        VisualStateManager.GoToState(this, "ContentNotLoadedState", false);
        _loadTimer.Start();
    }

    protected override void OnNavigatedFrom(NavigationEventArgs e)
    {
        _loadTimer.Stop();
        VisualStateManager.GoToState(this, "ContentNotLoadedState", false);
        base.OnNavigatedFrom(e);
    }

    private void LoadTimer_Tick(object? sender, object e)
    {
        _loadTimer.Stop();
        VisualStateManager.GoToState(
            this,
            "ContentLoadedState",
            MotionSettings.AnimationsEnabled);
    }
}
