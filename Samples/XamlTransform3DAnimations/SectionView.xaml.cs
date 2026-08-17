using System;
using Windows.Foundation;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using SDKTemplate.ViewModels;

namespace SDKTemplate;

public sealed partial class SectionView : UserControl
{
    public static readonly DependencyProperty ViewModelProperty = DependencyProperty.Register(
        nameof(ViewModel),
        typeof(HeroArticlesViewModel),
        typeof(SectionView),
        new PropertyMetadata(null, OnViewModelPropertyChanged));

    public SectionView()
    {
        InitializeComponent();
        VisualStateManager.GoToState(this, "ContentSteadyState", false);
    }

    public HeroArticlesViewModel? ViewModel
    {
        get => (HeroArticlesViewModel?)GetValue(ViewModelProperty);
        set => SetValue(ViewModelProperty, value);
    }

    public event TypedEventHandler<SectionView, ArticleViewModel>? ArticleSelected;

    private static void OnViewModelPropertyChanged(
        DependencyObject dependencyObject,
        DependencyPropertyChangedEventArgs args)
    {
        var sectionView = (SectionView)dependencyObject;
        sectionView.OnViewModelChanged(
            (HeroArticlesViewModel?)args.OldValue,
            (HeroArticlesViewModel?)args.NewValue);
    }

    private void OnViewModelChanged(
        HeroArticlesViewModel? oldValue,
        HeroArticlesViewModel? newValue)
    {
        ContentTransitionStoryboard.Stop();

        if (newValue is null)
        {
            CurrentContentPresenter.Content = null;
            NextContentPresenter.Content = null;
            VisualStateManager.GoToState(this, "ContentSteadyState", false);
            return;
        }

        if (oldValue is not null && IsLoaded && MotionSettings.AnimationsEnabled)
        {
            CurrentContentPresenter.Content = oldValue;
            NextContentPresenter.Content = newValue;
            VisualStateManager.GoToState(this, "ContentTransitionState", true);
            return;
        }

        CurrentContentPresenter.Content = newValue;
        NextContentPresenter.Content = null;
        VisualStateManager.GoToState(this, "ContentSteadyState", false);
    }

    private void UpdateForSizeChanged(double newWidth, double newHeight)
    {
        var centerX = newWidth / 2;
        RootTransform.CenterX = centerX;
        NextContentTransform.CenterX = centerX;

        var centerZ = -newWidth / 2;
        RootTransform.CenterZ = centerZ;
        NextContentTransform.CenterZ = centerZ;

        ClipGeometry.Rect = new Rect(0, -1024, newWidth, newHeight + 1024);
    }

    private void LayoutRoot_SizeChanged(object sender, SizeChangedEventArgs e)
    {
        UpdateForSizeChanged(e.NewSize.Width, e.NewSize.Height);
    }

    private void ContentTransitionStoryboard_Completed(object sender, object e)
    {
        CurrentContentPresenter.Content = NextContentPresenter.Content;
        NextContentPresenter.Content = null;
        VisualStateManager.GoToState(this, "ContentSteadyState", false);
    }

    private void ArticleButton_Click(object sender, RoutedEventArgs e)
    {
        if (sender is FrameworkElement { DataContext: ArticleViewModel article })
        {
            ArticleSelected?.Invoke(this, article);
        }
    }

    private void SectionView_Unloaded(object sender, RoutedEventArgs e)
    {
        ContentTransitionStoryboard.Stop();
        CurrentContentPresenter.Content = ViewModel;
        NextContentPresenter.Content = null;
        VisualStateManager.GoToState(this, "ContentSteadyState", false);
    }
}
