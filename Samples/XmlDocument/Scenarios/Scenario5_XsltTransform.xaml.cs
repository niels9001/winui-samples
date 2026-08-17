using System;
using System.Globalization;
using System.IO;
using System.Runtime.InteropServices;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Windows.Data.Xml.Dom;
using Windows.Data.Xml.Xsl;
using Windows.Storage;

namespace SDKTemplate;

public sealed partial class Scenario5_XsltTransform : Page
{
    private const string FolderName = "XsltTransform";
    private const string XmlFileName = "xmlContent.xml";
    private const string XslFileName = "xslContent.xml";
    private bool _isInitialized;

    public Scenario5_XsltTransform()
    {
        InitializeComponent();
    }

    private async void Page_Loaded(object sender, RoutedEventArgs e)
    {
        if (_isInitialized)
        {
            return;
        }

        _isInitialized = true;

        try
        {
            XmlDocument source =
                await XmlSampleUtilities.LoadPackagedXmlAsync(
                    FolderName,
                    XmlFileName);
            XmlDocument stylesheet =
                await XmlSampleUtilities.LoadPackagedXmlAsync(
                    FolderName,
                    XslFileName);

            XmlSampleUtilities.SetText(SourceXmlBox, source.GetXml(), false);
            XmlSampleUtilities.SetText(StylesheetBox, stylesheet.GetXml(), false);
            XmlSampleUtilities.SetText(ResultBox, string.Empty, true);
        }
        catch (FileNotFoundException exception)
        {
            ShowPackagedFileError(exception);
        }
        catch (COMException exception) when (XmlSampleUtilities.IsMissingFile(exception))
        {
            ShowPackagedFileError(exception);
        }
        catch (COMException exception)
        {
            XmlSampleUtilities.ShowError(
                ResultBox,
                XmlSampleUtilities.FormatXmlError(
                    AppResources.GetString("OperationLoadXsltInputs"),
                    exception));
        }
    }

    private void TransformToStringButton_Click(object sender, RoutedEventArgs e)
    {
        (XmlDocument Source, XmlDocument Stylesheet)? documents = ParseInputs();
        if (documents is null)
        {
            return;
        }

        try
        {
            var processor = new XsltProcessor(documents.Value.Stylesheet);
            string result = processor.TransformToString(documents.Value.Source);
            XmlSampleUtilities.SetText(ResultBox, result, true);
            XmlSampleUtilities.ShowStatus(AppResources.GetString("XsltStringStatus"));
        }
        catch (COMException exception)
        {
            ShowTransformationError(exception);
        }
        catch (ArgumentException exception)
        {
            ShowTransformationError(exception);
        }
    }

    private async void TransformToDocumentButton_Click(
        object sender,
        RoutedEventArgs e)
    {
        (XmlDocument Source, XmlDocument Stylesheet)? documents = ParseInputs();
        if (documents is null)
        {
            return;
        }

        XmlDocument transformedDocument;
        try
        {
            var processor = new XsltProcessor(documents.Value.Stylesheet);
            transformedDocument =
                processor.TransformToDocument(documents.Value.Source);
        }
        catch (COMException exception)
        {
            ShowTransformationError(exception);
            return;
        }
        catch (ArgumentException exception)
        {
            ShowTransformationError(exception);
            return;
        }

        try
        {
            StorageFile file =
                await ApplicationData.Current.LocalFolder.CreateFileAsync(
                    "transformed.xml",
                    CreationCollisionOption.ReplaceExisting);
            await transformedDocument.SaveToFileAsync(file);

            string message = string.Format(
                CultureInfo.CurrentCulture,
                AppResources.GetString("XsltDocumentSavedStatus"),
                file.Path);
            XmlSampleUtilities.SetText(ResultBox, message, true);
            XmlSampleUtilities.ShowStatus(message);
        }
        catch (UnauthorizedAccessException exception)
        {
            ShowSaveError(exception);
        }
        catch (IOException exception)
        {
            ShowSaveError(exception);
        }
        catch (COMException exception)
        {
            ShowSaveError(exception);
        }
    }

    private (XmlDocument Source, XmlDocument Stylesheet)? ParseInputs()
    {
        string sourceXml = XmlSampleUtilities.GetText(SourceXmlBox);
        if (string.IsNullOrWhiteSpace(sourceXml))
        {
            XmlSampleUtilities.ShowError(
                ResultBox,
                AppResources.GetString("SourceXmlRequired"));
            return null;
        }

        string stylesheetXml = XmlSampleUtilities.GetText(StylesheetBox);
        if (string.IsNullOrWhiteSpace(stylesheetXml))
        {
            XmlSampleUtilities.ShowError(
                ResultBox,
                AppResources.GetString("StylesheetRequired"));
            return null;
        }

        XmlDocument source;
        try
        {
            source = new XmlDocument();
            source.LoadXml(sourceXml);
        }
        catch (COMException exception)
        {
            string message = string.Format(
                CultureInfo.CurrentCulture,
                AppResources.GetString("MalformedSourceXml"),
                exception.Message);
            XmlSampleUtilities.ShowError(ResultBox, message);
            return null;
        }

        XmlDocument stylesheet;
        try
        {
            stylesheet = new XmlDocument();
            stylesheet.LoadXml(stylesheetXml);
        }
        catch (COMException exception)
        {
            string message = string.Format(
                CultureInfo.CurrentCulture,
                AppResources.GetString("MalformedStylesheetXml"),
                exception.Message);
            XmlSampleUtilities.ShowError(ResultBox, message);
            return null;
        }

        return (source, stylesheet);
    }

    private void ShowPackagedFileError(Exception exception)
    {
        XmlSampleUtilities.ShowError(
            ResultBox,
            XmlSampleUtilities.FormatFileError(
                $"{XmlFileName} / {XslFileName}",
                exception));
    }

    private void ShowTransformationError(Exception exception)
    {
        string message = string.Format(
            CultureInfo.CurrentCulture,
            AppResources.GetString("XsltTransformationError"),
            exception.Message);
        XmlSampleUtilities.ShowError(ResultBox, message);
    }

    private void ShowSaveError(Exception exception)
    {
        string message = string.Format(
            CultureInfo.CurrentCulture,
            AppResources.GetString("SaveXmlError"),
            exception.Message);
        XmlSampleUtilities.ShowError(ResultBox, message);
    }
}
