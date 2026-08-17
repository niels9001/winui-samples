using System;
using System.Collections.Generic;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Input;
using Microsoft.UI.Xaml.Media.Animation;
using Microsoft.UI.Xaml.Navigation;
using SDKTemplate.ViewModels;

namespace SDKTemplate;

public sealed partial class MainPage : Page
{
    private readonly DispatcherTimer _updateTimer;

    public MainPage()
    {
        InitializeComponent();

        _updateTimer = new DispatcherTimer
        {
            Interval = TimeSpan.FromSeconds(3),
        };
        _updateTimer.Tick += UpdateTimer_Tick;
    }

    protected override void OnNavigatedTo(NavigationEventArgs e)
    {
        base.OnNavigatedTo(e);
        _updateTimer.Start();
    }

    protected override void OnNavigatedFrom(NavigationEventArgs e)
    {
        _updateTimer.Stop();
        base.OnNavigatedFrom(e);
    }

    private void UpdateRandomSection()
    {
        var sectionsInView = HeadlinesHub.SectionsInView;
        if (sectionsInView.Count == 0)
        {
            return;
        }

        var focusedArticle = (FocusManager.GetFocusedElement(XamlRoot) as FrameworkElement)
            ?.DataContext as ArticleViewModel;
        var refreshCandidates = new List<NewsSectionViewModel>(sectionsInView.Count);

        foreach (var section in sectionsInView)
        {
            if (section.DataContext is not NewsSectionViewModel sectionViewModel)
            {
                continue;
            }

            var articles = sectionViewModel.Articles;
            if (ReferenceEquals(articles.Article0, focusedArticle)
                || ReferenceEquals(articles.Article1, focusedArticle))
            {
                continue;
            }

            refreshCandidates.Add(sectionViewModel);
        }

        if (refreshCandidates.Count > 0)
        {
            refreshCandidates[Random.Shared.Next(refreshCandidates.Count)].Refresh();
        }
    }

    private void UpdateTimer_Tick(object? sender, object e)
    {
        UpdateRandomSection();
    }

    private void SectionView_ArticleSelected(SectionView sender, ArticleViewModel article)
    {
        NavigationTransitionInfo transition = MotionSettings.AnimationsEnabled
            ? new DrillInNavigationTransitionInfo()
            : new SuppressNavigationTransitionInfo();

        Frame.Navigate(typeof(ArticlePage), article, transition);
    }

    private void MainPage_Unloaded(object sender, RoutedEventArgs e)
    {
        _updateTimer.Stop();
    }
}
