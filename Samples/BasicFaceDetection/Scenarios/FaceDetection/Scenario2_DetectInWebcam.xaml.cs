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
using System.Collections.Generic;
using System.Linq;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Media;
using Microsoft.UI.Xaml.Media.Imaging;
using Microsoft.UI.Xaml.Navigation;
using Windows.Devices.Enumeration;
using Windows.Graphics.Imaging;
using Windows.Media;
using Windows.Media.Capture;
using Windows.Media.Capture.Frames;
using Windows.Media.Core;
using Windows.Media.FaceAnalysis;
using Windows.Media.MediaProperties;
using Windows.Media.Playback;
using Windows.System.Display;
using DevicePanel = Windows.Devices.Enumeration.Panel;

namespace SDKTemplate
{
    public sealed partial class Scenario2_DetectInWebcam : Page
    {
        private readonly MainPage rootPage = MainPage.Current;
        private readonly SemaphoreSlim stateLock = new(1, 1);
        private readonly DisplayRequest displayRequest = new();

        private ScenarioState currentState;
        private MediaCapture? mediaCapture;
        private MediaPlayer? previewPlayer;
        private MediaFrameReader? frameReader;
        private FaceDetector? faceDetector;
        private bool displayRequestActive;

        private enum ScenarioState
        {
            Idle,
            Streaming,
            Snapshot
        }

        public Scenario2_DetectInWebcam()
        {
            InitializeComponent();
        }

        protected override void OnNavigatedTo(NavigationEventArgs e)
        {
            base.OnNavigatedTo(e);
            rootPage.NotifyUser(
                "Start the camera stream, then take one snapshot for face detection.",
                NotifyType.StatusMessage);
        }

        protected override async void OnNavigatingFrom(NavigatingCancelEventArgs e)
        {
            await TransitionToStateAsync(ScenarioState.Idle);
            base.OnNavigatingFrom(e);
        }

        private async Task<bool> StartWebcamStreamingAsync()
        {
            try
            {
                DeviceInformationCollection cameras =
                    await DeviceInformation.FindAllAsync(DeviceClass.VideoCapture);
                DeviceInformation? camera = cameras.FirstOrDefault(
                    device => device.EnclosureLocation?.Panel == DevicePanel.Front)
                    ?? cameras.FirstOrDefault();

                if (camera is null)
                {
                    rootPage.NotifyUser("No camera was found.", NotifyType.ErrorMessage);
                    return false;
                }

                faceDetector ??= await FaceDetector.CreateAsync();
                mediaCapture = new MediaCapture();
                mediaCapture.Failed += MediaCapture_Failed;

                var settings = new MediaCaptureInitializationSettings
                {
                    VideoDeviceId = camera.Id,
                    StreamingCaptureMode = StreamingCaptureMode.Video,
                    SharingMode = MediaCaptureSharingMode.ExclusiveControl,
                    MemoryPreference = MediaCaptureMemoryPreference.Cpu
                };
                await mediaCapture.InitializeAsync(settings);

                MediaFrameSource? frameSource = FindPreviewFrameSource(mediaCapture);
                if (frameSource is null)
                {
                    rootPage.NotifyUser(
                        "The camera exposes no color preview stream.",
                        NotifyType.ErrorMessage);
                    await ShutdownWebcamAsync();
                    return false;
                }

                frameReader = await mediaCapture.CreateFrameReaderAsync(
                    frameSource,
                    MediaEncodingSubtypes.Bgra8);
                frameReader.AcquisitionMode = MediaFrameReaderAcquisitionMode.Realtime;

                MediaFrameReaderStartStatus readerStatus = await frameReader.StartAsync();
                if (readerStatus != MediaFrameReaderStartStatus.Success)
                {
                    rootPage.NotifyUser(
                        $"The camera frame reader could not start ({readerStatus}).",
                        NotifyType.ErrorMessage);
                    await ShutdownWebcamAsync();
                    return false;
                }

                CamPreview.FlowDirection =
                    camera.EnclosureLocation?.Panel == DevicePanel.Front
                        ? FlowDirection.RightToLeft
                        : FlowDirection.LeftToRight;

                previewPlayer = new MediaPlayer
                {
                    AutoPlay = false,
                    RealTimePlayback = true,
                    Source = MediaSource.CreateFromMediaFrameSource(frameSource)
                };
                previewPlayer.MediaFailed += PreviewPlayer_MediaFailed;
                CamPreview.SetMediaPlayer(previewPlayer);
                previewPlayer.Play();

                displayRequest.RequestActive();
                displayRequestActive = true;

                return true;
            }
            catch (UnauthorizedAccessException ex)
            {
                rootPage.NotifyUser(
                    $"Camera access was denied (0x{ex.HResult:X8}). Enable webcam access in Windows privacy settings.",
                    NotifyType.ErrorMessage);
            }
            catch (Exception ex) when (ex is COMException or InvalidOperationException)
            {
                rootPage.NotifyOperationError("Starting the webcam", ex);
            }

            await ShutdownWebcamAsync();
            return false;
        }

        private async Task ShutdownWebcamAsync()
        {
            if (frameReader is not null)
            {
                try
                {
                    await frameReader.StopAsync();
                }
                catch (Exception ex) when (ex is COMException or InvalidOperationException)
                {
                    rootPage.NotifyOperationError("Stopping the webcam frame reader", ex);
                }

                frameReader.Dispose();
                frameReader = null;
            }

            if (previewPlayer is not null)
            {
                previewPlayer.MediaFailed -= PreviewPlayer_MediaFailed;
                previewPlayer.Pause();
                CamPreview.SetMediaPlayer(null);
                previewPlayer.Dispose();
                previewPlayer = null;
            }

            if (mediaCapture is not null)
            {
                mediaCapture.Failed -= MediaCapture_Failed;
                mediaCapture.Dispose();
                mediaCapture = null;
            }

            if (displayRequestActive)
            {
                displayRequest.RequestRelease();
                displayRequestActive = false;
            }

        }

        private async Task<bool> TakeSnapshotAndFindFacesAsync()
        {
            if (            currentState != ScenarioState.Streaming ||
            faceDetector is null ||
            frameReader is null)
            {
            return false;
            }

            try
            {
            using MediaFrameReference? frame = frameReader.TryAcquireLatestFrame();
            SoftwareBitmap? capturedBitmap = frame?.VideoMediaFrame?.SoftwareBitmap;
            if (capturedBitmap is null)
            {
                rootPage.NotifyUser(
                    "No camera frame is available yet. Keep the preview running and try again.",
                    NotifyType.ErrorMessage);
                return false;
                }

                const BitmapPixelFormat detectorPixelFormat = BitmapPixelFormat.Gray8;
                if (!FaceDetector.IsBitmapPixelFormatSupported(detectorPixelFormat))
                {
                    rootPage.NotifyUser(
                        $"{detectorPixelFormat} is not supported by FaceDetector.",
                        NotifyType.ErrorMessage);
                    return false;
                }

                using SoftwareBitmap detectorInput =
                    SoftwareBitmap.Convert(capturedBitmap, detectorPixelFormat);
                IList<DetectedFace> faces =
                    await faceDetector.DetectFacesAsync(detectorInput);

                using SoftwareBitmap displayBitmap = SoftwareBitmap.Convert(
                    capturedBitmap,
                    BitmapPixelFormat.Bgra8,
                    BitmapAlphaMode.Premultiplied);
                var displaySource =
                    new WriteableBitmap(displayBitmap.PixelWidth, displayBitmap.PixelHeight);
                displayBitmap.CopyToBuffer(displaySource.PixelBuffer);

                SnapshotCanvas.Background = new ImageBrush
                {
                    ImageSource = displaySource,
                    Stretch = Stretch.Fill
                };
                FaceVisualization.HighlightFaces(
                    displaySource,
                    faces,
                    SnapshotCanvas,
                    HighlightedFaceBox);

                return true;
            }
            catch (Exception ex) when (
                ex is COMException or
                InvalidOperationException or
                ArgumentException)
            {
                rootPage.NotifyOperationError("Detecting faces in the webcam snapshot", ex);
                return false;
            }
        }

        private async Task TransitionToStateAsync(ScenarioState newState)
        {
            await stateLock.WaitAsync();
            CameraStreamingButton.IsEnabled = false;
            CameraSnapshotButton.IsEnabled = false;

            try
            {
                switch (newState)
                {
                    case ScenarioState.Idle:
                        await ShutdownWebcamAsync();
                        SnapshotCanvas.Background = null;
                        SnapshotCanvas.Children.Clear();
                        CameraStreamingButton.Content = "Start Streaming";
                        CameraSnapshotButton.Content = "Take Snapshot";
                        currentState = ScenarioState.Idle;
                        break;

                    case ScenarioState.Streaming:
                        await ShutdownWebcamAsync();
                        SnapshotCanvas.Background = null;
                        SnapshotCanvas.Children.Clear();

                        if (await StartWebcamStreamingAsync())
                        {
                            CameraStreamingButton.Content = "Stop Streaming";
                            CameraSnapshotButton.Content = "Take Snapshot";
                            currentState = ScenarioState.Streaming;
                            rootPage.NotifyUser(
                                "Camera streaming. Take a snapshot to detect faces.",
                                NotifyType.StatusMessage);
                        }
                        else
                        {
                            CameraStreamingButton.Content = "Start Streaming";
                            currentState = ScenarioState.Idle;
                        }
                        break;

                    case ScenarioState.Snapshot:
                        if (await TakeSnapshotAndFindFacesAsync())
                        {
                            await ShutdownWebcamAsync();
                            CameraStreamingButton.Content = "Start Streaming";
                            CameraSnapshotButton.Content = "Clear Display";
                            currentState = ScenarioState.Snapshot;
                        }
                        else
                        {
                            await ShutdownWebcamAsync();
                            CameraStreamingButton.Content = "Start Streaming";
                            CameraSnapshotButton.Content = "Take Snapshot";
                            currentState = ScenarioState.Idle;
                        }
                        break;
                }
            }
            finally
            {
                CameraStreamingButton.IsEnabled = true;
                CameraSnapshotButton.IsEnabled =
                    currentState is ScenarioState.Streaming or ScenarioState.Snapshot;
                stateLock.Release();
            }
        }

        private async void CameraStreamingButton_Click(object sender, RoutedEventArgs e)
        {
            rootPage.NotifyUser(string.Empty, NotifyType.StatusMessage);
            await TransitionToStateAsync(
                currentState == ScenarioState.Streaming
                    ? ScenarioState.Idle
                    : ScenarioState.Streaming);
        }

        private async void CameraSnapshotButton_Click(object sender, RoutedEventArgs e)
        {
            rootPage.NotifyUser(string.Empty, NotifyType.StatusMessage);
            await TransitionToStateAsync(
                currentState == ScenarioState.Streaming
                    ? ScenarioState.Snapshot
                    : ScenarioState.Idle);
        }

        private void MediaCapture_Failed(MediaCapture sender, MediaCaptureFailedEventArgs args)
        {
            DispatcherQueue.TryEnqueue(async () =>
            {
                rootPage.NotifyUser(
                    $"Camera capture failed: {args.Message}",
                    NotifyType.ErrorMessage);
                await TransitionToStateAsync(ScenarioState.Idle);
            });
        }

        private void PreviewPlayer_MediaFailed(MediaPlayer sender, MediaPlayerFailedEventArgs args)
        {
            DispatcherQueue.TryEnqueue(async () =>
            {
                rootPage.NotifyUser(
                    $"Camera preview failed: {args.ErrorMessage}",
                    NotifyType.ErrorMessage);
                await TransitionToStateAsync(ScenarioState.Idle);
            });
        }

        private void SnapshotCanvas_SizeChanged(object sender, SizeChangedEventArgs e)
        {
            if (SnapshotCanvas.Background is ImageBrush { ImageSource: WriteableBitmap bitmap })
            {
                FaceVisualization.RepositionFaces(bitmap, SnapshotCanvas);
            }
        }

        private static MediaFrameSource? FindPreviewFrameSource(MediaCapture capture)
        {
            return capture.FrameSources.Values.FirstOrDefault(source =>
                source.Info.SourceKind == MediaFrameSourceKind.Color &&
                source.Info.MediaStreamType == MediaStreamType.VideoPreview)
                ?? capture.FrameSources.Values.FirstOrDefault(source =>
                    source.Info.SourceKind == MediaFrameSourceKind.Color);
        }
    }
}
