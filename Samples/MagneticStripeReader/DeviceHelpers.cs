using System.Threading.Tasks;
using Windows.Devices.Enumeration;
using Windows.Devices.PointOfService;

namespace SDKTemplate;

internal static class DeviceHelpers
{
    internal static async Task<MagneticStripeReader?> GetFirstMagneticStripeReaderAsync(
        PosConnectionTypes connectionTypes = PosConnectionTypes.All)
    {
        string selector = MagneticStripeReader.GetDeviceSelector(connectionTypes);
        DeviceInformationCollection devices = await DeviceInformation.FindAllAsync(selector);

        foreach (DeviceInformation device in devices)
        {
            MagneticStripeReader? reader =
                await MagneticStripeReader.FromIdAsync(device.Id);
            if (reader is not null)
            {
                return reader;
            }
        }

        return null;
    }
}
