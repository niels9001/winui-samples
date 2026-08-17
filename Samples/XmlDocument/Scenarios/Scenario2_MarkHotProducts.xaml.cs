using System;
using System.Globalization;
using System.IO;
using System.Runtime.InteropServices;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Windows.Data.Xml.Dom;
using Windows.Storage;

namespace SDKTemplate;

public sealed partial class Scenario2_MarkHotProducts : Page
{
    private const string FolderName = "MarkHotProducts";
    private const string FileName = "products.xml";
    private bool _isInitialized;

    public Scenario2_MarkHotProducts()
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
            XmlSampleUtilities.SetText(MarketDataBox, document.GetXml(), true);
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
                    AppResources.GetString("OperationLoadProductData"),
                    exception));
        }
    }

    private void MarkHotProductsButton_Click(object sender, RoutedEventArgs e)
    {
        try
        {
            var document = new XmlDocument();
            document.LoadXml(XmlSampleUtilities.GetText(MarketDataBox));

            XmlNodeList hotAttributes =
                document.SelectNodes("/products/product[Sell10day>InStore]/@hot");
            for (uint index = 0; index < hotAttributes.Length; index++)
            {
                hotAttributes.Item(index).NodeValue = "1";
            }

            XmlSampleUtilities.SetText(ResultBox, document.GetXml(), true);
            SaveHotProductsButton.IsEnabled = true;

            string status = string.Format(
                CultureInfo.CurrentCulture,
                AppResources.GetString("HotProductsMarkedStatus"),
                hotAttributes.Length);
            XmlSampleUtilities.ShowStatus(status);
        }
        catch (COMException exception)
        {
            SaveHotProductsButton.IsEnabled = false;
            XmlSampleUtilities.ShowError(
                ResultBox,
                XmlSampleUtilities.FormatXmlError(
                    AppResources.GetString("OperationMarkHotProducts"),
                    exception));
        }
    }

    private async void SaveHotProductsButton_Click(object sender, RoutedEventArgs e)
    {
        XmlDocument document;
        try
        {
            document = new XmlDocument();
            document.LoadXml(XmlSampleUtilities.GetText(ResultBox));
        }
        catch (COMException exception)
        {
            XmlSampleUtilities.ShowError(
                ResultBox,
                XmlSampleUtilities.FormatXmlError(
                    AppResources.GetString("OperationValidateProductData"),
                    exception));
            return;
        }

        try
        {
            StorageFile file =
                await ApplicationData.Current.LocalFolder.CreateFileAsync(
                    "HotProducts.xml",
                    CreationCollisionOption.GenerateUniqueName);
            await document.SaveToFileAsync(file);

            string message = string.Format(
                CultureInfo.CurrentCulture,
                AppResources.GetString("XmlSavedStatus"),
                file.Path);
            XmlSampleUtilities.SetText(ResultBox, message, true);
            XmlSampleUtilities.ShowStatus(message);
            SaveHotProductsButton.IsEnabled = false;
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

    private void ShowPackagedFileError(Exception exception)
    {
        XmlSampleUtilities.ShowError(
            ResultBox,
            XmlSampleUtilities.FormatFileError(FileName, exception));
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
