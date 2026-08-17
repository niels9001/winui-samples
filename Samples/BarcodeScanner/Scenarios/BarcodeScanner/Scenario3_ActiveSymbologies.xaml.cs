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
using System.Collections.ObjectModel;
using System.Runtime.InteropServices;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Navigation;
using Windows.Devices.PointOfService;

namespace SDKTemplate
{
    public sealed partial class Scenario3_ActiveSymbologies : Page
    {
        private readonly MainPage rootPage = MainPage.Current;
        private readonly ObservableCollection<SymbologyListEntry> symbologies = new();
        private BarcodeScanner? scanner;
        private ClaimedBarcodeScanner? claimedScanner;

        public Scenario3_ActiveSymbologies()
        {
            InitializeComponent();
            SymbologyListSource.Source = symbologies;
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
                    rootPage.NotifyUser("No barcode scanner was found.", NotifyType.ErrorMessage);
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

                IReadOnlyList<uint> supported = await scanner.GetSupportedSymbologiesAsync();
                foreach (uint symbology in supported)
                {
                    symbologies.Add(new SymbologyListEntry(symbology));
                }

                ScenarioEndScanButton.IsEnabled = true;
                SetActiveSymbologiesButton.IsEnabled = true;
                rootPage.NotifyUser(
                    $"Ready to scan. Device ID: {claimedScanner.DeviceId}",
                    NotifyType.StatusMessage);
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
            symbologies.Clear();

            if (ReferenceEquals(Frame?.Content, this))
            {
                rootPage.NotifyUser("Click Start Scanning to begin.", NotifyType.StatusMessage);
                ScenarioOutputScanData.Text = "No data";
                ScenarioOutputScanDataLabel.Text = "No data";
                ScenarioOutputScanDataType.Text = "No data";
                SetActiveSymbologiesButton.IsEnabled = false;
                ScenarioEndScanButton.IsEnabled = false;
                ScenarioStartScanButton.IsEnabled = true;
            }
        }

        private void ScenarioEndScanButton_Click(object sender, RoutedEventArgs e)
        {
            ResetTheScenarioState();
        }

        private async void SetActiveSymbologies_Click(object sender, RoutedEventArgs e)
        {
            if (claimedScanner is null)
            {
                rootPage.NotifyUser("No scanner is currently claimed.", NotifyType.ErrorMessage);
                return;
            }

            var activeSymbologies = new List<uint>();
            foreach (SymbologyListEntry symbology in symbologies)
            {
                if (symbology.IsEnabled)
                {
                    activeSymbologies.Add(symbology.Id);
                }
            }

            try
            {
                await claimedScanner.SetActiveSymbologiesAsync(activeSymbologies);
                rootPage.NotifyUser("Active symbologies updated.", NotifyType.StatusMessage);
            }
            catch (COMException ex)
            {
                rootPage.NotifyOperationError("Updating active symbologies", ex);
            }
        }
    }
}
