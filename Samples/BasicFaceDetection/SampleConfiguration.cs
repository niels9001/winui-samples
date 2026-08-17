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
        public const string FEATURE_NAME = "Basic Face Detection";

        readonly List<Scenario> scenarios = new List<Scenario>
        {
            new Scenario() { Title = "Detect faces in a photo", ClassType = typeof(Scenario1_DetectInPhoto) },
            new Scenario() { Title = "Detect faces in a webcam snapshot", ClassType = typeof(Scenario2_DetectInWebcam) },
        };
    }

    public class Scenario
    {
        public required string Title { get; init; }
        public required Type ClassType { get; init; }
    }
}
