//*********************************************************
//
// Copyright (c) Microsoft. All rights reserved.
// This code is licensed under the MIT License (MIT).
// THIS CODE IS PROVIDED *AS IS* WITHOUT WARRANTY OF
// ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING ANY
// IMPLIED WARRANTIES OF FITNESS FOR A PARTICULAR
// PURPOSE, MERCHANTABILITY, OR NON-INFRINGEMENT.
//
//*********************************************************

using System;
using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Linq;
using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Navigation;
using Windows.Devices.Enumeration;
using Windows.Devices.PointOfService;
using Windows.Media.Capture;
using Windows.Media.Capture.Frames;
using Windows.Media.Core;
using Windows.Media.Playback;
using Windows.System.Display;

namespace SDKTemplate
{
    public sealed partial class Scenario5_DisplayingBarcodePreview : Page, INotifyPropertyChanged
    {
        private readonly MainPage rootPage = MainPage.Current;
        private readonly ObservableCollection<BarcodeScannerInfo> barcodeScanners = new();
        private readonly SemaphoreSlim selectionLock = new(1, 1);
        private readonly DisplayRequest displayRequest = new();
        private readonly DeviceWatcher watcher;

        private BarcodeScanner? selectedScanner;
        private ClaimedBarcodeScanner? claimedScanner;
        private MediaCapture? mediaCapture;
        private MediaFrameSource? previewFrameSource;
        private MediaPlayer? mediaPlayer;
        private int selectionVersion;
        private bool isNavigatedAway;
        private bool displayRequestActive;

        public bool IsScannerClaimed { get; private set; }
        public bool IsPreviewing { get; private set; }
        public bool ScannerSupportsPreview { get; private set; }
        public bool SoftwareTriggerStarted { get; private set; }

        public event PropertyChangedEventHandler? PropertyChanged;

        public Scenario5_DisplayingBarcodePreview()
        {
            InitializeComponent();
            ScannerListSource.Source = barcodeScanners;
            DataContext = this;

            watcher = DeviceInformation.CreateWatcher(BarcodeScanner.GetDeviceSelector());
            watcher.Added += Watcher_Added;
            watcher.Removed += Watcher_Removed;
            watcher.Updated += Watcher_Updated;
        }

        protected override void OnNavigatedTo(NavigationEventArgs e)
        {
            base.OnNavigatedTo(e);
            watcher.Start();
            rootPage.NotifyUser(
                "Select a scanner to claim it and inspect its camera-preview support.",
                NotifyType.StatusMessage);
        }

        protected override async void OnNavigatedFrom(NavigationEventArgs e)
        {
            isNavigatedAway = true;
            selectionVersion++;
            watcher.Stop();

            await selectionLock.WaitAsync();
            try
            {
                CloseScannerResources();
            }
            finally
            {
                selectionLock.Release();
            }

            base.OnNavigatedFrom(e);
        }

        private void Watcher_Added(DeviceWatcher sender, DeviceInformation device)
        {
            DispatcherQueue.TryEnqueue(() =>
            {
                if (isNavigatedAway)
                {
                    return;
                }

                barcodeScanners.Add(new BarcodeScannerInfo(device.Name, device.Id));
                if (barcodeScanners.Count == 1)
                {
                    ScannerListBox.SelectedIndex = 0;
                }
            });
        }

        private void Watcher_Removed(DeviceWatcher sender, DeviceInformationUpdate update)
        {
            DispatcherQueue.TryEnqueue(() =>
            {
                BarcodeScannerInfo? removed =
                    barcodeScanners.FirstOrDefault(scanner => scanner.DeviceId == update.Id);
                if (removed is not null)
                {
                    barcodeScanners.Remove(removed);
                }
            });
        }

        private void Watcher_Updated(DeviceWatcher sender, DeviceInformationUpdate update)
        {
            // Handling this event keeps DeviceWatcher updates active; no displayed fields need updating.
        }

        private async void ScannerSelection_Changed(object sender, SelectionChangedEventArgs args)
        {
            if (args.AddedItems.Count == 0 ||
                args.AddedItems[0] is not BarcodeScannerInfo scannerInfo)
            {
                return;
            }

            int requestedVersion = ++selectionVersion;
            await selectionLock.WaitAsync();
            try
            {
                if (isNavigatedAway || requestedVersion != selectionVersion)
                {
                    return;
                }

                await SelectScannerAsync(scannerInfo.DeviceId);
            }
            catch (Exception ex) when (ex is UnauthorizedAccessException or COMException)
            {
                CloseScannerResources();
                rootPage.NotifyOperationError("Selecting the barcode scanner", ex);
            }
            finally
            {
                selectionLock.Release();
            }
        }

        private async Task SelectScannerAsync(string scannerDeviceId)
        {
            CloseScannerResources();

            selectedScanner = await BarcodeScanner.FromIdAsync(scannerDeviceId);
            if (selectedScanner is null)
            {
                rootPage.NotifyUser(
                    "The selected barcode scanner could not be opened.",
                    NotifyType.ErrorMessage);
                return;
            }

            claimedScanner = await selectedScanner.ClaimScannerAsync();
            if (claimedScanner is null)
            {
                rootPage.NotifyUser(
                    "The selected barcode scanner could not be claimed.",
                    NotifyType.ErrorMessage);
                CloseScannerResources();
                return;
            }

            claimedScanner.Closed += ClaimedScanner_Closed;
            claimedScanner.DataReceived += ClaimedScanner_DataReceived;
            claimedScanner.IsDecodeDataEnabled = true;
            await claimedScanner.EnableAsync();

            ScannerSupportsPreview = !string.IsNullOrEmpty(selectedScanner.VideoDeviceId);
            RaisePropertyChanged(nameof(ScannerSupportsPreview));

            IsScannerClaimed = true;
            RaisePropertyChanged(nameof(IsScannerClaimed));

            if (ScannerSupportsPreview)
            {
                await StartMediaCaptureAsync(selectedScanner.VideoDeviceId);
            }

            rootPage.NotifyUser(
                $"Scanner claimed. Device ID: {claimedScanner.DeviceId}",
                NotifyType.StatusMessage);
        }

        private async Task StartMediaCaptureAsync(string videoDeviceId)
        {
            mediaCapture = new MediaCapture();
            mediaCapture.Failed += MediaCapture_Failed;

            var settings = new MediaCaptureInitializationSettings
            {
                VideoDeviceId = videoDeviceId,
                StreamingCaptureMode = StreamingCaptureMode.Video,
                SharingMode = MediaCaptureSharingMode.SharedReadOnly,
            };

            await mediaCapture.InitializeAsync(settings);

            previewFrameSource = mediaCapture.FrameSources.Values.FirstOrDefault(source =>
                source.Info.SourceKind == MediaFrameSourceKind.Color &&
                source.Info.MediaStreamType == MediaStreamType.VideoPreview)
                ?? mediaCapture.FrameSources.Values.FirstOrDefault(source =>
                    source.Info.SourceKind == MediaFrameSourceKind.Color);

            if (previewFrameSource is null)
            {
                rootPage.NotifyUser(
                    "The scanner camera exposes no color preview stream.",
                    NotifyType.ErrorMessage);
                return;
            }

            mediaPlayer = new MediaPlayer
            {
                AutoPlay = false,
                RealTimePlayback = true,
                Source = MediaSource.CreateFromMediaFrameSource(previewFrameSource)
            };
            mediaPlayer.MediaFailed += MediaPlayer_MediaFailed;
            PreviewControl.SetMediaPlayer(mediaPlayer);
            mediaPlayer.Play();

            displayRequest.RequestActive();
            displayRequestActive = true;
            IsPreviewing = true;
            RaisePropertyChanged(nameof(IsPreviewing));
        }

        private void CloseScannerResources()
        {
            if (claimedScanner is not null)
            {
                claimedScanner.DataReceived -= ClaimedScanner_DataReceived;
                claimedScanner.Closed -= ClaimedScanner_Closed;
                claimedScanner.Dispose();
                claimedScanner = null;
            }

            selectedScanner?.Dispose();
            selectedScanner = null;

            if (mediaPlayer is not null)
            {
                mediaPlayer.MediaFailed -= MediaPlayer_MediaFailed;
                mediaPlayer.Pause();
                PreviewControl.SetMediaPlayer(null);
                mediaPlayer.Dispose();
                mediaPlayer = null;
            }

            if (mediaCapture is not null)
            {
                mediaCapture.Failed -= MediaCapture_Failed;
                mediaCapture.Dispose();
                mediaCapture = null;
            }

            previewFrameSource = null;

            if (displayRequestActive)
            {
                displayRequest.RequestRelease();
                displayRequestActive = false;
            }

            SoftwareTriggerStarted = false;
            IsPreviewing = false;
            ScannerSupportsPreview = false;
            IsScannerClaimed = false;
            RaisePropertyChanged(nameof(SoftwareTriggerStarted));
            RaisePropertyChanged(nameof(IsPreviewing));
            RaisePropertyChanged(nameof(ScannerSupportsPreview));
            RaisePropertyChanged(nameof(IsScannerClaimed));
        }

        private async void ShowPreviewButton_Click(object sender, RoutedEventArgs e)
        {
            if (claimedScanner is null)
            {
                rootPage.NotifyUser("No scanner is currently claimed.", NotifyType.ErrorMessage);
                return;
            }

            try
            {
                await claimedScanner.ShowVideoPreviewAsync();
            }
            catch (COMException ex)
            {
                rootPage.NotifyOperationError("Showing the scanner preview", ex);
            }
        }

        private void HidePreviewButton_Click(object sender, RoutedEventArgs e)
        {
            if (claimedScanner is null)
            {
                rootPage.NotifyUser("No scanner is currently claimed.", NotifyType.ErrorMessage);
                return;
            }

            try
            {
                claimedScanner.HideVideoPreview();
            }
            catch (COMException ex)
            {
                rootPage.NotifyOperationError("Hiding the scanner preview", ex);
            }
        }

        private async void StartSoftwareTriggerButton_Click(object sender, RoutedEventArgs e)
        {
            if (claimedScanner is null)
            {
                rootPage.NotifyUser("No scanner is currently claimed.", NotifyType.ErrorMessage);
                return;
            }

            try
            {
                await claimedScanner.StartSoftwareTriggerAsync();
                SoftwareTriggerStarted = true;
                RaisePropertyChanged(nameof(SoftwareTriggerStarted));
            }
            catch (COMException ex)
            {
                rootPage.NotifyOperationError("Starting the software trigger", ex);
            }
        }

        private async void StopSoftwareTriggerButton_Click(object sender, RoutedEventArgs e)
        {
            if (claimedScanner is null)
            {
                rootPage.NotifyUser("No scanner is currently claimed.", NotifyType.ErrorMessage);
                return;
            }

            try
            {
                await claimedScanner.StopSoftwareTriggerAsync();
                SoftwareTriggerStarted = false;
                RaisePropertyChanged(nameof(SoftwareTriggerStarted));
            }
            catch (COMException ex)
            {
                rootPage.NotifyOperationError("Stopping the software trigger", ex);
            }
        }

        private void FlipPreview_Click(object sender, RoutedEventArgs e)
        {
            PreviewControl.FlowDirection =
                PreviewControl.FlowDirection == FlowDirection.LeftToRight
                    ? FlowDirection.RightToLeft
                    : FlowDirection.LeftToRight;
        }

        private void ClaimedScanner_DataReceived(
            ClaimedBarcodeScanner sender,
            BarcodeScannerDataReceivedEventArgs args)
        {
            DispatcherQueue.TryEnqueue(() =>
            {
                ScenarioOutputScanDataLabel.Text =
                    DataHelpers.GetDataLabelString(args.Report.ScanDataLabel, args.Report.ScanDataType);
                ScenarioOutputScanData.Text = DataHelpers.GetDataString(args.Report.ScanData);
                ScenarioOutputScanDataType.Text = BarcodeSymbologies.GetName(args.Report.ScanDataType);
            });
        }

        private void ClaimedScanner_Closed(
            ClaimedBarcodeScanner sender,
            ClaimedBarcodeScannerClosedEventArgs args)
        {
            DispatcherQueue.TryEnqueue(() =>
            {
                CloseScannerResources();
                rootPage.NotifyUser("The scanner claim was closed.", NotifyType.ErrorMessage);
            });
        }

        private void MediaCapture_Failed(MediaCapture sender, MediaCaptureFailedEventArgs args)
        {
            DispatcherQueue.TryEnqueue(() =>
            {
                CloseScannerResources();
                rootPage.NotifyUser(
                    $"Camera preview failed: {args.Message}",
                    NotifyType.ErrorMessage);
            });
        }

        private void MediaPlayer_MediaFailed(MediaPlayer sender, MediaPlayerFailedEventArgs args)
        {
            DispatcherQueue.TryEnqueue(() =>
            {
                CloseScannerResources();
                rootPage.NotifyUser(
                    $"Preview playback failed: {args.ErrorMessage}",
                    NotifyType.ErrorMessage);
            });
        }

        private void RaisePropertyChanged(
            [CallerMemberName] string? propertyName = null)
        {
            PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
        }
    }
}
