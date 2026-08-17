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
using Windows.Devices.Enumeration;

namespace SDKTemplate
{
    public partial class DeviceHelpers
    {
        public static async Task<T?> GetFirstDeviceAsync<T>(
            string selector,
            Func<string, Task<T?>> convertAsync)
            where T : class
        {
            DeviceInformationCollection devices = await DeviceInformation.FindAllAsync(selector);
            foreach (DeviceInformation device in devices)
            {
                T? result = await convertAsync(device.Id);
                if (result is not null)
                {
                    return result;
                }
            }

            return null;
        }
    }
}
