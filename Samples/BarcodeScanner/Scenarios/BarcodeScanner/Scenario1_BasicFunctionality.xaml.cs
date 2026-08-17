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
using System.Runtime.InteropServices;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Navigation;
using Windows.Devices.PointOfService;

namespace SDKTemplate
{
    public sealed partial class Scenario1_BasicFunctionality : Page
    {
        private readonly MainPage rootPage = MainPage.Current;
        private BarcodeScanner? scanner;
        private ClaimedBarcodeScanner? claimedScanner;

        public Scenario1_BasicFunctionality()
        {
            InitializeComponent();
        }

        protected override void OnNavigatedTo(NavigationEventArgs e)
        {
            base.OnNavigatedTo(e);
            ResetTheScenarioState();
        }

        protected override void OnNavigatedFrom(NavigationEventArgs e)
        {
            ResetTheScenarioState();
            base.OnNavigatedFrom(e);
        }

        private async void ScenarioStartScanButton_Click(object sender, RoutedEventArgs e)
        {
            ScenarioStartScanButton.IsEnabled = false;
            rootPage.NotifyUser("Acquiring a barcode scanner.", NotifyType.StatusMessage);

            try
            {
                scanner = await DeviceHelpers.GetFirstBarcodeScannerAsync();
                if (scanner is null)
                {
                    rootPage.NotifyUser(
                        "No barcode scanner was found. Connect a scanner or enable a camera-backed scanner.",
                        NotifyType.ErrorMessage);
                    ScenarioStartScanButton.IsEnabled = true;
                    return;
                }

                claimedScanner = await scanner.ClaimScannerAsync();
                if (claimedScanner is null)
                {
                    rootPage.NotifyUser("The barcode scanner could not be claimed.", NotifyType.ErrorMessage);
                    ResetTheScenarioState();
                    return;
                }

                claimedScanner.ReleaseDeviceRequested += ClaimedScanner_ReleaseDeviceRequested;
                claimedScanner.DataReceived += ClaimedScanner_DataReceived;
                claimedScanner.IsDecodeDataEnabled = true;
                await claimedScanner.EnableAsync();

                rootPage.NotifyUser(
                    $"Ready to scan. Device ID: {claimedScanner.DeviceId}",
                    NotifyType.StatusMessage);
                ScenarioEndScanButton.IsEnabled = true;

                if (!string.IsNullOrEmpty(scanner.VideoDeviceId))
                {
                    ScenarioSoftwareTriggerPanel.Visibility = Visibility.Visible;
                    ScenarioStartTriggerButton.IsEnabled = true;
                    ScenarioStopTriggerButton.IsEnabled = false;
                }
            }
            catch (Exception ex) when (ex is UnauthorizedAccessException or COMException)
            {
                rootPage.NotifyOperationError("Starting the barcode scanner", ex);
                ResetTheScenarioState();
            }
        }

        private void ClaimedScanner_ReleaseDeviceRequested(object? sender, ClaimedBarcodeScanner requestedScanner)
        {
            try
            {
                requestedScanner.RetainDevice();
                rootPage.NotifyUser(
                    "ReleaseDeviceRequested received; the scanner claim was retained.",
                    NotifyType.StatusMessage);
            }
            catch (COMException ex)
            {
                rootPage.NotifyOperationError("Retaining the barcode scanner", ex);
            }
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

        private void ResetTheScenarioState()
        {
            if (claimedScanner is not null)
            {
                claimedScanner.DataReceived -= ClaimedScanner_DataReceived;
                claimedScanner.ReleaseDeviceRequested -= ClaimedScanner_ReleaseDeviceRequested;
                claimedScanner.Dispose();
                claimedScanner = null;
            }

            scanner?.Dispose();
            scanner = null;

            if (ReferenceEquals(Frame?.Content, this))
            {
                rootPage.NotifyUser(
                    "Click Start Scanning to acquire the first available scanner.",
                    NotifyType.StatusMessage);
                ScenarioOutputScanData.Text = "No data";
                ScenarioOutputScanDataLabel.Text = "No data";
                ScenarioOutputScanDataType.Text = "No data";
                ScenarioEndScanButton.IsEnabled = false;
                ScenarioStartScanButton.IsEnabled = true;
                ScenarioSoftwareTriggerPanel.Visibility = Visibility.Collapsed;
            }
        }

        private void ScenarioEndScanButton_Click(object sender, RoutedEventArgs e)
        {
            ResetTheScenarioState();
        }

        private async void ScenarioStartTriggerButton_Click(object sender, RoutedEventArgs e)
        {
            if (claimedScanner is null)
            {
                rootPage.NotifyUser("No scanner is currently claimed.", NotifyType.ErrorMessage);
                return;
            }

            try
            {
                ScenarioStartTriggerButton.IsEnabled = false;
                await claimedScanner.StartSoftwareTriggerAsync();
                ScenarioStopTriggerButton.IsEnabled = true;
            }
            catch (COMException ex)
            {
                rootPage.NotifyOperationError("Starting the software trigger", ex);
                ScenarioStartTriggerButton.IsEnabled = true;
            }
        }

        private async void ScenarioStopTriggerButton_Click(object sender, RoutedEventArgs e)
        {
            if (claimedScanner is null)
            {
                rootPage.NotifyUser("No scanner is currently claimed.", NotifyType.ErrorMessage);
                return;
            }

            try
            {
                ScenarioStopTriggerButton.IsEnabled = false;
                await claimedScanner.StopSoftwareTriggerAsync();
                ScenarioStartTriggerButton.IsEnabled = true;
            }
            catch (COMException ex)
            {
                rootPage.NotifyOperationError("Stopping the software trigger", ex);
                ScenarioStopTriggerButton.IsEnabled = true;
            }
        }
    }
}
