using System;
using System.Collections.Generic;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Navigation;
using Windows.Media.Import;

namespace SDKTemplate;

public sealed partial class MainPage : Page
{
    private PhotoImportSource? _source;
    private PhotoImportSession? _session;
    private PhotoImportFindItemsResult? _itemsResult;
    private PhotoImportImportItemsResult? _importedResult;
    private PhotoImportDeleteImportedItemsFromSourceResult? _deleteResult;
    private CancellationTokenSource? _cancellationTokenSource;
    private bool _isSupported;
    private bool _isBusy;
    private bool _isInitialized;
    private bool _hasCompletedImport;

    public MainPage()
    {
        InitializeComponent();
        UpdateControls();
    }

    protected override async void OnNavigatedTo(NavigationEventArgs e)
    {
        base.OnNavigatedTo(e);

        if (_isInitialized)
        {
            return;
        }

        _isInitialized = true;
        await InitializeAsync();
    }

    internal void Dispose()
    {
        _cancellationTokenSource?.Cancel();
        DisposeSession();
    }

    internal void NotifyUser(string message, NotifyType type)
    {
        if (DispatcherQueue.HasThreadAccess)
        {
            UpdateStatus(message, type);
        }
        else
        {
            DispatcherQueue.TryEnqueue(() => UpdateStatus(message, type));
        }
    }

    internal void NotifyOperationError(string operation, Exception exception)
    {
        NotifyUser(
            Strings.Format(
                "OperationFailedFormat",
                operation,
                exception.HResult,
                exception.Message),
            NotifyType.ErrorMessage);
    }

    private async Task InitializeAsync()
    {
        SetBusy(true);

        try
        {
            _isSupported = await PhotoImportManager.IsSupportedAsync();
            if (!_isSupported)
            {
                NotifyUser(
                    Strings.Get("ImportNotSupported"),
                    NotifyType.ErrorMessage);
                return;
            }

            if (!await ResumePendingOperationAsync())
            {
                NotifyUser(
                    Strings.Get("FindSourcesInstruction"),
                    NotifyType.StatusMessage);
            }
        }
        catch (Exception ex)
        {
            NotifyOperationError(Strings.Get("InitializingImportOperation"), ex);
        }
        finally
        {
            SetBusy(false);
        }
    }

    private async void FindSourcesButton_Click(object sender, RoutedEventArgs e)
    {
        SetBusy(true);
        ResetSourceState();

        try
        {
            IReadOnlyList<PhotoImportSource> sources =
                await PhotoImportManager.FindAllSourcesAsync();
            SourceListView.ItemsSource = sources;

            NotifyUser(
                sources.Count == 0
                    ? Strings.Get("NoSourcesFound")
                    : Strings.Format("SourcesFoundFormat", sources.Count),
                sources.Count == 0
                    ? NotifyType.ErrorMessage
                    : NotifyType.StatusMessage);
        }
        catch (Exception ex)
        {
            NotifyOperationError(Strings.Get("FindingSourcesOperation"), ex);
        }
        finally
        {
            SetBusy(false);
        }
    }

    private void SourceListView_SelectionChanged(
        object sender,
        SelectionChangedEventArgs e)
    {
        if (_isBusy)
        {
            return;
        }

        DisposeSession();
        ResetItemState();
        _source = SourceListView.SelectedItem as PhotoImportSource;

        if (_source is null)
        {
            SourceDetailsTextBox.Text = string.Empty;
        }
        else
        {
            SourceDetailsTextBox.Text = BuildSourceDetails(_source);
            NotifyUser(
                Strings.Format("SourceSelectedFormat", _source.DisplayName),
                NotifyType.StatusMessage);
        }

        UpdateControls();
    }

    private void CancelButton_Click(object sender, RoutedEventArgs e)
    {
        CancellationTokenSource? cancellationTokenSource =
            _cancellationTokenSource;
        if (cancellationTokenSource is null ||
            cancellationTokenSource.IsCancellationRequested)
        {
            return;
        }

        cancellationTokenSource.Cancel();
        CancelButton.IsEnabled = false;
        NotifyUser(
            Strings.Get("CancellationRequested"),
            NotifyType.StatusMessage);
    }

    private void ItemSelectionCheckBox_Click(object sender, RoutedEventArgs e)
    {
        DispatcherQueue.TryEnqueue(() =>
        {
            UpdateFindSummary();
            UpdateControls();
        });
    }

    private void SetBusy(bool isBusy)
    {
        _isBusy = isBusy;
        OperationProgressRing.IsActive = isBusy;
        UpdateControls();
    }

    private void UpdateControls()
    {
        FindSourcesButton.IsEnabled = _isSupported && !_isBusy;
        SourceListView.IsEnabled = !_isBusy;

        bool hasSource = _source is not null && !_isBusy;
        FindNewItemsButton.IsEnabled = hasSource;
        FindAllItemsButton.IsEnabled = hasSource;

        bool hasItems =
            _itemsResult is not null &&
            _itemsResult.HasSucceeded &&
            !_isBusy;
        bool canConfigureImport = hasItems && !_hasCompletedImport;
        SelectNewButton.IsEnabled = canConfigureImport;
        SelectAllButton.IsEnabled = canConfigureImport;
        SelectNoneButton.IsEnabled = canConfigureImport;
        AppendDateCheckBox.IsEnabled = canConfigureImport;
        SubfolderModeComboBox.IsEnabled = canConfigureImport;
        ImportButton.IsEnabled =
            canConfigureImport && _itemsResult!.SelectedTotalCount > 0;
        DeleteImportedButton.IsEnabled =
            _importedResult is not null && !_isBusy;
        CancelButton.IsEnabled =
            _cancellationTokenSource is not null &&
            !_cancellationTokenSource.IsCancellationRequested;
    }

    private void UpdateStatus(string message, NotifyType type)
    {
        if (string.IsNullOrEmpty(message))
        {
            StatusInfoBar.IsOpen = false;
            StatusInfoBar.Message = string.Empty;
            return;
        }

        StatusInfoBar.Severity = type == NotifyType.ErrorMessage
            ? InfoBarSeverity.Error
            : InfoBarSeverity.Success;
        StatusInfoBar.Message = message;
        StatusInfoBar.IsOpen = true;
    }

    private void ResetSourceState()
    {
        DisposeSession();
        _source = null;
        SourceListView.ItemsSource = null;
        SourceDetailsTextBox.Text = string.Empty;
        ResetItemState();
    }

    private void ResetItemState()
    {
        _itemsResult = null;
        _importedResult = null;
        _deleteResult = null;
        _hasCompletedImport = false;
        ItemsListView.ItemsSource = null;
        ResultsTextBox.Text = string.Empty;
        OperationProgressBar.Value = 0;
    }

    private void DisposeSession()
    {
        _session?.Dispose();
        _session = null;
    }

    private static string BuildSourceDetails(PhotoImportSource source)
    {
        var details = new StringBuilder();
        details.AppendLine(Strings.Format(
            "SourceDescriptionFormat",
            source.Description));
        details.AppendLine(Strings.Format(
            "SourceManufacturerFormat",
            source.Manufacturer));
        details.AppendLine(Strings.Format(
            "SourceMassStorageFormat",
            source.IsMassStorage));
        details.AppendLine(Strings.Format("SourceIdFormat", source.Id));

        if (source.StorageMedia.Count == 0)
        {
            details.AppendLine(Strings.Get("NoStorageMediaDetails"));
        }
        else
        {
            foreach (PhotoImportStorageMedium medium in source.StorageMedia)
            {
                details.AppendLine();
                details.AppendLine(Strings.Format(
                    "StorageMediumNameFormat",
                    medium.Name));
                details.AppendLine(Strings.Format(
                    "StorageMediumTypeFormat",
                    medium.StorageMediumType));
                details.AppendLine(Strings.Format(
                    "StorageMediumAvailableFormat",
                    FormatBytes(medium.AvailableSpaceInBytes)));
                details.AppendLine(Strings.Format(
                    "StorageMediumCapacityFormat",
                    FormatBytes(medium.CapacityInBytes)));
                details.AppendLine(Strings.Format(
                    "StorageMediumSerialFormat",
                    medium.SerialNumber));
            }
        }

        return details.ToString().TrimEnd();
    }

    private static string FormatBytes(ulong value)
    {
        string[] units = ["B", "KB", "MB", "GB", "TB"];
        double size = value;
        int unitIndex = 0;

        while (size >= 1024 && unitIndex < units.Length - 1)
        {
            size /= 1024;
            unitIndex++;
        }

        return string.Format(
            System.Globalization.CultureInfo.CurrentCulture,
            "{0:0.##} {1}",
            size,
            units[unitIndex]);
    }
}

internal enum NotifyType
{
    StatusMessage,
    ErrorMessage,
}
