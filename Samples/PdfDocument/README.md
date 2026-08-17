# PDF document

Demonstrates how to load and render PDF files in a packaged WinUI 3 desktop app.

## What the sample shows

- Selecting a PDF file with a window-owned `FileOpenPicker`.
- Loading both unprotected and password-protected documents.
- Selecting a page with a one-based page number.
- Rendering a complete page at its actual size.
- Rendering a page at half size with a custom background color.
- Rendering only the center region of a page.
- Displaying rendered output from an in-memory random-access stream.

## APIs featured

- [`Windows.Data.Pdf.PdfDocument`](https://learn.microsoft.com/uwp/api/windows.data.pdf.pdfdocument)
- [`Windows.Data.Pdf.PdfPage`](https://learn.microsoft.com/uwp/api/windows.data.pdf.pdfpage)
- [`Windows.Data.Pdf.PdfPageRenderOptions`](https://learn.microsoft.com/uwp/api/windows.data.pdf.pdfpagerenderoptions)
- [`Windows.Storage.Pickers.FileOpenPicker`](https://learn.microsoft.com/uwp/api/windows.storage.pickers.fileopenpicker)
- [`Microsoft.UI.Xaml.Media.Imaging.BitmapImage`](https://learn.microsoft.com/windows/windows-app-sdk/api/winrt/microsoft.ui.xaml.media.imaging.bitmapimage)

## Learn documentation

- [UWP to Windows App SDK migration overview](https://learn.microsoft.com/windows/apps/windows-app-sdk/migrate-to-windows-app-sdk/overview)
- [Display WinRT UI objects that depend on CoreWindow](https://learn.microsoft.com/windows/apps/develop/ui-input/display-ui-objects)

## Build and run

From the sample folder:

```powershell
dotnet build -c Debug -p:Platform=x64
dotnet run -c Debug -p:Platform=x64
```

## Migration notes

- The sample uses the WinUI 3 window lifecycle and stores the main window in
  `App.MainWindow`.
- `FileOpenPicker` is initialized with the main window's HWND before it is displayed.
- The rendered stream is rewound before it is assigned to a WinUI 3 `BitmapImage`.
- Pages and in-memory streams are disposed immediately after each render.

## Known differences / limitations

- The single scenario is hosted directly below the standard WinUI 3 title bar, with an
  `InfoBar` for status and error messages.
- PDF files are selected interactively rather than activated through a UWP file-association
  contract.
- Large pages render at their native pixel dimensions and may require scrolling.
