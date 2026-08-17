using System;
using System.IO;
using System.Runtime.InteropServices;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Windows.Data.Xml.Dom;

namespace SDKTemplate;

public sealed partial class Scenario1_BuildNewRss : Page
{
    private const string FolderName = "BuildRss";
    private const string FileName = "rssTemplate.xml";
    private bool _isInitialized;

    public Scenario1_BuildNewRss()
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
            XmlDocument document =
                await XmlSampleUtilities.LoadPackagedXmlAsync(FolderName, FileName);
            XmlSampleUtilities.SetText(RssTemplateBox, document.GetXml(), true);
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
                    AppResources.GetString("OperationLoadRssTemplate"),
                    exception));
        }
    }

    private void BuildRssButton_Click(object sender, RoutedEventArgs e)
    {
        string rssContent = RssContentInput.Text;
        if (string.IsNullOrWhiteSpace(rssContent))
        {
            XmlSampleUtilities.ShowError(
                ResultBox,
                AppResources.GetString("RssContentRequired"));
            return;
        }

        try
        {
            var document = new XmlDocument();
            document.LoadXml(XmlSampleUtilities.GetText(RssTemplateBox));

            XmlNodeList contentElements = document.GetElementsByTagName("content");
            IXmlNode? contentElement = contentElements.Length > 0
                ? contentElements.Item(0)
                : null;
            if (contentElement is null)
            {
                XmlSampleUtilities.ShowError(
                    ResultBox,
                    AppResources.GetString("RssTemplateMissingContent"));
                return;
            }

            XmlCDataSection cdata = document.CreateCDataSection(rssContent);
            contentElement.AppendChild(cdata);

            XmlSampleUtilities.SetText(ResultBox, document.GetXml(), true);
            XmlSampleUtilities.ShowStatus(AppResources.GetString("RssBuiltStatus"));
        }
        catch (COMException exception)
        {
            XmlSampleUtilities.ShowError(
                ResultBox,
                XmlSampleUtilities.FormatXmlError(
                    AppResources.GetString("OperationBuildRss"),
                    exception));
        }
        catch (ArgumentException exception)
        {
            string message = string.Format(
                System.Globalization.CultureInfo.CurrentCulture,
                AppResources.GetString("RssContentInvalid"),
                exception.Message);
            XmlSampleUtilities.ShowError(ResultBox, message);
        }
    }

    private void ShowPackagedFileError(Exception exception)
    {
        XmlSampleUtilities.ShowError(
            ResultBox,
            XmlSampleUtilities.FormatFileError(FileName, exception));
    }
}
