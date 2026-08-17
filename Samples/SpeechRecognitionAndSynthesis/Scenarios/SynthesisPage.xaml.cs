using System;
using System.IO;
using System.Linq;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Navigation;
using Windows.Foundation.Collections;
using Windows.Media.Core;
using Windows.Media.Playback;
using Windows.Media.SpeechSynthesis;

namespace SDKTemplate.Scenarios;

public sealed partial class SynthesisPage : Page
{
    private readonly SpeechSynthesizer _synthesizer = new();
    private readonly MediaPlayer _mediaPlayer = new() { AutoPlay = false };
    private SpeechSynthesisStream? _synthesisStream;
    private SynthesisKind _kind;
    private bool _isConfigured;
    private bool _isPlaying;
    private bool _isActive;
    private bool _includeWordBoundaries;
    private bool _includeSentenceBoundaries;

    public SynthesisPage()
    {
        InitializeComponent();

        _mediaPlayer.MediaEnded += MediaPlayer_MediaEnded;
        _mediaPlayer.MediaFailed += MediaPlayer_MediaFailed;
        PlayerElement.SetMediaPlayer(_mediaPlayer);
        PopulateVoices();
    }

    protected override void OnNavigatedTo(NavigationEventArgs e)
    {
        _kind = e.Parameter is SynthesisKind kind ? kind : SynthesisKind.Text;
        _isActive = true;
        _isConfigured = true;
        ConfigureScenario();
        UpdateTextForSelectedVoice();
    }

    protected override void OnNavigatedFrom(NavigationEventArgs e)
    {
        _isActive = false;
        StopPlayback();
        _mediaPlayer.MediaEnded -= MediaPlayer_MediaEnded;
        _mediaPlayer.MediaFailed -= MediaPlayer_MediaFailed;
        _mediaPlayer.Dispose();
        _synthesizer.Dispose();
    }

    private void ConfigureScenario()
    {
        BoundaryOptionsPanel.Visibility = Visibility.Collapsed;
        BoundaryResultsPanel.Visibility = Visibility.Collapsed;
        LastMarkTextBox.Visibility = Visibility.Collapsed;

        switch (_kind)
        {
            case SynthesisKind.Text:
                ScenarioTitleTextBlock.Text = "Synthesize Text";
                ScenarioDescriptionTextBlock.Text =
                    "Convert plain text to speech, choose from installed voices, and play the generated stream.";
                InputTextBox.Header = "Text to synthesize";
                InputTextBox.MinHeight = 120;
                break;

            case SynthesisKind.Boundaries:
                ScenarioTitleTextBlock.Text = "Synthesize Text with Boundaries";
                ScenarioDescriptionTextBlock.Text =
                    "Generate word and sentence metadata while synthesized speech plays, then use each cue to update the interface.";
                InputTextBox.Header = "Text to synthesize";
                InputTextBox.MinHeight = 150;
                BoundaryOptionsPanel.Visibility = Visibility.Visible;
                BoundaryResultsPanel.Visibility = Visibility.Visible;
                break;

            case SynthesisKind.Ssml:
                ScenarioTitleTextBlock.Text = "Synthesize SSML";
                ScenarioDescriptionTextBlock.Text =
                    "Synthesize editable Speech Synthesis Markup Language and receive timed events for SSML marks.";
                InputTextBox.Header = "SSML to synthesize";
                InputTextBox.MinHeight = 360;
                LastMarkTextBox.Visibility = Visibility.Visible;
                break;
        }
    }

    private void PopulateVoices()
    {
        VoiceInformation currentVoice = _synthesizer.Voice;

        foreach (VoiceInformation voice in SpeechSynthesizer.AllVoices
                     .OrderBy(voice => voice.Language)
                     .ThenBy(voice => voice.DisplayName))
        {
            var item = new ComboBoxItem
            {
                Content = $"{voice.DisplayName} ({voice.Language})",
                Tag = voice,
            };

            VoiceComboBox.Items.Add(item);
            if (voice.Id == currentVoice.Id)
            {
                VoiceComboBox.SelectedItem = item;
            }
        }
    }

    private void VoiceComboBox_SelectionChanged(
        object sender,
        SelectionChangedEventArgs e)
    {
        if (VoiceComboBox.SelectedItem is not ComboBoxItem { Tag: VoiceInformation voice })
        {
            return;
        }

        _synthesizer.Voice = voice;

        if (_isConfigured)
        {
            UpdateTextForSelectedVoice();
        }
    }

    private void UpdateTextForSelectedVoice()
    {
        string languageTag = _synthesizer.Voice.Language;
        string resourceId = _kind switch
        {
            SynthesisKind.Text => "SynthesizeTextDefaultText",
            SynthesisKind.Boundaries => "SynthesizeTextBoundariesDefaultText",
            SynthesisKind.Ssml => "SynthesizeSSMLDefaultText",
            _ => throw new InvalidOperationException($"Unknown synthesis scenario '{_kind}'."),
        };

        InputTextBox.Text =
            SpeechResourceProvider.GetSynthesisString(resourceId, languageTag);
    }

    private async void SpeakButton_Click(object sender, RoutedEventArgs e)
    {
        if (_isPlaying)
        {
            StopPlayback();
            return;
        }

        if (string.IsNullOrWhiteSpace(InputTextBox.Text))
        {
            MainPage.Current.NotifyUser(
                "Enter text or SSML to synthesize.",
                NotifyType.ErrorMessage);
            return;
        }

        SpeakButton.IsEnabled = false;
        VoiceComboBox.IsEnabled = false;

        try
        {
            _includeWordBoundaries = WordBoundariesCheckBox.IsChecked == true;
            _includeSentenceBoundaries = SentenceBoundariesCheckBox.IsChecked == true;
            _synthesizer.Options.IncludeWordBoundaryMetadata =
                _kind == SynthesisKind.Boundaries;
            _synthesizer.Options.IncludeSentenceBoundaryMetadata =
                _kind == SynthesisKind.Boundaries;

            _synthesisStream?.Dispose();
            _synthesisStream = _kind == SynthesisKind.Ssml
                ? await _synthesizer.SynthesizeSsmlToStreamAsync(InputTextBox.Text)
                : await _synthesizer.SynthesizeTextToStreamAsync(InputTextBox.Text);

            MediaSource mediaSource = MediaSource.CreateFromStream(
                _synthesisStream,
                _synthesisStream.ContentType);
            var playbackItem = new MediaPlaybackItem(mediaSource);
            RegisterMetadataTracks(playbackItem);

            _mediaPlayer.Source = playbackItem;
            _mediaPlayer.Play();
            _isPlaying = true;
            SpeakButton.Content = "Stop";
            MainPage.Current.NotifyUser(
                $"Synthesizing with {_synthesizer.Voice.DisplayName}.",
                NotifyType.StatusMessage);
        }
        catch (FileNotFoundException exception)
        {
            MainPage.Current.NotifyOperationError(
                "Start speech playback; Windows media components may be unavailable",
                exception);
        }
        catch (Exception exception)
        {
            MainPage.Current.NotifyOperationError("Synthesize speech", exception);
        }
        finally
        {
            SpeakButton.IsEnabled = true;
            VoiceComboBox.IsEnabled = !_isPlaying;
        }
    }

    private void RegisterMetadataTracks(MediaPlaybackItem playbackItem)
    {
        for (int index = 0; index < playbackItem.TimedMetadataTracks.Count; index++)
        {
            RegisterMetadataTrack(playbackItem, index);
        }

        playbackItem.TimedMetadataTracksChanged +=
            (MediaPlaybackItem sender, IVectorChangedEventArgs args) =>
            {
                if (args.CollectionChange == CollectionChange.ItemInserted)
                {
                    RegisterMetadataTrack(sender, (int)args.Index);
                }
                else if (args.CollectionChange == CollectionChange.Reset)
                {
                    for (int index = 0; index < sender.TimedMetadataTracks.Count; index++)
                    {
                        RegisterMetadataTrack(sender, index);
                    }
                }
            };
    }

    private void RegisterMetadataTrack(MediaPlaybackItem playbackItem, int index)
    {
        TimedMetadataTrack track = playbackItem.TimedMetadataTracks[index];
        bool useTrack = track.Id switch
        {
            "SpeechWord" => _kind == SynthesisKind.Boundaries && _includeWordBoundaries,
            "SpeechSentence" => _kind == SynthesisKind.Boundaries && _includeSentenceBoundaries,
            "SpeechBookmark" => _kind == SynthesisKind.Ssml,
            _ => false,
        };

        if (!useTrack)
        {
            return;
        }

        track.CueEntered += MetadataTrack_CueEntered;
        playbackItem.TimedMetadataTracks.SetPresentationMode(
            (uint)index,
            TimedMetadataTrackPresentationMode.ApplicationPresented);
    }

    private void MetadataTrack_CueEntered(
        TimedMetadataTrack sender,
        MediaCueEventArgs args)
    {
        if (args.Cue is not SpeechCue cue)
        {
            return;
        }

        DispatcherQueue.TryEnqueue(() =>
        {
            if (!_isActive)
            {
                return;
            }

            switch (sender.Id)
            {
                case "SpeechWord":
                    LastWordTextBox.Text = cue.Text;
                    HighlightCue(cue);
                    break;

                case "SpeechSentence":
                    LastSentenceTextBox.Text = cue.Text;
                    HighlightCue(cue);
                    break;

                case "SpeechBookmark":
                    LastMarkTextBox.Text = cue.Text;
                    break;
            }
        });
    }

    private void HighlightCue(SpeechCue cue)
    {
        if (cue.StartPositionInInput is not int start ||
            cue.EndPositionInInput is not int end ||
            start < 0 ||
            end < start ||
            start >= InputTextBox.Text.Length)
        {
            return;
        }

        int length = Math.Min(
            end - start + 1,
            InputTextBox.Text.Length - start);
        InputTextBox.Select(start, length);
    }

    private void MediaPlayer_MediaEnded(MediaPlayer sender, object args)
    {
        DispatcherQueue.TryEnqueue(StopPlayback);
    }

    private void MediaPlayer_MediaFailed(
        MediaPlayer sender,
        MediaPlayerFailedEventArgs args)
    {
        DispatcherQueue.TryEnqueue(() =>
        {
            StopPlayback();
            MainPage.Current.NotifyUser(
                $"Speech playback failed: {args.ErrorMessage}",
                NotifyType.ErrorMessage);
        });
    }

    private void StopPlayback()
    {
        _mediaPlayer.Pause();
        _mediaPlayer.Source = null;
        _synthesisStream?.Dispose();
        _synthesisStream = null;
        _isPlaying = false;

        if (_isActive)
        {
            SpeakButton.Content = "Speak";
            VoiceComboBox.IsEnabled = true;
        }
    }
}
