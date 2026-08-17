using System;
using System.Globalization;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Windows.Media.MediaProperties;
using Windows.Media.Transcoding;

namespace SDKTemplate;

public sealed partial class TranscodingPage
{
    private const ulong PixelsPerSecondRequiringH264Level52 = 250_000_000;

    private void ConfigureScenario()
    {
        ScenarioTitleTextBlock.Text = _scenario switch
        {
            TranscodingScenario.Preset => Strings.Get("ScenarioPresetTitle"),
            TranscodingScenario.Custom => Strings.Get("ScenarioCustomTitle"),
            TranscodingScenario.Trim => Strings.Get("ScenarioTrimTitle"),
            _ => throw new InvalidOperationException("Unknown transcoding scenario."),
        };
        ScenarioDescriptionTextBlock.Text = _scenario switch
        {
            TranscodingScenario.Preset => Strings.Get("ScenarioPresetDescription"),
            TranscodingScenario.Custom => Strings.Get("ScenarioCustomDescription"),
            TranscodingScenario.Trim => Strings.Get("ScenarioTrimDescription"),
            _ => throw new InvalidOperationException("Unknown transcoding scenario."),
        };

        bool usesPreset = _scenario != TranscodingScenario.Custom;
        PresetLabel.Visibility = usesPreset ? Visibility.Visible : Visibility.Collapsed;
        PresetComboBox.Visibility = usesPreset ? Visibility.Visible : Visibility.Collapsed;
        CustomSettingsPanel.Visibility =
            _scenario == TranscodingScenario.Custom
                ? Visibility.Visible
                : Visibility.Collapsed;
        TrimSettingsPanel.Visibility =
            _scenario == TranscodingScenario.Trim
                ? Visibility.Visible
                : Visibility.Collapsed;
        AviOutputOption.Visibility =
            _scenario == TranscodingScenario.Custom
                ? Visibility.Collapsed
                : Visibility.Visible;

        PresetComboBox.SelectedIndex = 2;
        TargetFormatComboBox.SelectedIndex = 0;
        InitializeCustomSettings();
        UpdateFormatOptions();
    }

    private MediaEncodingProfile? CreateEncodingProfile()
    {
        return _scenario == TranscodingScenario.Custom
            ? CreateCustomProfile()
            : CreatePresetProfile();
    }

    private MediaEncodingProfile CreatePresetProfile()
    {
        VideoEncodingQuality quality = PresetComboBox.SelectedIndex switch
        {
            0 => VideoEncodingQuality.HD1080p,
            1 => VideoEncodingQuality.HD720p,
            3 => VideoEncodingQuality.Ntsc,
            4 => VideoEncodingQuality.Pal,
            5 => VideoEncodingQuality.Vga,
            6 => VideoEncodingQuality.Qvga,
            _ => VideoEncodingQuality.Wvga,
        };

        return GetSelectedOutputFormat() switch
        {
            OutputFormat.Wmv => MediaEncodingProfile.CreateWmv(quality),
            OutputFormat.Avi => MediaEncodingProfile.CreateAvi(quality),
            _ => MediaEncodingProfile.CreateMp4(quality),
        };
    }

    private MediaEncodingProfile? CreateCustomProfile()
    {
        if (!TryReadPositiveUInt(VideoWidthTextBox, out uint width) ||
            !TryReadPositiveUInt(VideoHeightTextBox, out uint height) ||
            !TryReadPositiveUInt(VideoBitrateTextBox, out uint videoBitrate) ||
            !TryReadPositiveUInt(VideoFrameRateTextBox, out uint frameRate) ||
            !TryReadPositiveUInt(AudioBitsPerSampleTextBox, out uint bitsPerSample) ||
            !TryReadPositiveUInt(AudioSampleRateTextBox, out uint sampleRate) ||
            !TryReadPositiveUInt(AudioBitrateTextBox, out uint audioBitrate) ||
            !TryReadPositiveUInt(AudioChannelCountTextBox, out uint channelCount))
        {
            _rootPage.NotifyUser(
                Strings.Get("InvalidCustomSettings"),
                NotifyType.ErrorMessage);
            return null;
        }

        bool useMp4 = GetSelectedOutputFormat() == OutputFormat.Mp4;
        MediaEncodingProfile profile = useMp4
            ? MediaEncodingProfile.CreateMp4(VideoEncodingQuality.Wvga)
            : MediaEncodingProfile.CreateWmv(VideoEncodingQuality.Wvga);

        profile.Video.Width = width;
        profile.Video.Height = height;
        profile.Video.Bitrate = videoBitrate;
        profile.Video.FrameRate.Numerator = frameRate;
        profile.Video.FrameRate.Denominator = 1;
        profile.Audio.BitsPerSample = bitsPerSample;
        profile.Audio.SampleRate = sampleRate;
        profile.Audio.Bitrate = audioBitrate;
        profile.Audio.ChannelCount = channelCount;

        ulong pixelsPerSecond = (ulong)width * height * frameRate;
        if (useMp4 && pixelsPerSecond > PixelsPerSecondRequiringH264Level52)
        {
            profile.Video.Properties[MediaFoundationConstants.VideoLevel] =
                MediaFoundationConstants.H264Level52;
        }

        return profile;
    }

    private MediaTranscoder? CreateTranscoder()
    {
        var transcoder = new MediaTranscoder
        {
            VideoProcessingAlgorithm = EnableMrfCheckBox.IsChecked == true
                ? MediaVideoProcessingAlgorithm.MrfCrf444
                : MediaVideoProcessingAlgorithm.Default,
        };

        if (_scenario != TranscodingScenario.Trim)
        {
            return transcoder;
        }

        if (_sourceDuration <= TimeSpan.Zero)
        {
            _rootPage.NotifyUser(
                Strings.Get("SourceDurationUnavailable"),
                NotifyType.ErrorMessage);
            return null;
        }

        if (_trimStart < TimeSpan.Zero ||
            _trimEnd <= _trimStart ||
            _trimEnd > _sourceDuration)
        {
            _rootPage.NotifyUser(
                Strings.Get("InvalidTrimRange"),
                NotifyType.ErrorMessage);
            return null;
        }

        transcoder.TrimStartTime = _trimStart;
        transcoder.TrimStopTime = _sourceDuration - _trimEnd;
        return transcoder;
    }

    private void InitializeCustomSettings()
    {
        MediaEncodingProfile profile =
            MediaEncodingProfile.CreateMp4(VideoEncodingQuality.Wvga);
        CultureInfo culture = CultureInfo.CurrentCulture;

        VideoWidthTextBox.Text = profile.Video.Width.ToString(culture);
        VideoHeightTextBox.Text = profile.Video.Height.ToString(culture);
        VideoBitrateTextBox.Text = profile.Video.Bitrate.ToString(culture);
        VideoFrameRateTextBox.Text =
            profile.Video.FrameRate.Numerator.ToString(culture);
        AudioBitsPerSampleTextBox.Text =
            profile.Audio.BitsPerSample.ToString(culture);
        AudioSampleRateTextBox.Text = profile.Audio.SampleRate.ToString(culture);
        AudioBitrateTextBox.Text = profile.Audio.Bitrate.ToString(culture);
        AudioChannelCountTextBox.Text =
            profile.Audio.ChannelCount.ToString(culture);
    }

    private void UpdateFormatOptions()
    {
        bool isAvi = GetSelectedOutputFormat() == OutputFormat.Avi;
        PresetNtscOption.IsEnabled = !isAvi;
        PresetPalOption.IsEnabled = !isAvi;

        if (isAvi && PresetComboBox.SelectedIndex is 3 or 4)
        {
            PresetComboBox.SelectedIndex = 2;
        }
    }

    private OutputFormat GetSelectedOutputFormat()
    {
        return TargetFormatComboBox.SelectedIndex switch
        {
            1 => OutputFormat.Wmv,
            2 when _scenario != TranscodingScenario.Custom => OutputFormat.Avi,
            _ => OutputFormat.Mp4,
        };
    }

    private static string GetFileExtension(OutputFormat format)
    {
        return format switch
        {
            OutputFormat.Wmv => ".wmv",
            OutputFormat.Avi => ".avi",
            _ => ".mp4",
        };
    }

    private static string GetFileTypeDescription(OutputFormat format)
    {
        return format switch
        {
            OutputFormat.Wmv => Strings.Get("WmvFileType"),
            OutputFormat.Avi => Strings.Get("AviFileType"),
            _ => Strings.Get("Mp4FileType"),
        };
    }

    private static bool TryReadPositiveUInt(TextBox textBox, out uint value)
    {
        return uint.TryParse(
            textBox.Text,
            NumberStyles.Integer,
            CultureInfo.CurrentCulture,
            out value) &&
            value > 0;
    }

    private enum OutputFormat
    {
        Mp4,
        Wmv,
        Avi,
    }
}
