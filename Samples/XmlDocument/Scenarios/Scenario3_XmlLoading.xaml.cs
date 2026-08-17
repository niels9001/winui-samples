using System;
using System.IO;
using System.Runtime.InteropServices;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Windows.Data.Xml.Dom;
using Windows.Storage;
using Windows.Storage.Streams;

namespace SDKTemplate;

public sealed partial class Scenario3_XmlLoading : Page
{
    private const string FolderName = "LoadExternalDtd";
    private const string XmlFileName = "xmlWithExternaldtd.xml";
    private const string DtdFileName = "dtd.txt";
    private bool _isInitialized;

    public Scenario3_XmlLoading()
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

        var initialSettings = new XmlLoadSettings
        {
            ProhibitDtd = false,
            ResolveExternals = false,
        };

        try
        {
            XmlDocument document =
                await XmlSampleUtilities.LoadPackagedXmlAsync(
                    FolderName,
                    XmlFileName,
                    initialSettings);
            XmlSampleUtilities.SetText(OriginalXmlBox, document.GetXml(), true);
        }
        catch (FileNotFoundException exception)
        {
            ShowPackagedFileError(XmlFileName, exception);
        }
        catch (COMException exception) when (XmlSampleUtilities.IsMissingFile(exception))
        {
            ShowPackagedFileError(XmlFileName, exception);
        }
        catch (COMException exception)
        {
            ShowXmlLoadError(exception);
        }
    }

    private async void LoadFromFileButton_Click(object sender, RoutedEventArgs e)
    {
        XmlLoadSettings settings = CreateLoadSettings();

        try
        {
            XmlDocument document =
                await XmlSampleUtilities.LoadPackagedXmlAsync(
                    FolderName,
                    XmlFileName,
                    settings);
            ShowLoadedDocument(document);
        }
        catch (FileNotFoundException exception)
        {
            ShowPackagedFileError(XmlFileName, exception);
        }
        catch (COMException exception) when (XmlSampleUtilities.IsMissingFile(exception))
        {
            ShowPackagedFileError(XmlFileName, exception);
        }
        catch (COMException) when (settings.ProhibitDtd)
        {
            XmlSampleUtilities.ShowError(
                ResultBox,
                AppResources.GetString("DtdProhibitedError"));
        }
        catch (COMException exception)
        {
            ShowXmlLoadError(exception);
        }
    }

    private async void LoadFromBufferButton_Click(object sender, RoutedEventArgs e)
    {
        XmlLoadSettings settings = CreateLoadSettings();
        string xml = XmlSampleUtilities.GetText(OriginalXmlBox);

        try
        {
            if (settings.ResolveExternals && !settings.ProhibitDtd)
            {
                StorageFile dtdFile =
                    await XmlSampleUtilities.GetPackagedFileAsync(
                        FolderName,
                        DtdFileName);
                xml = xml.Replace("dtd.txt", dtdFile.Path, StringComparison.Ordinal);
            }

            using var writer = new DataWriter
            {
                UnicodeEncoding = UnicodeEncoding.Utf8,
            };
            writer.WriteString(xml);
            IBuffer buffer = writer.DetachBuffer();

            var document = new XmlDocument();
            document.LoadXmlFromBuffer(buffer, settings);
            ShowLoadedDocument(document);
        }
        catch (FileNotFoundException exception)
        {
            ShowPackagedFileError(DtdFileName, exception);
        }
        catch (COMException exception) when (XmlSampleUtilities.IsMissingFile(exception))
        {
            ShowPackagedFileError(DtdFileName, exception);
        }
        catch (COMException) when (settings.ProhibitDtd)
        {
            XmlSampleUtilities.ShowError(
                ResultBox,
                AppResources.GetString("DtdProhibitedError"));
        }
        catch (COMException exception)
        {
            ShowXmlLoadError(exception);
        }
    }

    private XmlLoadSettings CreateLoadSettings()
    {
        return new XmlLoadSettings
        {
            ProhibitDtd = ProhibitDtdRadioButton.IsChecked == true,
            ResolveExternals = ResolveExternalsRadioButton.IsChecked == true,
        };
    }

    private void ShowLoadedDocument(XmlDocument document)
    {
        XmlSampleUtilities.SetText(ResultBox, document.GetXml(), true);
        XmlSampleUtilities.ShowStatus(AppResources.GetString("XmlLoadedStatus"));
    }

    private void ShowPackagedFileError(string fileName, Exception exception)
    {
        XmlSampleUtilities.ShowError(
            ResultBox,
            XmlSampleUtilities.FormatFileError(fileName, exception));
    }

    private void ShowXmlLoadError(COMException exception)
    {
        XmlSampleUtilities.ShowError(
            ResultBox,
            XmlSampleUtilities.FormatXmlError(
                AppResources.GetString("OperationLoadXml"),
                exception));
    }
}
