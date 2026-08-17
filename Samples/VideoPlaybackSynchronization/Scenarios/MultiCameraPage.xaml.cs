using System;
using System.Collections.Generic;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Automation;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Navigation;
using Windows.Media;
using Windows.Media.Core;

namespace SDKTemplate;

public sealed partial class MultiCameraPage : Page
{
    private static readonly Uri[] MediaUris =
    [
        new("ms-appx:///Assets/Media/angle-front.mp4"),
        new("ms-appx:///Assets/Media/angle-left.mp4"),
        new("ms-appx:///Assets/Media/angle-right.mp4"),
        new("ms-appx:///Assets/Media/angle-close.mp4"),
        new("ms-appx:///Assets/Media/angle-wide.mp4"),
    ];

    private readonly MainPage _rootPage = MainPage.Current;
    private readonly SynchronizedPlaybackSession _playback;
    private bool _isDisposed;

    public MultiCameraPage()
    {
        InitializeComponent();
        NavigationCacheMode = NavigationCacheMode.Disabled;

        _playback = new SynchronizedPlaybackSession(MediaUris.Length, DispatcherQueue);
        MediaPlayerElement[] playerElements =
        [
            FrontPlayerElement,
            LeftPlayerElement,
            RightPlayerElement,
            ClosePlayerElement,
            WidePlayerElement,
        ];

        for (int index = 0; index < playerElements.Length; index++)
        {
            playerElements[index].SetMediaPlayer(_playback.Players[index]);
        }

        _playback.MediaReady += Playback_MediaReady;
        _playback.MediaFailed += Playback_MediaFailed;
        _playback.PlaybackPositionChanged += Playback_PositionChanged;
        _playback.PlaybackStateChanged += Playback_StateChanged;
    }

    private void LoadButton_Click(object sender, RoutedEventArgs e)
    {
        SetLoadingState(true);
        SetPlaybackControlsEnabled(false);
        PlaybackStatusTextBlock.Text = Strings.Get("LoadingPackagedMedia");

        var sources = new List<PlaybackMediaSource>(MediaUris.Length);
        bool sourcesTransferred = false;
        try
        {
            foreach (Uri uri in MediaUris)
            {
                sources.Add(
                    new PlaybackMediaSource(MediaSource.CreateFromUri(uri)));
            }

            sourcesTransferred = true;
            _playback.LoadSources(sources);
        }
        catch (Exception ex)
        {
            if (!sourcesTransferred)
            {
                foreach (PlaybackMediaSource source in sources)
                {
                    source.Dispose();
                }
            }

            SetLoadingState(false);
            _rootPage.NotifyOperationError(Strings.Get("LoadingPackagedMediaOperation"), ex);
        }
    }

    private void PlayPauseButton_Click(object sender, RoutedEventArgs e)
    {
        _playback.TogglePlayback();
    }

    private void SeekBackButton_Click(object sender, RoutedEventArgs e)
    {
        _playback.SeekBy(TimeSpan.FromSeconds(-10));
    }

    private void SeekForwardButton_Click(object sender, RoutedEventArgs e)
    {
        _playback.SeekBy(TimeSpan.FromSeconds(10));
    }

    private void Playback_MediaReady(object? sender, EventArgs e)
    {
        SetLoadingState(false);
        SetPlaybackControlsEnabled(true);
        PlaybackStatusTextBlock.Text = Strings.Get("PackagedMediaReady");
        UpdatePosition();
        _rootPage.NotifyUser(
            Strings.Get("PackagedMediaReadyMessage"),
            NotifyType.StatusMessage);
    }

    private void Playback_MediaFailed(object? sender, PlaybackFailedEventArgs e)
    {
        SetLoadingState(false);
        SetPlaybackControlsEnabled(false);
        PlaybackStatusTextBlock.Text = Strings.Get("PlaybackFailedStatus");
        _rootPage.NotifyPlaybackFailure(e);
    }

    private void Playback_PositionChanged(object? sender, EventArgs e)
    {
        UpdatePosition();
    }

    private void Playback_StateChanged(object? sender, EventArgs e)
    {
        bool isPlaying = _playback.State == MediaTimelineControllerState.Running;
        PlayPauseIcon.Symbol = isPlaying ? Symbol.Pause : Symbol.Play;
        PlayPauseButton.Label = Strings.Get(isPlaying ? "PauseLabel" : "PlayLabel");
        AutomationProperties.SetName(PlayPauseButton, PlayPauseButton.Label);
    }

    private void SetLoadingState(bool isLoading)
    {
        LoadingProgressRing.IsActive = isLoading;
        LoadingProgressRing.Visibility =
            isLoading ? Visibility.Visible : Visibility.Collapsed;
        LoadButton.IsEnabled = !isLoading;
    }

    private void SetPlaybackControlsEnabled(bool isEnabled)
    {
        SeekBackButton.IsEnabled = isEnabled;
        PlayPauseButton.IsEnabled = isEnabled;
        SeekForwardButton.IsEnabled = isEnabled;
    }

    private void UpdatePosition()
    {
        PlaybackPositionTextBlock.Text = Strings.Format(
            "PlaybackPositionFormat",
            Strings.FormatPlaybackTime(_playback.Position),
            Strings.FormatPlaybackTime(_playback.NaturalDuration));
    }

    private void Page_Unloaded(object sender, RoutedEventArgs e)
    {
        if (_isDisposed)
        {
            return;
        }

        _isDisposed = true;
        _playback.MediaReady -= Playback_MediaReady;
        _playback.MediaFailed -= Playback_MediaFailed;
        _playback.PlaybackPositionChanged -= Playback_PositionChanged;
        _playback.PlaybackStateChanged -= Playback_StateChanged;
        FrontPlayerElement.SetMediaPlayer(null);
        LeftPlayerElement.SetMediaPlayer(null);
        RightPlayerElement.SetMediaPlayer(null);
        ClosePlayerElement.SetMediaPlayer(null);
        WidePlayerElement.SetMediaPlayer(null);
        _playback.Dispose();
    }
}
