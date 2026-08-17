using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Navigation;
using Windows.Storage;

namespace SDKTemplate;

public sealed partial class ListFoldersPage : Page
{
    private readonly MainPage rootPage = MainPage.Current;
    private StorageLibrary? picturesLibrary;
    private bool isActive;

    public ListFoldersPage()
    {
        InitializeComponent();
    }

    protected override void OnNavigatedTo(NavigationEventArgs e)
    {
        isActive = true;
    }

    protected override void OnNavigatedFrom(NavigationEventArgs e)
    {
        isActive = false;
        if (picturesLibrary is not null)
        {
            picturesLibrary.DefinitionChanged -=
                PicturesLibrary_DefinitionChanged;
        }
    }

    private async void ListFoldersButton_Click(
        object sender,
        RoutedEventArgs e)
    {
        ListFoldersButton.IsEnabled = false;
        try
        {
            if (picturesLibrary is not null)
            {
                picturesLibrary.DefinitionChanged -=
                    PicturesLibrary_DefinitionChanged;
            }

            picturesLibrary =
                await StorageLibrary.GetLibraryAsync(KnownLibraryId.Pictures);
            if (!isActive)
            {
                return;
            }

            picturesLibrary.DefinitionChanged +=
                PicturesLibrary_DefinitionChanged;
            RefreshFolders();
            rootPage.NotifyUser(
                "Pictures library folders loaded.",
                NotifyType.StatusMessage);
        }
        catch (Exception ex)
        {
            rootPage.NotifyOperationError(
                "Listing Pictures library folders",
                ex);
        }
        finally
        {
            if (isActive)
            {
                ListFoldersButton.IsEnabled = true;
            }
        }
    }

    private void PicturesLibrary_DefinitionChanged(
        StorageLibrary sender,
        object args)
    {
        DispatcherQueue.TryEnqueue(RefreshFolders);
    }

    private void RefreshFolders()
    {
        if (!isActive || picturesLibrary is null)
        {
            return;
        }

        IReadOnlyList<StorageFolder> folders =
            picturesLibrary.Folders.ToList();
        FoldersList.ItemsSource = folders;
        FoldersHeader.Text =
            $"Pictures library ({folders.Count} folder(s))";
    }
}
