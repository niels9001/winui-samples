using System;
using System.Globalization;
using System.Linq;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Windows.System;
using Windows.Web;
using Windows.Web.Syndication;

namespace SDKTemplate;

public sealed partial class MainPage : Page
{
    private SyndicationFeed? _currentFeed;
    private int _currentItemIndex;
    private Uri? _currentItemUri;

    public MainPage()
    {
        InitializeComponent();
    }

    private async void GetFeedButton_Click(
        object sender,
        RoutedEventArgs e)
    {
        string address = FeedUriTextBox.Text.Trim();
        if (!Uri.TryCreate(address, UriKind.Absolute, out Uri? feedUri) ||
            (feedUri.Scheme != Uri.UriSchemeHttp &&
             feedUri.Scheme != Uri.UriSchemeHttps))
        {
            NotifyUser(
                "Enter an absolute HTTP or HTTPS feed address.",
                InfoBarSeverity.Error);
            return;
        }

        SetDownloadState(isDownloading: true);
        FeedResultsPanel.Visibility = Visibility.Collapsed;
        _currentFeed = null;

        try
        {
            var client = new SyndicationClient
            {
                BypassCacheOnRetrieve = true,
            };
            client.SetRequestHeader(
                "User-Agent",
                "WinUI-Syndication-Sample/1.0");

            NotifyUser(
                $"Downloading {feedUri.Host}...",
                InfoBarSeverity.Informational);
            _currentFeed = await client.RetrieveFeedAsync(feedUri);
            DisplayFeed();
            NotifyUser(
                $"Feed downloaded: {_currentFeed.Items.Count:N0} item(s).",
                InfoBarSeverity.Success);
        }
        catch (Exception exception)
        {
            NotifyFeedError(exception);
        }
        finally
        {
            SetDownloadState(isDownloading: false);
        }
    }

    private void PreviousItemButton_Click(
        object sender,
        RoutedEventArgs e)
    {
        if (_currentFeed is null || _currentItemIndex == 0)
        {
            return;
        }

        _currentItemIndex--;
        DisplayCurrentItem();
    }

    private void NextItemButton_Click(
        object sender,
        RoutedEventArgs e)
    {
        if (_currentFeed is null ||
            _currentItemIndex >= _currentFeed.Items.Count - 1)
        {
            return;
        }

        _currentItemIndex++;
        DisplayCurrentItem();
    }

    private async void ItemLinkButton_Click(
        object sender,
        RoutedEventArgs e)
    {
        if (_currentItemUri is null)
        {
            NotifyUser(
                "This feed item does not provide a link.",
                InfoBarSeverity.Warning);
            return;
        }

        bool launched = await Launcher.LaunchUriAsync(_currentItemUri);
        if (!launched)
        {
            NotifyUser(
                "Windows could not open the feed item link.",
                InfoBarSeverity.Error);
        }
    }

    private void DisplayFeed()
    {
        if (_currentFeed is null)
        {
            throw new InvalidOperationException(
                "A feed must be downloaded before it can be displayed.");
        }

        FeedTitleTextBlock.Text =
            _currentFeed.Title?.Text ?? "(feed has no title)";
        FeedSummaryTextBlock.Text = string.Format(
            CultureInfo.CurrentCulture,
            "{0:N0} item(s)",
            _currentFeed.Items.Count);
        FeedResultsPanel.Visibility = Visibility.Visible;
        _currentItemIndex = 0;

        if (_currentFeed.Items.Count == 0)
        {
            ClearCurrentItem();
            return;
        }

        DisplayCurrentItem();
    }

    private void DisplayCurrentItem()
    {
        if (_currentFeed is null ||
            _currentItemIndex < 0 ||
            _currentItemIndex >= _currentFeed.Items.Count)
        {
            throw new InvalidOperationException(
                "The selected feed item is not available.");
        }

        SyndicationItem item = _currentFeed.Items[_currentItemIndex];
        ItemIndexTextBlock.Text = string.Format(
            CultureInfo.CurrentCulture,
            "{0:N0} of {1:N0}",
            _currentItemIndex + 1,
            _currentFeed.Items.Count);
        ItemTitleTextBlock.Text =
            item.Title?.Text ?? "(item has no title)";

        _currentItemUri = item.Links
            .Select(link => link.Uri)
            .FirstOrDefault(uri => uri is not null);
        ItemLinkTextBlock.Text =
            _currentItemUri?.AbsoluteUri ?? "No item link";
        ItemLinkButton.IsEnabled = _currentItemUri is not null;

        string content =
            item.Content?.Text ??
            item.Summary?.Text ??
            "(item has no content)";
        ItemContentTextBox.Text = HtmlToTextConverter.Convert(content);

        ExtensionsListView.ItemsSource = item.ElementExtensions;
        ExtensionsHeaderTextBlock.Text = string.Format(
            CultureInfo.CurrentCulture,
            "Item extensions ({0:N0})",
            item.ElementExtensions.Count);
        UpdateNavigationButtons();
    }

    private void ClearCurrentItem()
    {
        _currentItemUri = null;
        ItemIndexTextBlock.Text = "0 of 0";
        ItemTitleTextBlock.Text = "This feed has no items.";
        ItemLinkTextBlock.Text = "No item link";
        ItemLinkButton.IsEnabled = false;
        ItemContentTextBox.Text = string.Empty;
        ExtensionsListView.ItemsSource = null;
        ExtensionsHeaderTextBlock.Text = "Item extensions (0)";
        UpdateNavigationButtons();
    }

    private void UpdateNavigationButtons()
    {
        int count = _currentFeed?.Items.Count ?? 0;
        PreviousItemButton.IsEnabled =
            count > 0 && _currentItemIndex > 0;
        NextItemButton.IsEnabled =
            count > 0 && _currentItemIndex < count - 1;
    }

    private void SetDownloadState(bool isDownloading)
    {
        GetFeedButton.IsEnabled = !isDownloading;
        FeedUriTextBox.IsEnabled = !isDownloading;
        DownloadProgressRing.IsActive = isDownloading;
        DownloadProgressRing.Visibility = isDownloading
            ? Visibility.Visible
            : Visibility.Collapsed;
    }

    private void NotifyFeedError(Exception exception)
    {
        SyndicationErrorStatus syndicationStatus =
            SyndicationError.GetStatus(exception.HResult);
        if (syndicationStatus != SyndicationErrorStatus.Unknown)
        {
            string message =
                syndicationStatus == SyndicationErrorStatus.InvalidXml
                    ? "The response is not valid RSS or Atom XML."
                    : $"Syndication error: {syndicationStatus}.";
            NotifyUser(
                $"{message} {exception.Message}",
                InfoBarSeverity.Error);
            return;
        }

        WebErrorStatus webStatus = WebError.GetStatus(exception.HResult);
        if (webStatus != WebErrorStatus.Unknown)
        {
            NotifyUser(
                $"Network error: {webStatus}. {exception.Message}",
                InfoBarSeverity.Error);
            return;
        }

        NotifyUser(
            $"Retrieving the feed failed (0x{exception.HResult:X8}): {exception.Message}",
            InfoBarSeverity.Error);
    }

    private void NotifyUser(string message, InfoBarSeverity severity)
    {
        StatusInfoBar.Message = message;
        StatusInfoBar.Severity = severity;
        StatusInfoBar.IsOpen = true;
    }
}
