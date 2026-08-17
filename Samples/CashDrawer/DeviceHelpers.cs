using System.Threading.Tasks;
using Windows.Devices.Enumeration;
using Windows.Devices.PointOfService;

namespace SDKTemplate;

public static class DeviceHelpers
{
    public static async Task<CashDrawer?> GetFirstCashDrawerAsync(
        PosConnectionTypes connectionTypes = PosConnectionTypes.All)
    {
        string selector = CashDrawer.GetDeviceSelector(connectionTypes);
        DeviceInformationCollection devices = await DeviceInformation.FindAllAsync(selector);

        foreach (DeviceInformation device in devices)
        {
            CashDrawer? drawer = await CashDrawer.FromIdAsync(device.Id);
            if (drawer is not null)
            {
                return drawer;
            }
        }

        return null;
    }
}
