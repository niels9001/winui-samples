# OCR

Ported to WinUI 3 / Windows App SDK from the UWP
[OCR](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/OCR)
sample.

## What it shows

This sample recognizes text in an image file or a frame captured from a webcam. It
also draws bounding overlays for the words returned by `OcrEngine`.

## Scenarios

1. **Extract text from an image file** - Pick an image, choose an installed OCR
   language, recognize the text, and display recognition overlays.
2. **Extract text from a camera capture** - Preview a color camera source, capture
   a frame, and recognize English text from that frame.

## APIs featured

- `Windows.Media.Ocr.OcrEngine`
- `Windows.Graphics.Imaging.SoftwareBitmap`
- `Windows.Storage.Pickers.FileOpenPicker`
- `Windows.Media.Capture.MediaCapture`
- `Windows.Media.Capture.Frames.MediaFrameSource`
- `Microsoft.UI.Xaml.Controls.MediaPlayerElement`

## Requirements

- The file workflow requires an installed Windows OCR language pack that can
  recognize the selected language.
- The camera workflow requires a connected webcam, webcam access, and English OCR
  support.
- Camera initialization leaves `MediaCapture` in its default audio-and-video mode,
  while the package declares `webcam` but not `microphone`. The camera workflow can
  therefore fail on systems that require microphone access for that initialization.
- Camera initialization and OCR language availability are runtime-dependent. The
  sample reports unavailable devices or recognizers rather than implying that all
  systems provide them.

## Learn docs this serves

- [OcrEngine API reference](https://learn.microsoft.com/uwp/api/windows.media.ocr.ocrengine)
- [MediaCapture API reference](https://learn.microsoft.com/uwp/api/windows.media.capture.mediacapture)
- [Map UWP features to the Windows App SDK](https://learn.microsoft.com/windows/apps/windows-app-sdk/migrate-to-windows-app-sdk/feature-mapping-table)

## Build & run

```powershell
dotnet build -c Debug -p:Platform=x64
dotnet run -c Debug -p:Platform=x64
```

## Migration notes

The image picker is associated with the WinUI window through HWND interop. The UWP
camera preview was replaced with a `MediaPlayerElement` backed by a color
`MediaFrameSource`. The port no longer uses `DisplayInformation` to adjust for
display orientation; its stream rotation metadata is fixed to zero degrees.

## Known differences / limitations

- The UWP display-orientation behavior is not reproduced because its current-view
  `DisplayInformation` path is not available to this WinUI 3 desktop sample.
- Camera OCR has not been validated against every webcam or capture format.
- The port does not change the inherited audio-and-video initialization mode or add
  the missing microphone capability.
- Recognition quality and supported languages depend on the installed Windows OCR
  language packs and the source image.
