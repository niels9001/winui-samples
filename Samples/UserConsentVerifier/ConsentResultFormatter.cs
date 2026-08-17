using Windows.Security.Credentials.UI;

namespace SDKTemplate;

internal static class ConsentResultFormatter
{
    internal static string Format(
        UserConsentVerifierAvailability availability)
    {
        return availability switch
        {
            UserConsentVerifierAvailability.Available =>
                "User verification is available.",
            UserConsentVerifierAvailability.DeviceBusy =>
                "The verification device is busy.",
            UserConsentVerifierAvailability.DeviceNotPresent =>
                "No verification device is present.",
            UserConsentVerifierAvailability.DisabledByPolicy =>
                "User verification is disabled by policy.",
            UserConsentVerifierAvailability.NotConfiguredForUser =>
                "Set up Windows Hello or a PIN for this user before requesting verification.",
            _ => "User verification is unavailable.",
        };
    }

    internal static string Format(
        UserConsentVerificationResult result)
    {
        return result switch
        {
            UserConsentVerificationResult.Verified =>
                "The current user was verified.",
            UserConsentVerificationResult.DeviceBusy =>
                "The verification device is busy.",
            UserConsentVerificationResult.DeviceNotPresent =>
                "No verification device is present.",
            UserConsentVerificationResult.DisabledByPolicy =>
                "User verification is disabled by policy.",
            UserConsentVerificationResult.NotConfiguredForUser =>
                "Set up Windows Hello or a PIN for this user before requesting verification.",
            UserConsentVerificationResult.RetriesExhausted =>
                "Too many attempts were made; verification is temporarily unavailable.",
            UserConsentVerificationResult.Canceled =>
                "User verification was canceled.",
            _ => "User verification is unavailable.",
        };
    }
}
