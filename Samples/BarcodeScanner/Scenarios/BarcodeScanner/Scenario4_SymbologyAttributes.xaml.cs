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
    public sealed partial class Scenario4_SymbologyAttributes : Page
    {
        private readonly MainPage rootPage = MainPage.Current;
        private readonly ObservableCollection<SymbologyListEntry> symbologies = new();
        private BarcodeScanner? scanner;
        private ClaimedBarcodeScanner? claimedScanner;
        private BarcodeSymbologyAttributes? symbologyAttributes;

        public Scenario4_SymbologyAttributes()
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
            symbologyAttributes = null;
            symbologies.Clear();

            if (ReferenceEquals(Frame?.Content, this))
            {
                rootPage.NotifyUser("Click Start Scanning to begin.", NotifyType.StatusMessage);
                ScenarioOutputScanData.Text = "No data";
                ScenarioOutputScanDataLabel.Text = "No data";
                ScenarioOutputScanDataType.Text = "No data";
                ScenarioEndScanButton.IsEnabled = false;
                ScenarioStartScanButton.IsEnabled = true;
                SetSymbologyAttributesButton.IsEnabled = false;
                EnableCheckDigit.IsEnabled = false;
                TransmitCheckDigit.IsEnabled = false;
                SetDecodeRangeLimits.IsEnabled = false;
            }
        }

        private void ScenarioEndScanButton_Click(object sender, RoutedEventArgs e)
        {
            ResetTheScenarioState();
        }

        private async void SymbologySelection_Changed(object sender, SelectionChangedEventArgs args)
        {
            if (claimedScanner is null ||
                SymbologyListBox.SelectedItem is not SymbologyListEntry selectedSymbology)
            {
                return;
            }

            SetSymbologyAttributesButton.IsEnabled = false;

            try
            {
                symbologyAttributes =
                    await claimedScanner.GetSymbologyAttributesAsync(selectedSymbology.Id);
            }
            catch (COMException ex)
            {
                symbologyAttributes = null;
                rootPage.NotifyOperationError("Reading symbology attributes", ex);
            }

            if (symbologyAttributes is null)
            {
                rootPage.NotifyUser("Symbology attributes are not available.", NotifyType.ErrorMessage);
                EnableCheckDigit.IsEnabled = false;
                TransmitCheckDigit.IsEnabled = false;
                SetDecodeRangeLimits.IsEnabled = false;
                return;
            }

            SetSymbologyAttributesButton.IsEnabled = true;
            EnableCheckDigit.IsEnabled = symbologyAttributes.IsCheckDigitValidationSupported;
            EnableCheckDigit.IsChecked = symbologyAttributes.IsCheckDigitValidationEnabled;
            TransmitCheckDigit.IsEnabled = symbologyAttributes.IsCheckDigitTransmissionSupported;
            TransmitCheckDigit.IsChecked = symbologyAttributes.IsCheckDigitTransmissionEnabled;
            SetDecodeRangeLimits.IsEnabled = symbologyAttributes.IsDecodeLengthSupported;

            bool rangeEnabled =
                symbologyAttributes.DecodeLengthKind == BarcodeSymbologyDecodeLengthKind.Range;
            SetDecodeRangeLimits.IsChecked = rangeEnabled;
            if (rangeEnabled)
            {
                MinimumDecodeLength.Value =
                    Math.Min(symbologyAttributes.DecodeLength1, symbologyAttributes.DecodeLength2);
                MaximumDecodeLength.Value =
                    Math.Max(symbologyAttributes.DecodeLength1, symbologyAttributes.DecodeLength2);
            }
        }

        private async void SetSymbologyAttributes_Click(object sender, RoutedEventArgs e)
        {
            if (claimedScanner is null ||
                symbologyAttributes is null ||
                SymbologyListBox.SelectedItem is not SymbologyListEntry selectedSymbology)
            {
                rootPage.NotifyUser("Select a symbology first.", NotifyType.ErrorMessage);
                return;
            }

            symbologyAttributes.IsCheckDigitValidationEnabled =
                symbologyAttributes.IsCheckDigitValidationSupported &&
                EnableCheckDigit.IsChecked == true;
            symbologyAttributes.IsCheckDigitTransmissionEnabled =
                symbologyAttributes.IsCheckDigitTransmissionSupported &&
                TransmitCheckDigit.IsChecked == true;

            if (symbologyAttributes.IsDecodeLengthSupported &&
                SetDecodeRangeLimits.IsChecked == true)
            {
                if (MinimumDecodeLength.Value > MaximumDecodeLength.Value)
                {
                    rootPage.NotifyUser(
                        "Minimum decode length cannot exceed the maximum.",
                        NotifyType.ErrorMessage);
                    return;
                }

                symbologyAttributes.DecodeLengthKind = BarcodeSymbologyDecodeLengthKind.Range;
                symbologyAttributes.DecodeLength1 = (uint)MinimumDecodeLength.Value;
                symbologyAttributes.DecodeLength2 = (uint)MaximumDecodeLength.Value;
            }
            else if (symbologyAttributes.IsDecodeLengthSupported)
            {
                symbologyAttributes.DecodeLengthKind = BarcodeSymbologyDecodeLengthKind.AnyLength;
            }

            try
            {
                bool attributesSet = await claimedScanner.SetSymbologyAttributesAsync(
                    selectedSymbology.Id,
                    symbologyAttributes);
                rootPage.NotifyUser(
                    attributesSet
                        ? $"Attributes set for {selectedSymbology.Name}."
                        : $"Attributes could not be set for {selectedSymbology.Name}.",
                    attributesSet ? NotifyType.StatusMessage : NotifyType.ErrorMessage);
            }
            catch (COMException ex)
            {
                rootPage.NotifyOperationError("Setting symbology attributes", ex);
            }
        }
    }
}
