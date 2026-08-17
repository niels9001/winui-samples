using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Windows.Storage;

namespace SDKTemplate;

public sealed partial class AddFolderPage : Page
{
    private readonly MainPage rootPage = MainPage.Current;

    public AddFolderPage()
    {
        InitializeComponent();
    }

    private async void AddFolderButton_Click(
        object sender,
        RoutedEventArgs e)
    {
        AddFolderButton.IsEnabled = false;
        rootPage.NotifyUser(
            "Waiting for folder selection.",
            NotifyType.StatusMessage);

        try
        {
            StorageLibrary picturesLibrary =
                await StorageLibrary.GetLibraryAsync(KnownLibraryId.Pictures);
            StorageFolder? folder =
                await picturesLibrary.RequestAddFolderAsync();

            if (folder is null)
            {
                OutputText.Text = "No folder was added.";
                rootPage.NotifyUser(
                    "Folder selection was canceled.",
                    NotifyType.StatusMessage);
                return;
            }

            OutputText.Text =
                $"{folder.DisplayName} was added to the Pictures library." +
                Environment.NewLine +
                folder.Path;
            rootPage.NotifyUser(
                "Folder added to the Pictures library.",
                NotifyType.StatusMessage);
        }
        catch (Exception ex)
        {
            rootPage.NotifyOperationError(
                "Adding a folder to the Pictures library",
                ex);
        }
        finally
        {
            AddFolderButton.IsEnabled = true;
        }
    }
}
