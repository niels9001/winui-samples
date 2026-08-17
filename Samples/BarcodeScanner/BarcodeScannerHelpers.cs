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
using System.Threading.Tasks;
using Microsoft.UI.Xaml;
using Windows.Devices.PointOfService;
using Windows.Security.Cryptography;
using Windows.Storage.Streams;

namespace SDKTemplate
{
    public partial class DeviceHelpers
    {
        public static Task<BarcodeScanner?> GetFirstBarcodeScannerAsync(
            PosConnectionTypes connectionTypes = PosConnectionTypes.All)
        {
            return GetFirstDeviceAsync(
                BarcodeScanner.GetDeviceSelector(connectionTypes),
                async id => await BarcodeScanner.FromIdAsync(id));
        }
    }

    public static class DataHelpers
    {
        public static string GetDataString(IBuffer? data)
        {
            if (data is null)
            {
                return "No data";
            }

            string result = CryptographicBuffer.EncodeToHexString(data);
            return result.Length > 40 ? $"{result[..40]}..." : result;
        }

        public static string GetDataLabelString(IBuffer? data, uint scanDataType)
        {
            if (data is null)
            {
                return "No data";
            }

            if (scanDataType == BarcodeSymbologies.Upca ||
                scanDataType == BarcodeSymbologies.UpcaAdd2 ||
                scanDataType == BarcodeSymbologies.UpcaAdd5 ||
                scanDataType == BarcodeSymbologies.Upce ||
                scanDataType == BarcodeSymbologies.UpceAdd2 ||
                scanDataType == BarcodeSymbologies.UpceAdd5 ||
                scanDataType == BarcodeSymbologies.Ean8 ||
                scanDataType == BarcodeSymbologies.TfStd ||
                scanDataType == BarcodeSymbologies.OcrA ||
                scanDataType == BarcodeSymbologies.OcrB)
            {
                return CryptographicBuffer.ConvertBinaryToString(BinaryStringEncoding.Utf8, data);
            }

            return $"Decoded data unavailable. Raw label data: {GetDataString(data)}";
        }
    }

    public static class BindingHelpers
    {
        public static bool Not(bool value) => !value;

        public static Visibility CollapsedIf(bool value) =>
            value ? Visibility.Collapsed : Visibility.Visible;
    }

    public sealed class BarcodeScannerInfo
    {
        public BarcodeScannerInfo(string deviceName, string deviceId)
        {
            DeviceName = deviceName;
            DeviceId = deviceId;
        }

        public string Name => $"{DeviceName} ({DeviceId})";
        public string DeviceId { get; }
        private string DeviceName { get; }
    }

    public sealed class SymbologyListEntry
    {
        public SymbologyListEntry(uint symbologyId, bool symbologyEnabled = true)
        {
            Id = symbologyId;
            IsEnabled = symbologyEnabled;
        }

        public uint Id { get; }
        public bool IsEnabled { get; set; }
        public string Name => BarcodeSymbologies.GetName(Id);
    }
}
