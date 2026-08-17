using System;
using System.Globalization;
using System.Runtime.InteropServices;
using System.Threading.Tasks;
using Microsoft.UI.Text;
using Microsoft.UI.Xaml.Controls;
using Windows.ApplicationModel;
using Windows.Data.Xml.Dom;
using Windows.Storage;

namespace SDKTemplate;

internal static class XmlSampleUtilities
{
    private const int FileNotFoundHResult = unchecked((int)0x80070002);
    private const int PathNotFoundHResult = unchecked((int)0x80070003);

    internal static string GetText(RichEditBox richEditBox)
    {
        richEditBox.Document.GetText(TextGetOptions.None, out string text);
        return text;
    }

    internal static void SetText(RichEditBox richEditBox, string text, bool isReadOnly)
    {
        richEditBox.IsReadOnly = false;
        richEditBox.Document.SetText(TextSetOptions.None, text);
        richEditBox.IsReadOnly = isReadOnly;
    }

    internal static void ShowError(RichEditBox output, string message)
    {
        SetText(output, message, true);
        MainPage.Current?.NotifyUser(message, NotifyType.ErrorMessage);
    }

    internal static void ShowStatus(string message)
    {
        MainPage.Current?.NotifyUser(message, NotifyType.StatusMessage);
    }

    internal static async Task<StorageFile> GetPackagedFileAsync(
        string scenarioFolderName,
        string fileName)
    {
        StorageFolder dataFolder =
            await Package.Current.InstalledLocation.GetFolderAsync("Data");
        StorageFolder scenarioFolder =
            await dataFolder.GetFolderAsync(scenarioFolderName);
        return await scenarioFolder.GetFileAsync(fileName);
    }

    internal static async Task<XmlDocument> LoadPackagedXmlAsync(
        string scenarioFolderName,
        string fileName,
        XmlLoadSettings? loadSettings = null)
    {
        StorageFile file = await GetPackagedFileAsync(scenarioFolderName, fileName);
        return loadSettings is null
            ? await XmlDocument.LoadFromFileAsync(file)
            : await XmlDocument.LoadFromFileAsync(file, loadSettings);
    }

    internal static bool IsMissingFile(COMException exception)
    {
        return exception.HResult is FileNotFoundHResult or PathNotFoundHResult;
    }

    internal static string FormatFileError(string fileName, Exception exception)
    {
        return string.Format(
            CultureInfo.CurrentCulture,
            AppResources.GetString("PackagedFileError"),
            fileName,
            exception.Message);
    }

    internal static string FormatXmlError(string operation, COMException exception)
    {
        return string.Format(
            CultureInfo.CurrentCulture,
            AppResources.GetString("XmlOperationError"),
            operation,
            exception.Message);
    }

}
