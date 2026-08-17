using System;
using System.Diagnostics.CodeAnalysis;
using System.Threading.Tasks;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Automation;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Navigation;
using Windows.Media;
using Windows.Media.Core;
using Windows.Media.Streaming.Adaptive;

namespace SDKTemplate;

public sealed partial class AdaptiveSyncPage : Page
{
    private const string DefaultStreamUri =
        "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8";

    private readonly MainPage _rootPage = MainPage.Current;
    private readonly SynchronizedPlaybackSession _playback;
    private bool _isDisposed;
    private bool _isLoading;

    public AdaptiveSyncPage()
    {
        InitializeComponent();
        NavigationCacheMode = NavigationCacheMode.Disabled;

        FirstStreamUriTextBox.Text = DefaultStreamUri;
        SecondStreamUriTextBox.Text = DefaultStreamUri;

        _playback = new SynchronizedPlaybackSession(2, DispatcherQueue);
        FirstStreamPlayerElement.SetMediaPlayer(_playback.Players[0]);
        SecondStreamPlayerElement.SetMediaPlayer(_playback.Players[1]);

        _playback.MediaReady += Playback_MediaReady;
        _playback.MediaFailed += Playback_MediaFailed;
        _playback.PlaybackPositionChanged += Playback_PositionChanged;
        _playback.PlaybackStateChanged += Playback_StateChanged;
    }

    private async void LoadButton_Click(object sender, RoutedEventArgs e)
    {
        if (_isLoading)
        {
            return;
        }

        if (!TryGetHttpsUri(
                FirstStreamUriTextBox.Text,
                Strings.Get("FirstStreamName"),
                out Uri? firstUri)
            || !TryGetHttpsUri(
                SecondStreamUriTextBox.Text,
                Strings.Get("SecondStreamName"),
                out Uri? secondUri))
        {
            return;
        }

        double offsetSeconds = SecondStreamOffsetNumberBox.Value;
        if (!double.IsFinite(offsetSeconds))
        {
            _rootPage.NotifyUser(
                Strings.Get("InvalidAdaptiveOffset"),
                NotifyType.ErrorMessage);
            return;
        }

        SetLoadingState(true);
        SetPlaybackControlsEnabled(false);
        PlaybackStatusTextBlock.Text = Strings.Get("CreatingAdaptiveSources");

        PlaybackMediaSource? firstSource = null;
        PlaybackMediaSource? secondSource = null;
        try
        {
            _playback.ClearSources();
            firstSource = await CreateAdaptiveMediaSourceAsync(firstUri);
            if (_isDisposed)
            {
                firstSource.Dispose();
                return;
            }

            secondSource = await CreateAdaptiveMediaSourceAsync(secondUri);
            if (_isDisposed)
            {
                firstSource.Dispose();
                secondSource.Dispose();
                return;
            }

            PlaybackMediaSource[] sources = [firstSource, secondSource];
            firstSource = null;
            secondSource = null;
            TimeSpan[] offsets =
            [
                TimeSpan.Zero,
                TimeSpan.FromSeconds(offsetSeconds),
            ];
            _playback.LoadSources(sources, offsets);
            PlaybackStatusTextBlock.Text = Strings.Get("OpeningAdaptiveStreams");
        }
        catch (Exception ex)
        {
            firstSource?.Dispose();
            secondSource?.Dispose();
            if (!_isDisposed)
            {
                SetLoadingState(false);
                PlaybackStatusTextBlock.Text = Strings.Get("AdaptiveLoadFailedStatus");
                _rootPage.NotifyOperationError(
                    Strings.Get("LoadingAdaptiveStreamsOperation"),
                    ex);
            }
        }
    }

    private void PlayPauseButton_Click(object sender, RoutedEventArgs e)
    {
        _playback.TogglePlayback();
    }

    private void SeekBack30Button_Click(object sender, RoutedEventArgs e)
    {
        _playback.SeekBy(TimeSpan.FromSeconds(-30));
    }

    private void SeekBack2Button_Click(object sender, RoutedEventArgs e)
    {
        _playback.SeekBy(TimeSpan.FromSeconds(-2));
    }

    private void SeekForward2Button_Click(object sender, RoutedEventArgs e)
    {
        _playback.SeekBy(TimeSpan.FromSeconds(2));
    }

    private void SeekForward30Button_Click(object sender, RoutedEventArgs e)
    {
        _playback.SeekBy(TimeSpan.FromSeconds(30));
    }

    private void Playback_MediaReady(object? sender, EventArgs e)
    {
        SetLoadingState(false);
        SetPlaybackControlsEnabled(true);
        PlaybackStatusTextBlock.Text = Strings.Get("AdaptiveStreamsReady");
        UpdatePosition();
        _rootPage.NotifyUser(
            Strings.Get("AdaptiveStreamsReadyMessage"),
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

    private bool TryGetHttpsUri(
        string value,
        string sourceName,
        [NotNullWhen(true)] out Uri? uri)
    {
        if (Uri.TryCreate(value.Trim(), UriKind.Absolute, out uri)
            && string.Equals(uri.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        _rootPage.NotifyUser(
            Strings.Format("HttpsUriRequired", sourceName),
            NotifyType.ErrorMessage);
        uri = null;
        return false;
    }

    private static async Task<PlaybackMediaSource> CreateAdaptiveMediaSourceAsync(Uri uri)
    {
        AdaptiveMediaSourceCreationResult result =
            await AdaptiveMediaSource.CreateFromUriAsync(uri);
        if (result.Status != AdaptiveMediaSourceCreationStatus.Success
            || result.MediaSource is null)
        {
            int hResult = result.ExtendedError?.HResult ?? unchecked((int)0x80004005);
            throw new InvalidOperationException(
                Strings.Format(
                    "AdaptiveCreationFailedFormat",
                    result.Status,
                    hResult));
        }

        AdaptiveMediaSource adaptiveMediaSource = result.MediaSource;
        try
        {
            return new PlaybackMediaSource(
                MediaSource.CreateFromAdaptiveMediaSource(adaptiveMediaSource),
                adaptiveMediaSource);
        }
        catch
        {
            adaptiveMediaSource.Dispose();
            throw;
        }
    }

    private void SetLoadingState(bool isLoading)
    {
        _isLoading = isLoading;
        LoadingProgressRing.IsActive = isLoading;
        LoadingProgressRing.Visibility =
            isLoading ? Visibility.Visible : Visibility.Collapsed;
        LoadButton.IsEnabled = !isLoading;
        FirstStreamUriTextBox.IsEnabled = !isLoading;
        SecondStreamUriTextBox.IsEnabled = !isLoading;
        SecondStreamOffsetNumberBox.IsEnabled = !isLoading;
    }

    private void SetPlaybackControlsEnabled(bool isEnabled)
    {
        SeekBack30Button.IsEnabled = isEnabled;
        SeekBack2Button.IsEnabled = isEnabled;
        PlayPauseButton.IsEnabled = isEnabled;
        SeekForward2Button.IsEnabled = isEnabled;
        SeekForward30Button.IsEnabled = isEnabled;
    }

    private void UpdatePosition()
    {
        TimeSpan duration = _playback.NaturalDuration;
        string durationText = duration > TimeSpan.Zero
            ? Strings.FormatPlaybackTime(duration)
            : Strings.Get("LiveDuration");
        PlaybackPositionTextBlock.Text = Strings.Format(
            "PlaybackPositionFormat",
            Strings.FormatPlaybackTime(_playback.Position),
            durationText);
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
        FirstStreamPlayerElement.SetMediaPlayer(null);
        SecondStreamPlayerElement.SetMediaPlayer(null);
        _playback.Dispose();
    }
}
