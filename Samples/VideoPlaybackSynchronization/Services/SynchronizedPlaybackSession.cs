using System;
using System.Collections.Generic;
using System.Threading;
using Microsoft.UI.Dispatching;
using Windows.Foundation;
using Windows.Media;
using Windows.Media.Core;
using Windows.Media.Playback;

namespace SDKTemplate;

internal sealed class SynchronizedPlaybackSession : IDisposable
{
    private const long PositionNotificationIntervalTicks = TimeSpan.TicksPerSecond / 2;

    private readonly DispatcherQueue _dispatcherQueue;
    private readonly HashSet<MediaPlayer> _openedPlayers = [];
    private readonly TypedEventHandler<MediaPlayer, MediaPlayerFailedEventArgs>?[]
        _mediaFailedHandlers;
    private readonly TypedEventHandler<MediaPlayer, object>?[] _mediaOpenedHandlers;
    private readonly MediaPlayer[] _players;
    private readonly PlaybackMediaSource?[] _sources;
    private readonly object _stateLock = new();
    private readonly MediaTimelineController _timelineController = new();
    private volatile bool _isDisposed;
    private int _failedLoadGeneration = -1;
    private int _loadGeneration;
    private long _lastReportedPositionTicks = -PositionNotificationIntervalTicks;
    private long _naturalDurationTicks;

    internal SynchronizedPlaybackSession(int playerCount, DispatcherQueue dispatcherQueue)
    {
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(playerCount);
        _dispatcherQueue = dispatcherQueue;
        _mediaFailedHandlers =
            new TypedEventHandler<MediaPlayer, MediaPlayerFailedEventArgs>?[playerCount];
        _mediaOpenedHandlers = new TypedEventHandler<MediaPlayer, object>?[playerCount];
        _players = new MediaPlayer[playerCount];
        _sources = new PlaybackMediaSource?[playerCount];

        for (int index = 0; index < playerCount; index++)
        {
            var player = new MediaPlayer
            {
                AutoPlay = false,
                IsMuted = index != 0,
                TimelineController = _timelineController,
            };
            player.CommandManager.IsEnabled = false;
            _players[index] = player;
        }

        _timelineController.StateChanged += TimelineController_StateChanged;
        _timelineController.PositionChanged += TimelineController_PositionChanged;
    }

    internal event EventHandler? MediaReady;

    internal event EventHandler<PlaybackFailedEventArgs>? MediaFailed;

    internal event EventHandler? PlaybackPositionChanged;

    internal event EventHandler? PlaybackStateChanged;

    internal IReadOnlyList<MediaPlayer> Players => _players;

    internal TimeSpan NaturalDuration =>
        TimeSpan.FromTicks(Math.Max(0, Interlocked.Read(ref _naturalDurationTicks)));

    internal TimeSpan Position => _timelineController.Position;

    internal MediaTimelineControllerState State => _timelineController.State;

    internal void LoadSources(
        IReadOnlyList<PlaybackMediaSource> sources,
        IReadOnlyList<TimeSpan>? positionOffsets = null)
    {
        ObjectDisposedException.ThrowIf(_isDisposed, this);

        if (sources.Count != _players.Length)
        {
            throw new ArgumentException(
                "The number of media sources must match the number of players.",
                nameof(sources));
        }

        if (positionOffsets is not null && positionOffsets.Count != _players.Length)
        {
            throw new ArgumentException(
                "The number of offsets must match the number of players.",
                nameof(positionOffsets));
        }

        for (int index = 0; index < sources.Count; index++)
        {
            ArgumentNullException.ThrowIfNull(sources[index]);
        }

        int generation = PrepareForLoad();
        AttachLoadHandlers(generation);

        try
        {
            for (int index = 0; index < _players.Length; index++)
            {
                PlaybackMediaSource source = sources[index];
                MediaPlayer player = _players[index];
                player.TimelineControllerPositionOffset =
                    positionOffsets?[index] ?? TimeSpan.Zero;
                _sources[index] = source;
                player.Source = source.MediaSource;
            }
        }
        catch
        {
            DetachLoadHandlers();
            Interlocked.Exchange(ref _failedLoadGeneration, generation);
            for (int index = 0; index < _players.Length; index++)
            {
                _players[index].Source = null;
                _sources[index] = null;
            }

            for (int index = 0; index < sources.Count; index++)
            {
                sources[index].Dispose();
            }

            throw;
        }
    }

    internal void ClearSources()
    {
        ObjectDisposedException.ThrowIf(_isDisposed, this);

        PrepareForLoad();
        Enqueue(() => PlaybackPositionChanged?.Invoke(this, EventArgs.Empty));
    }

    internal void TogglePlayback()
    {
        ObjectDisposedException.ThrowIf(_isDisposed, this);

        if (_timelineController.State == MediaTimelineControllerState.Paused)
        {
            if (NaturalDuration > TimeSpan.Zero && Position >= NaturalDuration)
            {
                _timelineController.Position = TimeSpan.Zero;
            }

            _timelineController.Resume();
        }
        else if (_timelineController.State == MediaTimelineControllerState.Running)
        {
            _timelineController.Pause();
        }
    }

    internal void SeekBy(TimeSpan amount)
    {
        ObjectDisposedException.ThrowIf(_isDisposed, this);

        TimeSpan requestedPosition = _timelineController.Position + amount;
        if (requestedPosition < TimeSpan.Zero)
        {
            requestedPosition = TimeSpan.Zero;
        }

        TimeSpan duration = NaturalDuration;
        if (duration > TimeSpan.Zero && requestedPosition > duration)
        {
            requestedPosition = duration;
        }

        _timelineController.Position = requestedPosition;
    }

    public void Dispose()
    {
        if (_isDisposed)
        {
            return;
        }

        _isDisposed = true;
        Interlocked.Increment(ref _loadGeneration);
        DetachLoadHandlers();
        _timelineController.StateChanged -= TimelineController_StateChanged;
        _timelineController.PositionChanged -= TimelineController_PositionChanged;
        _timelineController.Pause();
        ResetSources();

        foreach (MediaPlayer player in _players)
        {
            player.Dispose();
        }
    }

    private void Player_MediaOpened(MediaPlayer sender, int generation)
    {
        bool allPlayersOpened;
        lock (_stateLock)
        {
            if (_isDisposed
                || generation != Volatile.Read(ref _loadGeneration)
                || generation == Volatile.Read(ref _failedLoadGeneration)
                || !_openedPlayers.Add(sender))
            {
                return;
            }

            TimeSpan naturalDuration = sender.PlaybackSession.NaturalDuration;
            if (naturalDuration != TimeSpan.MaxValue)
            {
                TimeSpan controllerDuration =
                    naturalDuration - sender.TimelineControllerPositionOffset;
                UpdateNaturalDuration(controllerDuration);
            }

            allPlayersOpened = _openedPlayers.Count == _players.Length;
        }

        if (allPlayersOpened)
        {
            EnqueueForLoad(generation, requireHealthyLoad: true, () =>
            {
                PlaybackPositionChanged?.Invoke(this, EventArgs.Empty);
                MediaReady?.Invoke(this, EventArgs.Empty);
            });
        }
    }

    private void Player_MediaFailed(
        MediaPlayer sender,
        MediaPlayerFailedEventArgs args,
        int generation)
    {
        lock (_stateLock)
        {
            if (_isDisposed
                || generation != Volatile.Read(ref _loadGeneration)
                || generation == Volatile.Read(ref _failedLoadGeneration))
            {
                return;
            }

            Interlocked.Exchange(ref _failedLoadGeneration, generation);
            _openedPlayers.Clear();
        }

        _timelineController.Pause();
        var failure = new PlaybackFailedEventArgs(
            args.Error,
            args.ExtendedErrorCode.HResult,
            args.ErrorMessage);
        EnqueueForLoad(
            generation,
            requireHealthyLoad: false,
            () => MediaFailed?.Invoke(this, failure));
    }

    private void TimelineController_StateChanged(
        MediaTimelineController sender,
        object args)
    {
        Enqueue(() => PlaybackStateChanged?.Invoke(this, EventArgs.Empty));
    }

    private void TimelineController_PositionChanged(
        MediaTimelineController sender,
        object args)
    {
        TimeSpan duration = NaturalDuration;
        TimeSpan position = sender.Position;
        if (duration > TimeSpan.Zero && position >= duration)
        {
            if (position > duration)
            {
                sender.Position = duration;
                position = duration;
            }

            sender.Pause();
        }

        long previousTicks = Interlocked.Read(ref _lastReportedPositionTicks);
        if (Math.Abs(position.Ticks - previousTicks) >= PositionNotificationIntervalTicks)
        {
            Interlocked.Exchange(ref _lastReportedPositionTicks, position.Ticks);
            Enqueue(() => PlaybackPositionChanged?.Invoke(this, EventArgs.Empty));
        }
    }

    private void UpdateNaturalDuration(TimeSpan candidate)
    {
        if (candidate <= TimeSpan.Zero)
        {
            return;
        }

        long candidateTicks = candidate.Ticks;
        long currentTicks = Interlocked.Read(ref _naturalDurationTicks);
        while (candidateTicks > currentTicks)
        {
            long observed = Interlocked.CompareExchange(
                ref _naturalDurationTicks,
                candidateTicks,
                currentTicks);
            if (observed == currentTicks)
            {
                return;
            }

            currentTicks = observed;
        }
    }

    private int PrepareForLoad()
    {
        int generation = Interlocked.Increment(ref _loadGeneration);
        DetachLoadHandlers();
        _timelineController.Pause();
        ResetSources();
        _timelineController.Position = TimeSpan.Zero;
        Interlocked.Exchange(ref _failedLoadGeneration, -1);
        Interlocked.Exchange(ref _naturalDurationTicks, 0);
        Interlocked.Exchange(
            ref _lastReportedPositionTicks,
            -PositionNotificationIntervalTicks);
        lock (_stateLock)
        {
            _openedPlayers.Clear();
        }

        return generation;
    }

    private void AttachLoadHandlers(int generation)
    {
        for (int index = 0; index < _players.Length; index++)
        {
            TypedEventHandler<MediaPlayer, object> openedHandler =
                (sender, args) => Player_MediaOpened(sender, generation);
            TypedEventHandler<MediaPlayer, MediaPlayerFailedEventArgs> failedHandler =
                (sender, args) => Player_MediaFailed(sender, args, generation);
            _mediaOpenedHandlers[index] = openedHandler;
            _mediaFailedHandlers[index] = failedHandler;
            _players[index].MediaOpened += openedHandler;
            _players[index].MediaFailed += failedHandler;
        }
    }

    private void DetachLoadHandlers()
    {
        for (int index = 0; index < _players.Length; index++)
        {
            TypedEventHandler<MediaPlayer, object>? openedHandler =
                _mediaOpenedHandlers[index];
            if (openedHandler is not null)
            {
                _players[index].MediaOpened -= openedHandler;
                _mediaOpenedHandlers[index] = null;
            }

            TypedEventHandler<MediaPlayer, MediaPlayerFailedEventArgs>? failedHandler =
                _mediaFailedHandlers[index];
            if (failedHandler is not null)
            {
                _players[index].MediaFailed -= failedHandler;
                _mediaFailedHandlers[index] = null;
            }
        }
    }

    private void ResetSources()
    {
        for (int index = 0; index < _players.Length; index++)
        {
            _players[index].Source = null;
            _sources[index]?.Dispose();
            _sources[index] = null;
            _players[index].TimelineControllerPositionOffset = TimeSpan.Zero;
        }
    }

    private void Enqueue(Action action)
    {
        if (_isDisposed)
        {
            return;
        }

        _dispatcherQueue.TryEnqueue(() =>
        {
            if (!_isDisposed)
            {
                action();
            }
        });
    }

    private void EnqueueForLoad(
        int generation,
        bool requireHealthyLoad,
        Action action)
    {
        Enqueue(() =>
        {
            if (generation != Volatile.Read(ref _loadGeneration)
                || (requireHealthyLoad
                    && generation == Volatile.Read(ref _failedLoadGeneration)))
            {
                return;
            }

            action();
        });
    }
}

internal sealed class PlaybackFailedEventArgs(
    MediaPlayerError error,
    int hResult,
    string message) : EventArgs
{
    internal MediaPlayerError Error { get; } = error;

    internal int HResult { get; } = hResult;

    internal string Message { get; } = message;
}

internal sealed class PlaybackMediaSource : IDisposable
{
    private readonly IDisposable? _dependency;
    private bool _isDisposed;

    internal PlaybackMediaSource(MediaSource mediaSource, IDisposable? dependency = null)
    {
        ArgumentNullException.ThrowIfNull(mediaSource);
        MediaSource = mediaSource;
        _dependency = dependency;
    }

    internal MediaSource MediaSource { get; }

    public void Dispose()
    {
        if (_isDisposed)
        {
            return;
        }

        _isDisposed = true;
        MediaSource.Dispose();
        _dependency?.Dispose();
    }
}
