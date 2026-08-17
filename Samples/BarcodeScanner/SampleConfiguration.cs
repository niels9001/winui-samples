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

namespace SDKTemplate
{
    public partial class MainPage : Microsoft.UI.Xaml.Controls.Page
    {
        public const string FEATURE_NAME = "Barcode Scanner";

        readonly List<Scenario> scenarios = new List<Scenario>
        {
            new Scenario() { Title = "DataReceived event", ClassType = typeof(Scenario1_BasicFunctionality) },
            new Scenario() { Title = "Release and retain", ClassType = typeof(Scenario2_MultipleScanners) },
            new Scenario() { Title = "Active symbologies", ClassType = typeof(Scenario3_ActiveSymbologies) },
            new Scenario() { Title = "Symbology attributes", ClassType = typeof(Scenario4_SymbologyAttributes) },
            new Scenario() { Title = "Camera preview", ClassType = typeof(Scenario5_DisplayingBarcodePreview) },
        };
    }

    public class Scenario
    {
        public required string Title { get; init; }
        public required Type ClassType { get; init; }
    }
}
