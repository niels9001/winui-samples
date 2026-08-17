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

using System.Collections.Generic;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Media.Imaging;
using Windows.Graphics.Imaging;
using Windows.Media.FaceAnalysis;

namespace SDKTemplate
{
    internal static class FaceVisualization
    {
        public static void HighlightFaces(
            WriteableBitmap source,
            IList<DetectedFace> faces,
            Canvas canvas,
            DataTemplate faceBoxTemplate)
        {
            canvas.Children.Clear();

            foreach (DetectedFace face in faces)
            {
                if (faceBoxTemplate.LoadContent() is FrameworkElement faceBox)
                {
                    faceBox.Tag = face.FaceBox;
                    canvas.Children.Add(faceBox);
                }
            }

            RepositionFaces(source, canvas);

            string message = faces.Count switch
            {
                0 => "No human faces were found.",
                1 => "Found one human face.",
                _ => $"Found {faces.Count} human faces.",
            };
            MainPage.Current.NotifyUser(message, NotifyType.StatusMessage);
        }

        public static void RepositionFaces(WriteableBitmap source, Canvas canvas)
        {
            if (canvas.ActualWidth <= 0 || canvas.ActualHeight <= 0)
            {
                return;
            }

            double widthScale = canvas.ActualWidth / source.PixelWidth;
            double heightScale = canvas.ActualHeight / source.PixelHeight;

            foreach (UIElement child in canvas.Children)
            {
                if (child is FrameworkElement faceBox && faceBox.Tag is BitmapBounds bounds)
                {
                    faceBox.Width = bounds.Width * widthScale;
                    faceBox.Height = bounds.Height * heightScale;
                    Canvas.SetLeft(faceBox, bounds.X * widthScale);
                    Canvas.SetTop(faceBox, bounds.Y * heightScale);
                }
            }
        }
    }
}
