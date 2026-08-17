using System;
using System.Collections.Generic;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Windows.Media.Import;

namespace SDKTemplate;

public sealed partial class MainPage
{
    private async void FindNewItemsButton_Click(
        object sender,
        RoutedEventArgs e)
    {
        await FindItemsAsync(PhotoImportItemSelectionMode.SelectNew);
    }

    private async void FindAllItemsButton_Click(
        object sender,
        RoutedEventArgs e)
    {
        await FindItemsAsync(PhotoImportItemSelectionMode.SelectAll);
    }

    private async Task FindItemsAsync(
        PhotoImportItemSelectionMode selectionMode)
    {
        PhotoImportSource? source = _source;
        if (source is null)
        {
            NotifyUser(
                Strings.Get("SelectSourceFirst"),
                NotifyType.ErrorMessage);
            return;
        }

        DisposeSession();
        ResetItemState();
        _session = source.CreateImportSession();
        ApplySessionOptions();

        using var cancellationTokenSource = new CancellationTokenSource();
        _cancellationTokenSource = cancellationTokenSource;
        SetBusy(true);

        try
        {
            var progress = new Progress<uint>(count =>
                NotifyUser(
                    Strings.Format("FilesFoundProgressFormat", count),
                    NotifyType.StatusMessage));

            _itemsResult = await _session
                .FindItemsAsync(
                    GetContentFilter(),
                    selectionMode)
                .AsTask(cancellationTokenSource.Token, progress);

            ItemsListView.ItemsSource = _itemsResult.FoundItems;
            UpdateFindSummary();

            NotifyUser(
                _itemsResult.HasSucceeded
                    ? Strings.Format(
                        "ItemsFoundFormat",
                        _itemsResult.TotalCount)
                    : Strings.Get("FindingItemsIncomplete"),
                _itemsResult.HasSucceeded
                    ? NotifyType.StatusMessage
                    : NotifyType.ErrorMessage);
        }
        catch (OperationCanceledException)
        {
            NotifyUser(
                Strings.Get("OperationCanceled"),
                NotifyType.StatusMessage);
        }
        catch (Exception ex)
        {
            NotifyOperationError(Strings.Get("FindingItemsOperation"), ex);
        }
        finally
        {
            if (ReferenceEquals(
                _cancellationTokenSource,
                cancellationTokenSource))
            {
                _cancellationTokenSource = null;
            }

            SetBusy(false);
        }
    }

    private async void SelectNewButton_Click(object sender, RoutedEventArgs e)
    {
        PhotoImportFindItemsResult? itemsResult = _itemsResult;
        if (itemsResult is null)
        {
            return;
        }

        SetBusy(true);

        try
        {
            await itemsResult.SelectNewAsync();
            RefreshItemsList();
            UpdateFindSummary();
        }
        catch (Exception ex)
        {
            NotifyOperationError(Strings.Get("SelectingNewItemsOperation"), ex);
        }
        finally
        {
            SetBusy(false);
        }
    }

    private void SelectAllButton_Click(object sender, RoutedEventArgs e)
    {
        _itemsResult?.SelectAll();
        RefreshItemsList();
        UpdateFindSummary();
        UpdateControls();
    }

    private void SelectNoneButton_Click(object sender, RoutedEventArgs e)
    {
        _itemsResult?.SelectNone();
        RefreshItemsList();
        UpdateFindSummary();
        UpdateControls();
    }

    private async void ImportButton_Click(object sender, RoutedEventArgs e)
    {
        PhotoImportFindItemsResult? itemsResult = _itemsResult;
        if (itemsResult is null || itemsResult.SelectedTotalCount == 0)
        {
            NotifyUser(
                Strings.Get("NothingSelectedForImport"),
                NotifyType.ErrorMessage);
            return;
        }

        ApplySessionOptions();
        OperationProgressBar.Value = 0;

        using var cancellationTokenSource = new CancellationTokenSource();
        _cancellationTokenSource = cancellationTokenSource;
        SetBusy(true);
        itemsResult.ItemImported += ItemsResult_ItemImported;

        try
        {
            var progress = new Progress<PhotoImportProgress>(value =>
                OperationProgressBar.Value = value.ImportProgress);

            _importedResult = await itemsResult
                .ImportItemsAsync()
                .AsTask(cancellationTokenSource.Token, progress);
            _hasCompletedImport = true;

            ResultsTextBox.Text = BuildImportedSummary(_importedResult);
            NotifyUser(
                _importedResult.HasSucceeded
                    ? Strings.Format(
                        "ImportCompletedFormat",
                        _importedResult.TotalCount)
                    : Strings.Get("ImportIncomplete"),
                _importedResult.HasSucceeded
                    ? NotifyType.StatusMessage
                    : NotifyType.ErrorMessage);
        }
        catch (OperationCanceledException)
        {
            NotifyUser(
                Strings.Get("OperationCanceled"),
                NotifyType.StatusMessage);
        }
        catch (Exception ex)
        {
            NotifyOperationError(Strings.Get("ImportingItemsOperation"), ex);
        }
        finally
        {
            itemsResult.ItemImported -= ItemsResult_ItemImported;
            if (ReferenceEquals(
                _cancellationTokenSource,
                cancellationTokenSource))
            {
                _cancellationTokenSource = null;
            }

            SetBusy(false);
        }
    }

    private async void DeleteImportedButton_Click(
        object sender,
        RoutedEventArgs e)
    {
        PhotoImportImportItemsResult? importedResult = _importedResult;
        if (importedResult is null)
        {
            NotifyUser(
                Strings.Get("NothingImportedForDeletion"),
                NotifyType.ErrorMessage);
            return;
        }

        var dialog = new ContentDialog
        {
            Title = Strings.Get("DeleteDialogTitle"),
            Content = Strings.Get("DeleteDialogContent"),
            PrimaryButtonText = Strings.Get("DeleteDialogPrimaryButton"),
            CloseButtonText = Strings.Get("DeleteDialogCloseButton"),
            DefaultButton = ContentDialogButton.Close,
            XamlRoot = XamlRoot,
        };

        if (await dialog.ShowAsync() != ContentDialogResult.Primary)
        {
            return;
        }

        OperationProgressBar.Value = 0;
        using var cancellationTokenSource = new CancellationTokenSource();
        _cancellationTokenSource = cancellationTokenSource;
        SetBusy(true);

        try
        {
            var progress = new Progress<double>(value =>
                OperationProgressBar.Value = value);

            _deleteResult = await importedResult
                .DeleteImportedItemsFromSourceAsync()
                .AsTask(cancellationTokenSource.Token, progress);
            _importedResult = null;

            ResultsTextBox.Text = BuildDeletedSummary(_deleteResult);
            NotifyUser(
                _deleteResult.HasSucceeded
                    ? Strings.Format(
                        "DeleteCompletedFormat",
                        _deleteResult.TotalCount)
                    : Strings.Get("DeleteIncomplete"),
                _deleteResult.HasSucceeded
                    ? NotifyType.StatusMessage
                    : NotifyType.ErrorMessage);
        }
        catch (OperationCanceledException)
        {
            NotifyUser(
                Strings.Get("OperationCanceled"),
                NotifyType.StatusMessage);
        }
        catch (Exception ex)
        {
            NotifyOperationError(Strings.Get("DeletingItemsOperation"), ex);
        }
        finally
        {
            if (ReferenceEquals(
                _cancellationTokenSource,
                cancellationTokenSource))
            {
                _cancellationTokenSource = null;
            }

            SetBusy(false);
        }
    }

    private void ItemsResult_ItemImported(
        PhotoImportFindItemsResult sender,
        PhotoImportItemImportedEventArgs args)
    {
        NotifyUser(
            Strings.Format(
                "ItemImportedFormat",
                args.ImportedItem.Name),
            NotifyType.StatusMessage);
    }

    private PhotoImportContentTypeFilter GetContentFilter()
    {
        return ((ContentFilterComboBox.SelectedItem as ComboBoxItem)?.Tag as string)
            switch
            {
                "OnlyImages" => PhotoImportContentTypeFilter.OnlyImages,
                "OnlyVideos" => PhotoImportContentTypeFilter.OnlyVideos,
                _ => PhotoImportContentTypeFilter.ImagesAndVideos,
            };
    }

    private void ApplySessionOptions()
    {
        PhotoImportSession? session = _session;
        if (session is null)
        {
            return;
        }

        session.AppendSessionDateToDestinationFolder =
            AppendDateCheckBox.IsChecked == true;
        session.SubfolderCreationMode =
            ((SubfolderModeComboBox.SelectedItem as ComboBoxItem)?.Tag as string)
                switch
                {
                    "DoNotCreateSubfolders" =>
                        PhotoImportSubfolderCreationMode.DoNotCreateSubfolders,
                    "CreateSubfoldersFromExifDate" =>
                        PhotoImportSubfolderCreationMode.CreateSubfoldersFromExifDate,
                    "KeepOriginalFolderStructure" =>
                        PhotoImportSubfolderCreationMode.KeepOriginalFolderStructure,
                    _ =>
                        PhotoImportSubfolderCreationMode.CreateSubfoldersFromFileDate,
                };
    }

    private void RefreshItemsList()
    {
        IReadOnlyList<PhotoImportItem>? items = _itemsResult?.FoundItems;
        ItemsListView.ItemsSource = null;
        ItemsListView.ItemsSource = items;
    }

    private void UpdateFindSummary()
    {
        PhotoImportFindItemsResult? result = _itemsResult;
        if (result is null)
        {
            return;
        }

        var summary = new StringBuilder();
        summary.AppendLine(Strings.Format(
            "PhotosSummaryFormat",
            result.PhotosCount,
            result.SelectedPhotosCount));
        summary.AppendLine(Strings.Format(
            "VideosSummaryFormat",
            result.VideosCount,
            result.SelectedVideosCount));
        summary.AppendLine(Strings.Format(
            "SidecarsSummaryFormat",
            result.SidecarsCount,
            result.SelectedSidecarsCount));
        summary.AppendLine(Strings.Format(
            "SiblingsSummaryFormat",
            result.SiblingsCount,
            result.SelectedSiblingsCount));
        summary.AppendLine(Strings.Format(
            "TotalItemsSummaryFormat",
            result.TotalCount,
            result.SelectedTotalCount));
        ResultsTextBox.Text = summary.ToString().TrimEnd();
    }

    private static string BuildImportedSummary(
        PhotoImportImportItemsResult result)
    {
        var summary = new StringBuilder();
        summary.AppendLine(Strings.Format(
            "ImportedPhotosFormat",
            result.PhotosCount));
        summary.AppendLine(Strings.Format(
            "ImportedVideosFormat",
            result.VideosCount));
        summary.AppendLine(Strings.Format(
            "ImportedSidecarsFormat",
            result.SidecarsCount));
        summary.AppendLine(Strings.Format(
            "ImportedSiblingsFormat",
            result.SiblingsCount));
        summary.AppendLine(Strings.Format(
            "ImportedTotalFormat",
            result.TotalCount));
        summary.AppendLine(Strings.Format(
            "ImportedBytesFormat",
            FormatBytes(result.TotalSizeInBytes)));
        return summary.ToString().TrimEnd();
    }

    private static string BuildDeletedSummary(
        PhotoImportDeleteImportedItemsFromSourceResult result)
    {
        var summary = new StringBuilder();
        summary.AppendLine(Strings.Format(
            "DeletedPhotosFormat",
            result.PhotosCount));
        summary.AppendLine(Strings.Format(
            "DeletedVideosFormat",
            result.VideosCount));
        summary.AppendLine(Strings.Format(
            "DeletedSidecarsFormat",
            result.SidecarsCount));
        summary.AppendLine(Strings.Format(
            "DeletedSiblingsFormat",
            result.SiblingsCount));
        summary.AppendLine(Strings.Format(
            "DeletedTotalFormat",
            result.TotalCount));
        summary.AppendLine(Strings.Format(
            "DeletedBytesFormat",
            FormatBytes(result.TotalSizeInBytes)));
        return summary.ToString().TrimEnd();
    }
}
