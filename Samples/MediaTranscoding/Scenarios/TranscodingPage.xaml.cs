using System;
using System.Globalization;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Navigation;
using Windows.Media.Core;
using Windows.Media.MediaProperties;
using Windows.Media.Playback;
using Windows.Media.Transcoding;
using Windows.Storage;
using Windows.Storage.Pickers;

namespace SDKTemplate;

public sealed partial class TranscodingPage : Page
{
    private readonly MainPage _rootPage = MainPage.Current;
    private readonly MediaPlayer _inputPlayer = new();
    private readonly MediaPlayer _outputPlayer = new();
    private CancellationTokenSource? _transcodeCancellation;
    private MediaSource? _inputMediaSource;
    private MediaSource? _outputMediaSource;
    private StorageFile? _inputFile;
    private StorageFile? _outputFile;
    private TranscodingScenario _scenario;
    private TimeSpan _sourceDuration;
    private TimeSpan _trimStart;
    private TimeSpan _trimEnd;
    private bool _isActive;
    private bool _isDisposed;
    private bool _isTranscoding;

    public TranscodingPage()
    {
        InitializeComponent();
        NavigationCacheMode = NavigationCacheMode.Disabled;

        InputPlayerElement.SetMediaPlayer(_inputPlayer);
        OutputPlayerElement.SetMediaPlayer(_outputPlayer);
        _inputPlayer.MediaOpened += InputPlayer_MediaOpened;
        Unloaded += TranscodingPage_Unloaded;
    }

    protected override void OnNavigatedTo(NavigationEventArgs e)
    {
        base.OnNavigatedTo(e);
        _scenario = e.Parameter is TranscodingScenario scenario
            ? scenario
            : throw new InvalidOperationException("A transcoding scenario is required.");
        _isActive = true;

        ConfigureScenario();
        ResetSourceSelection();
        SetProgress(Strings.Get("ProgressIdle"), 0, false);
        UpdateControls();
    }

    protected override void OnNavigatedFrom(NavigationEventArgs e)
    {
        _isActive = false;
        CancelAndDispose();
        base.OnNavigatedFrom(e);
    }

    private async void PickSourceButton_Click(object sender, RoutedEventArgs e)
    {
        try
        {
            var picker = new FileOpenPicker
            {
                SuggestedStartLocation = PickerLocationId.VideosLibrary,
            };
            picker.FileTypeFilter.Add(".mp4");
            picker.FileTypeFilter.Add(".wmv");
            InitializePicker(picker);

            StorageFile? file = await picker.PickSingleFileAsync();
            if (file is null)
            {
                return;
            }

            var videoProperties = await file.Properties.GetVideoPropertiesAsync();
            _inputFile = file;
            _sourceDuration = videoProperties.Duration;
            _trimStart = TimeSpan.Zero;
            _trimEnd = _sourceDuration;
            SelectedSourceTextBlock.Text =
                Strings.Format("SelectedSourceFormat", GetDisplayPath(file));

            ResetOutputSelection(clearPreview: true);
            SetInputSource(file);
            UpdateTrimDisplay();
            UpdateControls();

            _rootPage.NotifyUser(
                Strings.Format("SourceSelectedFormat", file.Name),
                NotifyType.StatusMessage);
        }
        catch (Exception ex)
        {
            _rootPage.NotifyOperationError(Strings.Get("SelectingSourceOperation"), ex);
        }
    }

    private async void PickOutputButton_Click(object sender, RoutedEventArgs e)
    {
        if (_inputFile is null)
        {
            _rootPage.NotifyUser(
                Strings.Get("ChooseSourceFirst"),
                NotifyType.ErrorMessage);
            return;
        }

        OutputFormat outputFormat = GetSelectedOutputFormat();

        try
        {
            var picker = new FileSavePicker
            {
                DefaultFileExtension = GetFileExtension(outputFormat),
                SuggestedFileName = Strings.Get("DefaultOutputFileName"),
                SuggestedStartLocation = PickerLocationId.VideosLibrary,
            };
            picker.FileTypeChoices.Add(
                GetFileTypeDescription(outputFormat),
                [GetFileExtension(outputFormat)]);
            InitializePicker(picker);

            StorageFile? file = await picker.PickSaveFileAsync();
            if (file is null)
            {
                return;
            }

            if (file.IsEqual(_inputFile))
            {
                _rootPage.NotifyUser(
                    Strings.Get("SourceAndOutputMustDiffer"),
                    NotifyType.ErrorMessage);
                return;
            }

            ClearOutputPreview();
            _outputFile = file;
            SelectedOutputTextBlock.Text =
                Strings.Format("SelectedOutputFormat", GetDisplayPath(file));
            UpdateControls();

            _rootPage.NotifyUser(
                Strings.Format("OutputSelectedFormat", file.Name),
                NotifyType.StatusMessage);
        }
        catch (Exception ex)
        {
            _rootPage.NotifyOperationError(Strings.Get("SelectingOutputOperation"), ex);
        }
    }

    private async void TranscodeButton_Click(object sender, RoutedEventArgs e)
    {
        if (_isTranscoding)
        {
            return;
        }

        StorageFile? inputFile = _inputFile;
        StorageFile? outputFile = _outputFile;
        if (inputFile is null)
        {
            _rootPage.NotifyUser(
                Strings.Get("ChooseSourceFirst"),
                NotifyType.ErrorMessage);
            return;
        }

        if (outputFile is null)
        {
            _rootPage.NotifyUser(
                Strings.Get("ChooseOutputFirst"),
                NotifyType.ErrorMessage);
            return;
        }

        MediaEncodingProfile? profile = CreateEncodingProfile();
        MediaTranscoder? transcoder = CreateTranscoder();
        if (profile is null || transcoder is null)
        {
            return;
        }

        var cancellation = new CancellationTokenSource();
        _transcodeCancellation = cancellation;
        _isTranscoding = true;
        _inputPlayer.Pause();
        _outputPlayer.Pause();
        SetProgress(Strings.Get("PreparingTranscode"), 0, true);
        UpdateControls();

        try
        {
            PrepareTranscodeResult prepared =
                await transcoder.PrepareFileTranscodeAsync(inputFile, outputFile, profile);
            if (!prepared.CanTranscode)
            {
                await DeletePartialOutputAsync(outputFile);
                NotifyTranscodeFailure(prepared.FailureReason);
                return;
            }

            SetProgress(Strings.Format("ProgressPercentFormat", 0), 0, false);
            var progress = new Progress<double>(value =>
                SetProgress(
                    Strings.Format("ProgressPercentFormat", value),
                    value,
                    false));

            await prepared.TranscodeAsync().AsTask(cancellation.Token, progress);
            cancellation.Token.ThrowIfCancellationRequested();

            SetOutputSource(outputFile);
            OutputPathTextBlock.Text =
                Strings.Format("OutputPathFormat", GetDisplayPath(outputFile));
            SetProgress(Strings.Get("TranscodeCompleted"), 100, false);
            _outputFile = null;
            SelectedOutputTextBlock.Text = Strings.Get("NoOutputSelected");

            if (_isActive)
            {
                _rootPage.NotifyUser(
                    Strings.Format("TranscodeCompletedFormat", outputFile.Name),
                    NotifyType.StatusMessage);
            }
        }
        catch (OperationCanceledException)
        {
            await DeletePartialOutputAsync(outputFile);
            SetProgress(Strings.Get("TranscodeCanceled"), 0, false);
            if (_isActive)
            {
                _rootPage.NotifyUser(
                    Strings.Get("TranscodeCanceled"),
                    NotifyType.StatusMessage);
            }
        }
        catch (Exception ex)
        {
            await DeletePartialOutputAsync(outputFile);
            if (_isActive)
            {
                _rootPage.NotifyOperationError(Strings.Get("TranscodingOperation"), ex);
            }
        }
        finally
        {
            if (ReferenceEquals(_transcodeCancellation, cancellation))
            {
                _transcodeCancellation = null;
            }

            cancellation.Dispose();
            _isTranscoding = false;
            UpdateControls();
        }
    }

    private void CancelButton_Click(object sender, RoutedEventArgs e)
    {
        CancelButton.IsEnabled = false;
        SetProgress(Strings.Get("CancelingTranscode"), TranscodeProgressBar.Value, true);
        _transcodeCancellation?.Cancel();
    }

    private void TargetFormatComboBox_SelectionChanged(
        object sender,
        SelectionChangedEventArgs e)
    {
        UpdateFormatOptions();

        if (_outputFile is not null)
        {
            ResetOutputSelection(clearPreview: false);
            _rootPage.NotifyUser(
                Strings.Get("ChooseOutputAgain"),
                NotifyType.StatusMessage);
        }

        UpdateControls();
    }

    private void MarkInButton_Click(object sender, RoutedEventArgs e)
    {
        TimeSpan position = ClampToDuration(_inputPlayer.PlaybackSession.Position);
        if (position >= _trimEnd)
        {
            _rootPage.NotifyUser(
                Strings.Get("TrimStartBeforeEnd"),
                NotifyType.ErrorMessage);
            return;
        }

        _trimStart = position;
        UpdateTrimDisplay();
        _rootPage.NotifyUser(
            Strings.Format("TrimStartUpdatedFormat", FormatTime(position)),
            NotifyType.StatusMessage);
    }

    private void MarkOutButton_Click(object sender, RoutedEventArgs e)
    {
        TimeSpan position = ClampToDuration(_inputPlayer.PlaybackSession.Position);
        if (position <= _trimStart)
        {
            _rootPage.NotifyUser(
                Strings.Get("TrimEndAfterStart"),
                NotifyType.ErrorMessage);
            return;
        }

        _trimEnd = position;
        UpdateTrimDisplay();
        _rootPage.NotifyUser(
            Strings.Format("TrimEndUpdatedFormat", FormatTime(position)),
            NotifyType.StatusMessage);
    }

    private void InputPlayer_MediaOpened(MediaPlayer sender, object args)
    {
        TimeSpan duration = sender.PlaybackSession.NaturalDuration;
        if (duration <= TimeSpan.Zero)
        {
            return;
        }

        DispatcherQueue.TryEnqueue(() =>
        {
            if (!_isActive || _isDisposed)
            {
                return;
            }

            _sourceDuration = duration;
            if (_trimEnd <= TimeSpan.Zero || _trimEnd > duration)
            {
                _trimEnd = duration;
            }

            UpdateTrimDisplay();
            UpdateControls();
        });
    }

    private void TranscodingPage_Unloaded(object sender, RoutedEventArgs e)
    {
        _isActive = false;
        CancelAndDispose();
    }

    private void InitializePicker(object picker)
    {
        nint windowHandle = WinRT.Interop.WindowNative.GetWindowHandle(App.MainWindow);
        WinRT.Interop.InitializeWithWindow.Initialize(picker, windowHandle);
    }

    private void SetInputSource(StorageFile file)
    {
        _inputPlayer.Source = null;
        _inputMediaSource?.Dispose();
        _inputMediaSource = MediaSource.CreateFromStorageFile(file);
        _inputPlayer.Source = _inputMediaSource;
        _inputPlayer.Play();
    }

    private void SetOutputSource(StorageFile file)
    {
        ClearOutputPreview();
        _outputMediaSource = MediaSource.CreateFromStorageFile(file);
        _outputPlayer.Source = _outputMediaSource;
        _outputPlayer.Play();
    }

    private void ClearOutputPreview()
    {
        _outputPlayer.Source = null;
        _outputMediaSource?.Dispose();
        _outputMediaSource = null;
        OutputPathTextBlock.Text = string.Empty;
    }

    private async Task DeletePartialOutputAsync(StorageFile outputFile)
    {
        try
        {
            await outputFile.DeleteAsync();
        }
        catch (Exception ex)
        {
            if (_isActive)
            {
                _rootPage.NotifyOperationError(
                    Strings.Get("DeletingPartialOutputOperation"),
                    ex);
            }
        }
        finally
        {
            _outputFile = null;
            if (_isActive)
            {
                SelectedOutputTextBlock.Text = Strings.Get("NoOutputSelected");
            }
        }
    }

    private void NotifyTranscodeFailure(TranscodeFailureReason reason)
    {
        string message = reason switch
        {
            TranscodeFailureReason.CodecNotFound => Strings.Get("CodecNotFound"),
            TranscodeFailureReason.InvalidProfile => Strings.Get("InvalidProfile"),
            _ => Strings.Format("UnknownTranscodeFailureFormat", reason),
        };

        if (_isActive)
        {
            _rootPage.NotifyUser(message, NotifyType.ErrorMessage);
        }
    }

    private void SetProgress(string message, double value, bool isIndeterminate)
    {
        void Update()
        {
            if (!_isActive || _isDisposed)
            {
                return;
            }

            ProgressPanel.Visibility = Visibility.Visible;
            ProgressTextBlock.Text = message;
            TranscodeProgressBar.IsIndeterminate = isIndeterminate;
            TranscodeProgressBar.Value = Math.Clamp(value, 0, 100);
        }

        if (DispatcherQueue.HasThreadAccess)
        {
            Update();
        }
        else
        {
            DispatcherQueue.TryEnqueue(Update);
        }
    }

    private void ResetSourceSelection()
    {
        _inputFile = null;
        _sourceDuration = TimeSpan.Zero;
        _trimStart = TimeSpan.Zero;
        _trimEnd = TimeSpan.Zero;
        SelectedSourceTextBlock.Text = Strings.Get("NoSourceSelected");
        ResetOutputSelection(clearPreview: true);
        UpdateTrimDisplay();
    }

    private void ResetOutputSelection(bool clearPreview)
    {
        _outputFile = null;
        SelectedOutputTextBlock.Text = Strings.Get("NoOutputSelected");
        if (clearPreview)
        {
            ClearOutputPreview();
        }
    }

    private void UpdateControls()
    {
        if (_isDisposed)
        {
            return;
        }

        bool canEdit = !_isTranscoding;
        bool hasSource = _inputFile is not null;
        bool hasOutput = _outputFile is not null;
        bool canMarkTrim =
            canEdit &&
            _scenario == TranscodingScenario.Trim &&
            hasSource &&
            _sourceDuration > TimeSpan.Zero;

        PickSourceButton.IsEnabled = canEdit;
        PickOutputButton.IsEnabled = canEdit && hasSource;
        TargetFormatComboBox.IsEnabled = canEdit;
        PresetComboBox.IsEnabled = canEdit;
        EnableMrfCheckBox.IsEnabled = canEdit;
        VideoWidthTextBox.IsEnabled = canEdit;
        VideoHeightTextBox.IsEnabled = canEdit;
        VideoBitrateTextBox.IsEnabled = canEdit;
        VideoFrameRateTextBox.IsEnabled = canEdit;
        AudioBitsPerSampleTextBox.IsEnabled = canEdit;
        AudioSampleRateTextBox.IsEnabled = canEdit;
        AudioBitrateTextBox.IsEnabled = canEdit;
        AudioChannelCountTextBox.IsEnabled = canEdit;
        MarkInButton.IsEnabled = canMarkTrim;
        MarkOutButton.IsEnabled = canMarkTrim;
        TranscodeButton.IsEnabled = canEdit && hasSource && hasOutput;
        CancelButton.IsEnabled = _isTranscoding;
        InputPlayerElement.IsEnabled = canEdit && hasSource;
        OutputPlayerElement.IsEnabled = canEdit && _outputMediaSource is not null;
    }

    private void UpdateTrimDisplay()
    {
        TrimStartTextBlock.Text = FormatTime(_trimStart);
        TrimEndTextBlock.Text = FormatTime(_trimEnd);
    }

    private TimeSpan ClampToDuration(TimeSpan value)
    {
        if (value < TimeSpan.Zero)
        {
            return TimeSpan.Zero;
        }

        return _sourceDuration > TimeSpan.Zero && value > _sourceDuration
            ? _sourceDuration
            : value;
    }

    private static string GetDisplayPath(StorageFile file)
    {
        return string.IsNullOrEmpty(file.Path) ? file.Name : file.Path;
    }

    private static string FormatTime(TimeSpan value)
    {
        return Strings.Format(
            "TimeValueFormat",
            (int)value.TotalHours,
            value.Minutes,
            value.Seconds,
            value.Milliseconds);
    }

    private void CancelAndDispose()
    {
        if (_isDisposed)
        {
            return;
        }

        _isDisposed = true;
        _transcodeCancellation?.Cancel();
        _inputPlayer.MediaOpened -= InputPlayer_MediaOpened;
        _inputPlayer.Dispose();
        _outputPlayer.Dispose();
        _inputMediaSource?.Dispose();
        _outputMediaSource?.Dispose();
    }
}
