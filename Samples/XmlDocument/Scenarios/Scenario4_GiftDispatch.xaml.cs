using System;
using System.Globalization;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Windows.Data.Xml.Dom;

namespace SDKTemplate;

public sealed partial class Scenario4_GiftDispatch : Page
{
    private const string FolderName = "GiftDispatch";
    private const string FileName = "employees.xml";
    private bool _isInitialized;

    public Scenario4_GiftDispatch()
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
            XmlSampleUtilities.SetText(EmployeeProfileBox, document.GetXml(), true);
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
                    AppResources.GetString("OperationLoadEmployeeData"),
                    exception));
        }
    }

    private void ShowGiftsButton_Click(object sender, RoutedEventArgs e)
    {
        try
        {
            var document = new XmlDocument();
            document.LoadXml(XmlSampleUtilities.GetText(EmployeeProfileBox));

            const int referenceYear = 2012;
            string[] queries =
            [
                $"descendant::employee[startyear <= {referenceYear - 1} and startyear > {referenceYear - 5}]",
                $"descendant::employee[startyear <= {referenceYear - 5} and startyear > {referenceYear - 10}]",
                $"descendant::employee[startyear <= {referenceYear - 10}]",
            ];
            string[] gifts =
            [
                AppResources.GetString("GiftCard"),
                AppResources.GetString("Xbox"),
                AppResources.GetString("WindowsPhone"),
            ];

            var output = new StringBuilder();
            for (int queryIndex = 0; queryIndex < queries.Length; queryIndex++)
            {
                XmlNodeList employees = document.SelectNodes(queries[queryIndex]);
                foreach (IXmlNode employee in employees)
                {
                    IXmlNode? nameNode = employee.SelectSingleNode("name");
                    IXmlNode? departmentNode = employee.SelectSingleNode("department");
                    if (nameNode is null || departmentNode is null)
                    {
                        XmlSampleUtilities.ShowError(
                            ResultBox,
                            AppResources.GetString("EmployeeDataMissingFields"));
                        return;
                    }

                    output.AppendFormat(
                        CultureInfo.CurrentCulture,
                        "[{0}]/[{1}]/[{2}]{3}",
                        nameNode.InnerText,
                        departmentNode.InnerText,
                        gifts[queryIndex],
                        Environment.NewLine);
                }
            }

            XmlSampleUtilities.SetText(ResultBox, output.ToString(), true);
            XmlSampleUtilities.ShowStatus(AppResources.GetString("GiftsCalculatedStatus"));
        }
        catch (COMException exception)
        {
            XmlSampleUtilities.ShowError(
                ResultBox,
                XmlSampleUtilities.FormatXmlError(
                    AppResources.GetString("OperationQueryEmployees"),
                    exception));
        }
    }

    private void ShowPackagedFileError(Exception exception)
    {
        XmlSampleUtilities.ShowError(
            ResultBox,
            XmlSampleUtilities.FormatFileError(FileName, exception));
    }
}
