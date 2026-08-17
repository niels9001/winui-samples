using System;
using System.Threading.Tasks;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Navigation;
using Windows.Devices.Geolocation;
using Windows.Security.Authorization.AppCapabilityAccess;
using Windows.System;

namespace SDKTemplate;

public sealed partial class Scenario1_Check : Page
{
    private readonly MainPage rootPage = MainPage.Current;
    private AppCapability? locationCapability;

    public Scenario1_Check()
    {
        InitializeComponent();
    }

    protected override void OnNavigatedTo(NavigationEventArgs e)
    {
        locationCapability = AppCapability.Create("location");
        locationCapability.AccessChanged += OnCapabilityAccessChanged;
        UpdateCapabilityStatus();
    }

    protected override void OnNavigatedFrom(NavigationEventArgs e)
    {
        if (locationCapability is not null)
        {
            locationCapability.AccessChanged -= OnCapabilityAccessChanged;
            locationCapability.DisplayMessage = string.Empty;
        }
    }

    private void OnCapabilityAccessChanged(AppCapability sender, object args)
    {
        DispatcherQueue.TryEnqueue(UpdateCapabilityStatus);
    }

    private async void StreamLocationButton_Click(object sender, RoutedEventArgs e)
    {
        if (locationCapability is null)
        {
            return;
        }

        StreamLocationButton.IsEnabled = false;

        try
        {
            AppCapabilityAccessStatus status = locationCapability.CheckAccess();
            if (status == AppCapabilityAccessStatus.UserPromptRequired)
            {
                status = await locationCapability.RequestAccessAsync();
                UpdateCapabilityStatus();
            }

            if (status == AppCapabilityAccessStatus.Allowed)
            {
                await StreamLocationAsync(locationCapability);
            }
            else if (status is AppCapabilityAccessStatus.DeniedByUser
                or AppCapabilityAccessStatus.DeniedBySystem)
            {
                bool opened = await Launcher.LaunchUriAsync(
                    new Uri("ms-settings:privacy-location"));
                if (!opened)
                {
                    rootPage.NotifyUser(
                        "Location access is denied and the Privacy settings page could not be opened.",
                        NotifyType.ErrorMessage);
                }
            }
            else
            {
                rootPage.NotifyUser(
                    $"Location access is unavailable ({status}).",
                    NotifyType.ErrorMessage);
            }
        }
        catch (Exception ex)
        {
            rootPage.NotifyOperationError("Streaming location", ex);
        }
        finally
        {
            StreamLocationButton.IsEnabled = true;
        }
    }

    private async Task StreamLocationAsync(AppCapability capability)
    {
        GeolocationAccessStatus geolocationStatus = await Geolocator.RequestAccessAsync();
        if (geolocationStatus != GeolocationAccessStatus.Allowed)
        {
            UpdateCapabilityStatus();
            rootPage.NotifyUser(
                $"The geolocation API did not grant access ({geolocationStatus}).",
                NotifyType.ErrorMessage);
            return;
        }

        try
        {
            capability.DisplayMessage = "Streaming location";
            var geolocator = new Geolocator
            {
                DesiredAccuracyInMeters = 100
            };

            for (int index = 0; index < 4; index++)
            {
                LocationTextBlock.Text = "Finding your current location...";
                Geoposition position = await geolocator.GetGeopositionAsync(
                    TimeSpan.FromMinutes(5),
                    TimeSpan.FromSeconds(10));

                LocationTextBlock.Text =
                    $"Latitude {position.Coordinate.Point.Position.Latitude:F6}, " +
                    $"longitude {position.Coordinate.Point.Position.Longitude:F6}";

                await Task.Delay(500);
                capability.DisplayMessage = "Tracking your current location";
            }

            rootPage.NotifyUser(
                "Location streaming completed.",
                NotifyType.StatusMessage);
        }
        catch (Exception ex) when (ex.HResult == unchecked((int)0x80070005))
        {
            rootPage.NotifyUser(
                "Location access was revoked while the operation was running.",
                NotifyType.ErrorMessage);
            UpdateCapabilityStatus();
        }
        finally
        {
            capability.DisplayMessage = string.Empty;
        }
    }

    private void UpdateCapabilityStatus()
    {
        if (locationCapability is null)
        {
            return;
        }

        AppCapabilityAccessStatus status = locationCapability.CheckAccess();
        LocationAccessBlock.Text = status switch
        {
            AppCapabilityAccessStatus.Allowed => "Location access is allowed.",
            AppCapabilityAccessStatus.NotDeclaredByApp =>
                "The app did not declare the location capability.",
            AppCapabilityAccessStatus.DeniedBySystem =>
                "The system has blocked access to location.",
            AppCapabilityAccessStatus.DeniedByUser =>
                "Location access is disabled in Settings.",
            AppCapabilityAccessStatus.UserPromptRequired =>
                "Windows will ask for location access when streaming starts.",
            _ => $"Location access status: {status}."
        };
    }
}
