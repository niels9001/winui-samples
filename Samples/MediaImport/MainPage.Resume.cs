using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Windows.Media.Import;

namespace SDKTemplate;

public sealed partial class MainPage
{
    private async Task<bool> ResumePendingOperationAsync()
    {
        IReadOnlyList<PhotoImportOperation> operations =
            PhotoImportManager.GetPendingOperations();
        if (operations.Count == 0)
        {
            return false;
        }

        for (int index = 0; index < operations.Count - 1; index++)
        {
            operations[index].Session.Dispose();
        }

        PhotoImportOperation operation = operations[^1];
        if (operation.Stage == PhotoImportStage.NotStarted)
        {
            operation.Session.Dispose();
            return false;
        }

        _session = operation.Session;
        using var cancellationTokenSource = new CancellationTokenSource();
        _cancellationTokenSource = cancellationTokenSource;
        UpdateControls();

        try
        {
            switch (operation.Stage)
            {
                case PhotoImportStage.FindingItems:
                    await ResumeFindingItemsAsync(
                        operation,
                        cancellationTokenSource.Token);
                    break;

                case PhotoImportStage.ImportingItems:
                    await ResumeImportingItemsAsync(
                        operation,
                        cancellationTokenSource.Token);
                    break;

                case PhotoImportStage.DeletingImportedItemsFromSource:
                    await ResumeDeletingItemsAsync(
                        operation,
                        cancellationTokenSource.Token);
                    break;

                default:
                    return false;
            }

            return true;
        }
        catch (OperationCanceledException)
        {
            NotifyUser(
                Strings.Get("OperationCanceled"),
                NotifyType.StatusMessage);
            return true;
        }
        finally
        {
            if (ReferenceEquals(
                _cancellationTokenSource,
                cancellationTokenSource))
            {
                _cancellationTokenSource = null;
            }
        }
    }

    private async Task ResumeFindingItemsAsync(
        PhotoImportOperation operation,
        CancellationToken cancellationToken)
    {
        NotifyUser(
            Strings.Get("ReconnectingFindOperation"),
            NotifyType.StatusMessage);

        var progress = new Progress<uint>(count =>
            NotifyUser(
                Strings.Format("FilesFoundProgressFormat", count),
                NotifyType.StatusMessage));

        _itemsResult = await operation.ContinueFindingItemsAsync
            .AsTask(cancellationToken, progress);
        ItemsListView.ItemsSource = _itemsResult.FoundItems;
        UpdateFindSummary();
        NotifyUser(
            Strings.Get("FindOperationReconnected"),
            NotifyType.StatusMessage);
    }

    private async Task ResumeImportingItemsAsync(
        PhotoImportOperation operation,
        CancellationToken cancellationToken)
    {
        NotifyUser(
            Strings.Get("ReconnectingImportOperation"),
            NotifyType.StatusMessage);

        _itemsResult = await operation.ContinueFindingItemsAsync.AsTask();
        ItemsListView.ItemsSource = _itemsResult.FoundItems;
        _itemsResult.ItemImported += ItemsResult_ItemImported;

        try
        {
            var progress = new Progress<PhotoImportProgress>(value =>
                OperationProgressBar.Value = value.ImportProgress);
            _importedResult = await operation.ContinueImportingItemsAsync
                .AsTask(cancellationToken, progress);
            _hasCompletedImport = true;
        }
        finally
        {
            _itemsResult.ItemImported -= ItemsResult_ItemImported;
        }

        ResultsTextBox.Text = BuildImportedSummary(_importedResult);
        NotifyUser(
            Strings.Get("ImportOperationReconnected"),
            NotifyType.StatusMessage);
    }

    private async Task ResumeDeletingItemsAsync(
        PhotoImportOperation operation,
        CancellationToken cancellationToken)
    {
        NotifyUser(
            Strings.Get("ReconnectingDeleteOperation"),
            NotifyType.StatusMessage);

        var progress = new Progress<double>(value =>
            OperationProgressBar.Value = value);
        _deleteResult = await operation
            .ContinueDeletingImportedItemsFromSourceAsync
            .AsTask(cancellationToken, progress);
        ResultsTextBox.Text = BuildDeletedSummary(_deleteResult);
        NotifyUser(
            Strings.Get("DeleteOperationReconnected"),
            NotifyType.StatusMessage);
    }
}
