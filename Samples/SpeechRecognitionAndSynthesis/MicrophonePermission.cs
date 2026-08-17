using System;
using System.Runtime.InteropServices;
using System.Threading.Tasks;
using Windows.Media.Capture;

namespace SDKTemplate;

internal readonly record struct MicrophoneAccessResult(bool Granted, string Message);

internal static class MicrophonePermission
{
    private const int NoCaptureDevicesHResult = unchecked((int)0xC00D36D0);

    internal static async Task<MicrophoneAccessResult> RequestAsync()
    {
        var settings = new MediaCaptureInitializationSettings
        {
            StreamingCaptureMode = StreamingCaptureMode.Audio,
            MediaCategory = MediaCategory.Speech,
        };

        using var capture = new MediaCapture();

        try
        {
            await capture.InitializeAsync(settings);
            return new MicrophoneAccessResult(true, string.Empty);
        }
        catch (UnauthorizedAccessException)
        {
            return new MicrophoneAccessResult(
                false,
                "Microphone access is disabled. Enable it in Settings > Privacy & security > Microphone.");
        }
        catch (TypeLoadException)
        {
            return new MicrophoneAccessResult(
                false,
                "Windows media components are unavailable. Install the Media Feature Pack and try again.");
        }
        catch (COMException exception) when (exception.HResult == NoCaptureDevicesHResult)
        {
            return new MicrophoneAccessResult(
                false,
                "No audio capture device is available.");
        }
    }
}
