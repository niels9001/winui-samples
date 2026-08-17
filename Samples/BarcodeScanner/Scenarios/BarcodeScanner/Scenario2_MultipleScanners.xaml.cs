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
using System.Threading.Tasks;
using Microsoft.UI;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Media;
using Microsoft.UI.Xaml.Navigation;
using Windows.Devices.PointOfService;

namespace SDKTemplate
{
    public sealed partial class Scenario2_MultipleScanners : Page
    {
        private readonly MainPage rootPage = MainPage.Current;
        private BarcodeScanner? scanner1;
        private BarcodeScanner? scanner2;
        private ClaimedBarcodeScanner? claimedScanner1;
        private ClaimedBarcodeScanner? claimedScanner2;

        private enum ScannerInstance
        {
            Instance1,
            Instance2
        }

        public Scenario2_MultipleScanners()
        {
            InitializeComponent();
        }

        protected override void OnNavigatedTo(NavigationEventArgs e)
        {
            base.OnNavigatedTo(e);
            ResetTheScenarioState();
            rootPage.NotifyUser(
                "Start either instance to see how a competing claim triggers ReleaseDeviceRequested.",
                NotifyType.StatusMessage);
        }

        protected override void OnNavigatedFrom(NavigationEventArgs e)
        {
            ResetTheScenarioState();
            base.OnNavigatedFrom(e);
        }

        private async void ButtonStartScanningInstance1_Click(object sender, RoutedEventArgs e)
        {
            await StartInstanceAsync(ScannerInstance.Instance1);
        }

        private async void ButtonStartScanningInstance2_Click(object sender, RoutedEventArgs e)
        {
            await StartInstanceAsync(ScannerInstance.Instance2);
        }

        private void ButtonEndScanningInstance1_Click(object sender, RoutedEventArgs e)
        {
            DisposeInstance(ScannerInstance.Instance1);
            UpdateUi();
        }

        private void ButtonEndScanningInstance2_Click(object sender, RoutedEventArgs e)
        {
            DisposeInstance(ScannerInstance.Instance2);
            UpdateUi();
        }

        private async Task StartInstanceAsync(ScannerInstance instance)
        {
            DisposeInstance(instance);

            try
            {
                BarcodeScanner? scanner = await DeviceHelpers.GetFirstBarcodeScannerAsync();
                if (scanner is null)
                {
                    rootPage.NotifyUser(
                        "No barcode scanner was found. Connect a scanner or enable a camera-backed scanner.",
                        NotifyType.ErrorMessage);
                    UpdateUi();
                    return;
                }

                ClaimedBarcodeScanner? claimedScanner = await scanner.ClaimScannerAsync();
                if (claimedScanner is null)
                {
                    scanner.Dispose();
                    rootPage.NotifyUser(
                        $"{GetInstanceName(instance)} could not claim the scanner.",
                        NotifyType.ErrorMessage);
                    UpdateUi();
                    return;
                }

                claimedScanner.IsDecodeDataEnabled = true;

                if (instance == ScannerInstance.Instance1)
                {
                    scanner1 = scanner;
                    claimedScanner1 = claimedScanner;
                    claimedScanner.ReleaseDeviceRequested += ClaimedScanner1_ReleaseDeviceRequested;
                    claimedScanner.DataReceived += ClaimedScanner1_DataReceived;
                }
                else
                {
                    scanner2 = scanner;
                    claimedScanner2 = claimedScanner;
                    claimedScanner.ReleaseDeviceRequested += ClaimedScanner2_ReleaseDeviceRequested;
                    claimedScanner.DataReceived += ClaimedScanner2_DataReceived;
                }

                await claimedScanner.EnableAsync();
                rootPage.NotifyUser(
                    $"{GetInstanceName(instance)} is ready. Device ID: {claimedScanner.DeviceId}",
                    NotifyType.StatusMessage);
            }
            catch (Exception ex) when (ex is UnauthorizedAccessException or COMException)
            {
                rootPage.NotifyOperationError($"Starting {GetInstanceName(instance).ToLowerInvariant()}", ex);
                DisposeInstance(instance);
            }

            UpdateUi();
        }

        private void ClaimedScanner1_ReleaseDeviceRequested(
            object? sender,
            ClaimedBarcodeScanner requestedScanner)
        {
            DispatcherQueue.TryEnqueue(() =>
                HandleReleaseRequest(ScannerInstance.Instance1, requestedScanner, Retain1.IsChecked == true));
        }

        private void ClaimedScanner2_ReleaseDeviceRequested(
            object? sender,
            ClaimedBarcodeScanner requestedScanner)
        {
            DispatcherQueue.TryEnqueue(() =>
                HandleReleaseRequest(ScannerInstance.Instance2, requestedScanner, Retain2.IsChecked == true));
        }

        private void HandleReleaseRequest(
            ScannerInstance instance,
            ClaimedBarcodeScanner requestedScanner,
            bool retain)
        {
            if (retain)
            {
                try
                {
                    requestedScanner.RetainDevice();
                    rootPage.NotifyUser(
                        $"{GetInstanceName(instance)} retained the scanner.",
                        NotifyType.StatusMessage);
                }
                catch (COMException ex)
                {
                    rootPage.NotifyOperationError(
                        $"Retaining {GetInstanceName(instance).ToLowerInvariant()}",
                        ex);
                }
            }
            else
            {
                DisposeInstance(instance);
                rootPage.NotifyUser(
                    $"{GetInstanceName(instance)} released the scanner.",
                    NotifyType.StatusMessage);
            }

            UpdateUi();
        }

        private void ClaimedScanner1_DataReceived(
            ClaimedBarcodeScanner sender,
            BarcodeScannerDataReceivedEventArgs args)
        {
            DispatcherQueue.TryEnqueue(() =>
            {
                ScanDataType1.Text = BarcodeSymbologies.GetName(args.Report.ScanDataType);
                DataLabel1.Text =
                    DataHelpers.GetDataLabelString(args.Report.ScanDataLabel, args.Report.ScanDataType);
                ScanData1.Text = DataHelpers.GetDataString(args.Report.ScanData);
                rootPage.NotifyUser("Instance 1 received scan data.", NotifyType.StatusMessage);
            });
        }

        private void ClaimedScanner2_DataReceived(
            ClaimedBarcodeScanner sender,
            BarcodeScannerDataReceivedEventArgs args)
        {
            DispatcherQueue.TryEnqueue(() =>
            {
                ScanDataType2.Text = BarcodeSymbologies.GetName(args.Report.ScanDataType);
                DataLabel2.Text =
                    DataHelpers.GetDataLabelString(args.Report.ScanDataLabel, args.Report.ScanDataType);
                ScanData2.Text = DataHelpers.GetDataString(args.Report.ScanData);
                rootPage.NotifyUser("Instance 2 received scan data.", NotifyType.StatusMessage);
            });
        }

        private void DisposeInstance(ScannerInstance instance)
        {
            if (instance == ScannerInstance.Instance1)
            {
                if (claimedScanner1 is not null)
                {
                    claimedScanner1.DataReceived -= ClaimedScanner1_DataReceived;
                    claimedScanner1.ReleaseDeviceRequested -= ClaimedScanner1_ReleaseDeviceRequested;
                    claimedScanner1.Dispose();
                    claimedScanner1 = null;
                }

                scanner1?.Dispose();
                scanner1 = null;
            }
            else
            {
                if (claimedScanner2 is not null)
                {
                    claimedScanner2.DataReceived -= ClaimedScanner2_DataReceived;
                    claimedScanner2.ReleaseDeviceRequested -= ClaimedScanner2_ReleaseDeviceRequested;
                    claimedScanner2.Dispose();
                    claimedScanner2 = null;
                }

                scanner2?.Dispose();
                scanner2 = null;
            }
        }

        private void ResetTheScenarioState()
        {
            DisposeInstance(ScannerInstance.Instance1);
            DisposeInstance(ScannerInstance.Instance2);
            UpdateUi();
        }

        private void UpdateUi()
        {
            bool instance1Active = claimedScanner1 is not null;
            bool instance2Active = claimedScanner2 is not null;

            ScenarioStartScanningInstance1.IsEnabled = !instance1Active;
            ScenarioEndScanningInstance1.IsEnabled = instance1Active;
            ScenarioStartScanningInstance2.IsEnabled = !instance2Active;
            ScenarioEndScanningInstance2.IsEnabled = instance2Active;

            Instance1Border.BorderBrush = new SolidColorBrush(
                instance1Active ? Colors.DodgerBlue : Colors.Gray);
            Instance2Border.BorderBrush = new SolidColorBrush(
                instance2Active ? Colors.DodgerBlue : Colors.Gray);

            if (!instance1Active)
            {
                ScanDataType1.Text = "No data";
                ScanData1.Text = "No data";
                DataLabel1.Text = "No data";
            }

            if (!instance2Active)
            {
                ScanDataType2.Text = "No data";
                ScanData2.Text = "No data";
                DataLabel2.Text = "No data";
            }
        }

        private static string GetInstanceName(ScannerInstance instance) =>
            instance == ScannerInstance.Instance1 ? "Instance 1" : "Instance 2";
    }
}
