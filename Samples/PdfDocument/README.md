# PdfDocument

Ported to WinUI 3 / Windows App SDK from the UWP
[PdfDocument](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/PdfDocument)
sample.

## What it shows

This sample opens normal or password-protected PDF files and renders a selected page
to a WinUI `Image`. It demonstrates full-size rendering, half-size rendering with a
custom background, and center-cropped rendering.

## Scenario

**Load and render a PDF page** - Pick a PDF, optionally enter its password, select a
page and rendering mode, and display the resulting bitmap. The workflow distinguishes
an incorrect password from an invalid PDF and prevents overlapping load or render
operations.

## APIs featured

- `Windows.Data.Pdf.PdfDocument`
- `Windows.Data.Pdf.PdfPage`
- `Windows.Data.Pdf.PdfPageRenderOptions`
- `Windows.Storage.Pickers.FileOpenPicker`
- `Windows.Storage.Streams.InMemoryRandomAccessStream`
- `Microsoft.UI.Xaml.Media.Imaging.BitmapImage`

## Requirements

- A local PDF file is required for the interactive workflow.
- A password is required only when the selected document is protected.
- Large pages rendered at their native dimensions can require scrolling.

## Learn docs this serves

- [PdfDocument API reference](https://learn.microsoft.com/uwp/api/windows.data.pdf.pdfdocument)
- [PdfPage API reference](https://learn.microsoft.com/uwp/api/windows.data.pdf.pdfpage)
- [PdfPageRenderOptions API reference](https://learn.microsoft.com/uwp/api/windows.data.pdf.pdfpagerenderoptions)
- [FileOpenPicker API reference](https://learn.microsoft.com/uwp/api/windows.storage.pickers.fileopenpicker)
- [BitmapImage API reference](https://learn.microsoft.com/windows/windows-app-sdk/api/winrt/microsoft.ui.xaml.media.imaging.bitmapimage)

## Build & run

```powershell
dotnet build -c Debug -p:Platform=x64
dotnet run -c Debug -p:Platform=x64
```

## Migration notes

The `FileOpenPicker` is initialized with the WinUI window handle. After a PDF page is
rendered, the in-memory stream is rewound before it is passed to
`BitmapImage.SetSource`.

## Known differences / limitations

- The sample is an interactive direct page; it does not implement file-association
  activation.
- Rendering uses the selected page's requested dimensions and does not add
  virtualization for very large output.
- Successful rendering requires a valid PDF and the correct password when one is
  configured.
