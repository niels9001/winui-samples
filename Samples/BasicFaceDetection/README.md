# Basic Face Detection

This WinUI 3 sample uses `FaceDetector` to locate human faces in a still image or in one
frame captured from a webcam.

## What the sample shows

- Selecting and decoding a JPEG, PNG, or BMP image.
- Converting a `SoftwareBitmap` to a format supported by `FaceDetector`.
- Capturing one webcam preview frame and detecting faces in it.
- Scaling face bounding boxes as the display surface resizes.

## APIs featured

- `Windows.Media.FaceAnalysis.FaceDetector`
- `Windows.Media.FaceAnalysis.DetectedFace`
- `Windows.Graphics.Imaging.BitmapDecoder`
- `Windows.Graphics.Imaging.SoftwareBitmap`
- `Windows.Media.Capture.MediaCapture`
- `Windows.Media.Capture.Frames.MediaFrameReader`
- `Windows.Media.Playback.MediaPlayer`

## Related documentation

- [FaceDetector class](https://learn.microsoft.com/uwp/api/windows.media.faceanalysis.facedetector)
- [Windows.Media.FaceAnalysis namespace](https://learn.microsoft.com/uwp/api/windows.media.faceanalysis)
- [Detect faces in images or videos](https://learn.microsoft.com/windows/apps/develop/media-authoring-processing/detect-and-track-faces-in-an-image)

## Build and run

From this directory:

```powershell
dotnet build -c Debug -p:Platform=x64
dotnet run -c Debug -p:Platform=x64
```

The webcam scenario requires camera access. The packaged app declares the `webcam` device
capability.

## Migration notes

- The file picker is associated with the desktop window through
  `InitializeWithWindow.Initialize`.
- The UWP `CaptureElement` was replaced by a `MediaPlayerElement` backed by a
  `MediaFrameSource`.
- Webcam snapshots are acquired from the same source through a BGRA8 `MediaFrameReader`.
- UWP dispatcher calls were replaced with `DispatcherQueue`.
- Face-overlay positioning is shared by both scenarios.

## Known differences / limitations

- The webcam scenario detects faces in a single captured frame. It does not continuously
  track faces; the existing Camera sample demonstrates live face detection.
- WinUI 3 desktop does not expose the CoreWindow-based display-orientation path used by
  older camera samples. The preview keeps neutral rotation and mirrors a front-facing
  camera.
- Webcam frame capture depends on the camera driver exposing a compatible preview stream.
