# Camera

Ported to WinUI 3 / Windows App SDK from nine UWP camera samples:
[CameraStarterKit](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/CameraStarterKit),
[CameraManualControls](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/CameraManualControls),
[CameraResolution](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/CameraResolution),
[CameraProfile](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/CameraProfile),
[CameraAdvancedCapture](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/CameraAdvancedCapture),
[CameraGetPreviewFrame](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/CameraGetPreviewFrame),
[CameraFaceDetection](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/CameraFaceDetection),
[CameraFrames](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/CameraFrames), and
[CameraVideoStabilization](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/CameraVideoStabilization).

## What it shows

Fourteen scenarios grouped by camera feature:

- **Starter kit** - camera preview, photo, and video capture.
- **Manual controls** - exposure, flash, focus, ISO, shutter, white balance, and zoom.
- **Resolution** - preview settings, photo settings, and aspect-ratio matching.
- **Profiles** - recording profiles, concurrent capture support, and HDR support.
- **Advanced capture** - HDR and low-light photo capture.
- **Get preview frame** - one preview frame as a `SoftwareBitmap`.
- **Face detection** - live face detection over camera preview.
- **Frames** - color, depth, and infrared frame readers plus source-group enumeration.
- **Video stabilization** - the built-in video stabilization effect.

## APIs featured

- `Windows.Media.Capture.MediaCapture`, `AdvancedPhotoCapture`, and `MediaCaptureVideoProfile`
- `Windows.Media.Capture.Frames.MediaFrameReader` and `MediaFrameSourceGroup`
- `Windows.Media.Devices.VideoDeviceController`
- `Windows.Media.Core.FaceDetectionEffect` and `VideoStabilizationEffect`
- `Windows.Graphics.Imaging.SoftwareBitmap`
- `Microsoft.UI.Xaml.Controls.MediaPlayerElement` with `MediaSource.CreateFromMediaFrameSource`

## Learn docs this serves

- [Camera overview](https://learn.microsoft.com/windows/uwp/audio-video-camera/camera)
- [Basic photo, video, and audio capture with MediaCapture](https://learn.microsoft.com/windows/uwp/audio-video-camera/basic-photo-video-and-audio-capture-with-mediacapture)
- [Simple camera preview access](https://learn.microsoft.com/windows/uwp/audio-video-camera/simple-camera-preview-access)
- [Process media frames with MediaFrameReader](https://learn.microsoft.com/windows/uwp/audio-video-camera/process-media-frames-with-mediaframereader)
- [Camera profiles](https://learn.microsoft.com/windows/uwp/audio-video-camera/camera-profiles)
- [Get a preview frame](https://learn.microsoft.com/windows/uwp/audio-video-camera/get-a-preview-frame)

## Hardware and initial state

A webcam or built-in camera is required. Video scenarios that record audio also require a microphone, and the color/depth/infrared scenario needs matching frame sources for each view it displays.

Before `MediaCapture` succeeds, the Starter kit shows **Camera preview is not available.**, keeps live preview hidden, and disables the Photo and Video actions. Windows may request camera or microphone consent when a scenario initializes. Successful preview and capture states therefore require manual setup and capture.

## Build & run

```powershell
dotnet build -c Debug -p:Platform=x64
dotnet run -c Debug -p:Platform=x64
```

## Migration notes

- UWP `CaptureElement` is unavailable in WinUI 3, so preview uses `MediaPlayerElement` with `MediaSource.CreateFromMediaFrameSource`.
- UWP XAML namespaces were replaced with WinUI namespaces, `CoreDispatcher` with `DispatcherQueue`, and `Window.Current` with `App.MainWindow`.
- The nine original samples now share one NavigationView and InfoBar shell plus common rotation, buffer, and preview helpers.
- The shared shell uses Mica, a title-bar app icon, and no page backgrounds.

## Known differences / limitations

- Camera features depend on the connected device and driver; manual controls, profiles, depth/infrared streams, HDR, and effects may be unavailable.
- `CameraHdr`, `CameraOpenCV`, `CameraStreamCoordinateMapper`, and `CameraStreamCorrelation` were not consolidated because their source or native dependencies cannot be reproduced by this managed port.
- The manifest declares `systemAIModels`, but no Camera source file references a system AI model API; the declaration appears unused and needs maintainer review.
