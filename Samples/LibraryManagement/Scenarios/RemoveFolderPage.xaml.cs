using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Navigation;
using Windows.Storage;

namespace SDKTemplate;

public sealed partial class RemoveFolderPage : Page
{
    private readonly MainPage rootPage = MainPage.Current;
    private StorageLibrary? picturesLibrary;
    private bool isActive;

    public RemoveFolderPage()
    {
        InitializeComponent();
    }

    protected override async void OnNavigatedTo(NavigationEventArgs e)
    {
        isActive = true;
        await LoadLibraryAsync();
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

    private async Task LoadLibraryAsync()
    {
        try
        {
            picturesLibrary =
                await StorageLibrary.GetLibraryAsync(KnownLibraryId.Pictures);
            if (!isActive)
            {
                return;
            }

            picturesLibrary.DefinitionChanged +=
                PicturesLibrary_DefinitionChanged;
            RefreshFolders();
        }
        catch (Exception ex)
        {
            rootPage.NotifyOperationError(
                "Loading Pictures library folders",
                ex);
        }
    }

    private async void RemoveFolderButton_Click(
        object sender,
        RoutedEventArgs e)
    {
        if (picturesLibrary is null ||
            FoldersComboBox.SelectedItem is not StorageFolder folder)
        {
            rootPage.NotifyUser(
                "Select a folder to remove.",
                NotifyType.ErrorMessage);
            return;
        }

        RemoveFolderButton.IsEnabled = false;
        try
        {
            bool removed =
                await picturesLibrary.RequestRemoveFolderAsync(folder);
            if (removed)
            {
                OutputText.Text =
                    $"{folder.DisplayName} was removed from the Pictures library.";
                rootPage.NotifyUser(
                    "Folder removed from the library definition.",
                    NotifyType.StatusMessage);
                RefreshFolders();
            }
            else
            {
                OutputText.Text = "No folder was removed.";
                rootPage.NotifyUser(
                    "Folder removal was canceled or declined.",
                    NotifyType.StatusMessage);
            }
        }
        catch (Exception ex)
        {
            rootPage.NotifyOperationError(
                "Removing the Pictures library folder",
                ex);
        }
        finally
        {
            if (isActive)
            {
                RemoveFolderButton.IsEnabled =
                    FoldersComboBox.Items.Count > 0;
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
        FoldersComboBox.ItemsSource = folders;
        FoldersComboBox.SelectedIndex = folders.Count > 0 ? 0 : -1;
        RemoveFolderButton.IsEnabled = folders.Count > 0;
    }
}
