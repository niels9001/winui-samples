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
using System.IO;
using System.Runtime.InteropServices;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Media;
using Microsoft.UI.Xaml.Media.Imaging;
using Microsoft.UI.Xaml.Navigation;
using Windows.Graphics.Imaging;
using Windows.Media.FaceAnalysis;
using Windows.Storage;
using Windows.Storage.Pickers;
using Windows.Storage.Streams;

namespace SDKTemplate
{
    public sealed partial class Scenario1_DetectInPhoto : Page
    {
        private const uint SourceImageHeightLimit = 1280;

        private readonly MainPage rootPage = MainPage.Current;
        private FaceDetector? faceDetector;

        public Scenario1_DetectInPhoto()
        {
            InitializeComponent();
        }

        protected override void OnNavigatedTo(NavigationEventArgs e)
        {
            base.OnNavigatedTo(e);
            rootPage.NotifyUser(
                "Open a JPEG, PNG, or BMP image to detect faces.",
                NotifyType.StatusMessage);
        }

        private async void OpenFile_Click(object sender, RoutedEventArgs e)
        {
            var picker = new FileOpenPicker
            {
                ViewMode = PickerViewMode.Thumbnail,
                SuggestedStartLocation = PickerLocationId.PicturesLibrary
            };
            picker.FileTypeFilter.Add(".jpg");
            picker.FileTypeFilter.Add(".jpeg");
            picker.FileTypeFilter.Add(".png");
            picker.FileTypeFilter.Add(".bmp");

            nint windowHandle = WinRT.Interop.WindowNative.GetWindowHandle(App.MainWindow);
            WinRT.Interop.InitializeWithWindow.Initialize(picker, windowHandle);

            StorageFile? photoFile = await picker.PickSingleFileAsync();
            if (photoFile is null)
            {
                return;
            }

            OpenFile.IsEnabled = false;
            ClearVisualization();
            rootPage.NotifyUser("Opening image...", NotifyType.StatusMessage);

            try
            {
                using IRandomAccessStream fileStream = await photoFile.OpenAsync(FileAccessMode.Read);
                BitmapDecoder decoder = await BitmapDecoder.CreateAsync(fileStream);
                BitmapTransform transform = ComputeScalingTransform(decoder);

                using SoftwareBitmap displayBitmap = await decoder.GetSoftwareBitmapAsync(
                    BitmapPixelFormat.Bgra8,
                    BitmapAlphaMode.Premultiplied,
                    transform,
                    ExifOrientationMode.RespectExifOrientation,
                    ColorManagementMode.DoNotColorManage);

                const BitmapPixelFormat detectorPixelFormat = BitmapPixelFormat.Gray8;
                if (!FaceDetector.IsBitmapPixelFormatSupported(detectorPixelFormat))
                {
                    rootPage.NotifyUser(
                        $"{detectorPixelFormat} is not supported by FaceDetector.",
                        NotifyType.ErrorMessage);
                    return;
                }

                using SoftwareBitmap detectorInput =
                    SoftwareBitmap.Convert(displayBitmap, detectorPixelFormat);

                var displaySource =
                    new WriteableBitmap(displayBitmap.PixelWidth, displayBitmap.PixelHeight);
                displayBitmap.CopyToBuffer(displaySource.PixelBuffer);

                rootPage.NotifyUser("Detecting faces...", NotifyType.StatusMessage);
                faceDetector ??= await FaceDetector.CreateAsync();
                IList<DetectedFace> faces = await faceDetector.DetectFacesAsync(detectorInput);

                PhotoCanvas.Background = new ImageBrush
                {
                    ImageSource = displaySource,
                    Stretch = Stretch.Fill
                };
                FaceVisualization.HighlightFaces(
                    displaySource,
                    faces,
                    PhotoCanvas,
                    HighlightedFaceBox);
            }
            catch (Exception ex) when (
                ex is UnauthorizedAccessException or
                COMException or
                IOException or
                ArgumentException)
            {
                ClearVisualization();
                rootPage.NotifyOperationError("Detecting faces in the image", ex);
            }
            finally
            {
                OpenFile.IsEnabled = true;
            }
        }

        private static BitmapTransform ComputeScalingTransform(BitmapDecoder decoder)
        {
            var transform = new BitmapTransform();
            if (decoder.PixelHeight <= SourceImageHeightLimit)
            {
                return transform;
            }

            double scale = (double)SourceImageHeightLimit / decoder.PixelHeight;
            transform.ScaledWidth = (uint)Math.Floor(decoder.PixelWidth * scale);
            transform.ScaledHeight = (uint)Math.Floor(decoder.PixelHeight * scale);
            return transform;
        }

        private void ClearVisualization()
        {
            PhotoCanvas.Background = null;
            PhotoCanvas.Children.Clear();
        }

        private void PhotoCanvas_SizeChanged(object sender, SizeChangedEventArgs e)
        {
            if (PhotoCanvas.Background is ImageBrush { ImageSource: WriteableBitmap bitmap })
            {
                FaceVisualization.RepositionFaces(bitmap, PhotoCanvas);
            }
        }
    }
}
