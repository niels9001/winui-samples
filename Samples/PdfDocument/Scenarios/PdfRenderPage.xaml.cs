using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Media.Imaging;
using Microsoft.UI.Xaml.Navigation;
using Windows.Data.Pdf;
using Windows.Foundation;
using Windows.Storage;
using Windows.Storage.Pickers;
using Windows.Storage.Streams;

namespace SDKTemplate.Scenarios;

public sealed partial class PdfRenderPage : Page
{
    private const int WrongPasswordHResult = unchecked((int)0x8007052B);
    private const int InvalidPdfHResult = unchecked((int)0x80004005);

    private PdfDocument? _document;
    private StorageFile? _documentFile;
    private bool _isActive;
    private bool _isBusy;

    public PdfRenderPage()
    {
        InitializeComponent();
    }

    protected override void OnNavigatedTo(NavigationEventArgs e)
    {
        _isActive = true;
    }

    protected override void OnNavigatedFrom(NavigationEventArgs e)
    {
        _isActive = false;
        RenderedPageImage.Source = null;
        _document = null;
        _documentFile = null;
    }

    private async void LoadDocumentButton_Click(object sender, RoutedEventArgs e)
    {
        if (_isBusy)
        {
            return;
        }

        SetBusy(true);

        try
        {
            StorageFile? file;

            try
            {
                var picker = new FileOpenPicker
                {
                    SuggestedStartLocation = PickerLocationId.DocumentsLibrary,
                    ViewMode = PickerViewMode.List,
                };
                picker.FileTypeFilter.Add(".pdf");

                nint windowHandle = WinRT.Interop.WindowNative.GetWindowHandle(App.MainWindow);
                WinRT.Interop.InitializeWithWindow.Initialize(picker, windowHandle);

                file = await picker.PickSingleFileAsync();
            }
            catch (Exception exception)
            {
                MainPage.Current.NotifyOperationError(
                    Strings.Get("SelectingDocumentOperation"),
                    exception);
                return;
            }

            if (file is null)
            {
                return;
            }

            await LoadDocumentAsync(file);
        }
        finally
        {
            if (_isActive)
            {
                SetBusy(false);
            }
        }
    }

    private async void RenderPageButton_Click(object sender, RoutedEventArgs e)
    {
        if (_isBusy || _document is null)
        {
            return;
        }

        SetBusy(true);

        try
        {
            await RenderSelectedPageAsync(notifyOnSuccess: true);
        }
        catch (Exception exception)
        {
            MainPage.Current.NotifyOperationError(
                Strings.Get("RenderingPageOperation"),
                exception);
        }
        finally
        {
            if (_isActive)
            {
                SetBusy(false);
            }
        }
    }

    private async Task LoadDocumentAsync(StorageFile file)
    {
        string password = PasswordInput.Password;
        PasswordInput.Password = string.Empty;

        PdfDocument loadedDocument;

        try
        {
            loadedDocument = string.IsNullOrEmpty(password)
                ? await PdfDocument.LoadFromFileAsync(file)
                : await PdfDocument.LoadFromFileAsync(file, password);
        }
        catch (Exception exception) when (exception.HResult == WrongPasswordHResult)
        {
            MainPage.Current.NotifyUser(
                Strings.Get("WrongPasswordError"),
                NotifyType.ErrorMessage);
            return;
        }
        catch (Exception exception) when (exception.HResult == InvalidPdfHResult)
        {
            MainPage.Current.NotifyUser(
                Strings.Get("InvalidPdfError"),
                NotifyType.ErrorMessage);
            return;
        }
        catch (Exception exception)
        {
            MainPage.Current.NotifyOperationError(
                Strings.Get("LoadingDocumentOperation"),
                exception);
            return;
        }

        if (!_isActive)
        {
            return;
        }

        _document = loadedDocument;
        _documentFile = file;
        SelectedDocumentText.Text = Strings.Format("SelectedDocumentFormat", file.Name);
        PageCountText.Text = Strings.Format("PageCountFormat", loadedDocument.PageCount);

        if (loadedDocument.PageCount == 0)
        {
            RenderingPanel.Visibility = Visibility.Collapsed;
            RenderedPageImage.Source = null;
            RenderedPageScrollViewer.Visibility = Visibility.Collapsed;
            EmptyStateText.Visibility = Visibility.Visible;
            RenderDescriptionText.Text = Strings.Get("NoPageRendered");
            MainPage.Current.NotifyUser(
                Strings.Get("DocumentHasNoPagesError"),
                NotifyType.ErrorMessage);
            return;
        }

        PageNumberInput.Maximum = loadedDocument.PageCount;
        PageNumberInput.Value = 1;
        RenderingPanel.Visibility = Visibility.Visible;

        try
        {
            bool rendered = await RenderSelectedPageAsync(notifyOnSuccess: false);

            if (rendered && _isActive)
            {
                string protection = loadedDocument.IsPasswordProtected
                    ? Strings.Get("PasswordProtectedDocument")
                    : Strings.Get("UnprotectedDocument");

                MainPage.Current.NotifyUser(
                    Strings.Format(
                        "DocumentLoadedFormat",
                        file.Name,
                        loadedDocument.PageCount,
                        protection),
                    NotifyType.StatusMessage);
            }
        }
        catch (Exception exception)
        {
            MainPage.Current.NotifyOperationError(
                Strings.Get("RenderingPageOperation"),
                exception);
        }
    }

    private async Task<bool> RenderSelectedPageAsync(bool notifyOnSuccess)
    {
        PdfDocument? document = _document;
        StorageFile? documentFile = _documentFile;

        if (document is null || documentFile is null)
        {
            return false;
        }

        double requestedPage = PageNumberInput.Value;

        if (double.IsNaN(requestedPage) ||
            requestedPage != Math.Truncate(requestedPage) ||
            requestedPage < 1 ||
            requestedPage > document.PageCount)
        {
            MainPage.Current.NotifyUser(
                Strings.Format("InvalidPageNumberError", document.PageCount),
                NotifyType.ErrorMessage);
            PageNumberInput.Focus(FocusState.Programmatic);
            return false;
        }

        uint pageNumber = (uint)requestedPage;
        uint pageIndex = pageNumber - 1;

        using PdfPage page = document.GetPage(pageIndex);
        using var stream = new InMemoryRandomAccessStream();

        string renderDescription;

        switch (RenderOptionsComboBox.SelectedIndex)
        {
            case 1:
                var halfSizeOptions = new PdfPageRenderOptions
                {
                    BackgroundColor = Microsoft.UI.Colors.Beige,
                    DestinationWidth = HalfDimension(page.Size.Width),
                    DestinationHeight = HalfDimension(page.Size.Height),
                };
                await page.RenderToStreamAsync(stream, halfSizeOptions);
                renderDescription = Strings.Format("HalfSizeRenderDescriptionFormat", pageNumber);
                break;

            case 2:
                Rect trimBox = page.Dimensions.TrimBox;
                double cropWidth = trimBox.Width / 2;
                double cropHeight = trimBox.Height / 2;
                var cropOptions = new PdfPageRenderOptions
                {
                    SourceRect = new Rect(
                        trimBox.X + cropWidth / 2,
                        trimBox.Y + cropHeight / 2,
                        cropWidth,
                        cropHeight),
                };
                await page.RenderToStreamAsync(stream, cropOptions);
                renderDescription = Strings.Format("CenterCropRenderDescriptionFormat", pageNumber);
                break;

            default:
                await page.RenderToStreamAsync(stream);
                renderDescription = Strings.Format("ActualSizeRenderDescriptionFormat", pageNumber);
                break;
        }

        stream.Seek(0);
        var bitmap = new BitmapImage();
        await bitmap.SetSourceAsync(stream);

        if (!_isActive ||
            !ReferenceEquals(document, _document) ||
            !ReferenceEquals(documentFile, _documentFile))
        {
            return false;
        }

        RenderedPageImage.Source = bitmap;
        RenderDescriptionText.Text = renderDescription;
        EmptyStateText.Visibility = Visibility.Collapsed;
        RenderedPageScrollViewer.Visibility = Visibility.Visible;

        if (notifyOnSuccess)
        {
            MainPage.Current.NotifyUser(
                Strings.Format("PageRenderedFormat", pageNumber, documentFile.Name),
                NotifyType.StatusMessage);
        }

        return true;
    }

    private void SetBusy(bool isBusy)
    {
        _isBusy = isBusy;
        LoadDocumentButton.IsEnabled = !isBusy;
        PasswordInput.IsEnabled = !isBusy;
        RenderPageButton.IsEnabled = !isBusy && _document is not null;
        PageNumberInput.IsEnabled = !isBusy;
        RenderOptionsComboBox.IsEnabled = !isBusy;
        BusyProgressRing.IsActive = isBusy;
        BusyProgressRing.Visibility = isBusy ? Visibility.Visible : Visibility.Collapsed;
    }

    private static uint HalfDimension(double dimension)
    {
        double halfDimension = Math.Ceiling(dimension / 2);

        if (halfDimension >= uint.MaxValue)
        {
            return uint.MaxValue;
        }

        return (uint)Math.Max(1, halfDimension);
    }
}
