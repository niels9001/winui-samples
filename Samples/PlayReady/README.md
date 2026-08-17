# PlayReady

Ported to WinUI 3 / Windows App SDK from the UWP
[PlayReady](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/PlayReady)
sample.

## What it shows

This sample integrates PlayReady-protected playback with reactive and proactive
license acquisition, hardware/software DRM selection, and Secure Stop reporting. Its
MVVM implementation separates the protected-media UI from each service-request
workflow.

## Scenarios

1. **Reactive License Request** - Start playback and handle individualization or
   license acquisition when `MediaProtectionManager` raises a service request.
2. **Proactive License Request** - Build a content header and acquire a license before
   playback starts.
3. **Manage HW/SW DRM** - Inspect hardware DRM support and persist a hardware or
   software protection preference.
4. **Secure Stop** - Collect secure-stop data from a license session and submit it to
   the sample service.

## APIs featured

- `Windows.Media.Protection.MediaProtectionManager`
- `Windows.Media.Protection.PlayReady.PlayReadyLicenseAcquisitionServiceRequest`
- `Windows.Media.Protection.PlayReady.PlayReadyIndividualizationServiceRequest`
- `Windows.Media.Protection.PlayReady.PlayReadyContentHeader`
- `Windows.Media.Protection.PlayReady.PlayReadyLicenseSession`
- `Windows.Media.Protection.PlayReady.PlayReadyStatics`
- `Windows.Media.Protection.PlayReady.PlayReadySecureStopServiceRequest`

## Requirements

- The system media stack must support PlayReady. The hardware DRM path additionally
  depends on the current device's PlayReady hardware features.
- Protected playback and license workflows require network access.
- The sample is hard-coded to legacy external HTTP test infrastructure:
  - Protected DASH media:
    `http://profficialsite.origin.mediaservices.windows.net/c51358ea-9a5e-4322-8951-897d640fdfd7/tearsofsteel_4k.ism/manifest(format=mpd-time-csf)`
  - License and Secure Stop service:
    `http://playready.directtaps.net/pr/svc/rightsmanager.asmx`
- These endpoints are not repository-owned production services, and their current
  availability is not guaranteed.

## Learn docs this serves

- [PlayReady documentation](https://learn.microsoft.com/playready/overview/overview)
- [MediaProtectionManager API reference](https://learn.microsoft.com/uwp/api/windows.media.protection.mediaprotectionmanager)
- [PlayReadyStatics API reference](https://learn.microsoft.com/uwp/api/windows.media.protection.playready.playreadystatics)

## Build & run

```powershell
dotnet build -c Debug -p:Platform=x64
dotnet run -c Debug -p:Platform=x64
```

## Migration notes

The UWP `MediaElement` was replaced with WinUI's `MediaPlayerElement`. Its
`MediaProtectionManager` is assigned through the underlying media player rather than
the UWP control path. The PlayReady request objects and license-session APIs remain
Windows Runtime APIs.

## Known differences / limitations

- The sample's media and license endpoints use HTTP and may be retired, blocked, or
  otherwise unavailable.
- Hardware DRM, HEVC feature support, license acquisition, and Secure Stop depend on
  the current OS, device, content, and service state. No successful hardware or live
  service validation is claimed here.
- The publisher identifier and service query parameters are specific to the sample
  test service and must not be treated as production configuration.
