# UserConsentVerifier

Ported to WinUI 3 / Windows App SDK from the UWP
[UserConsentVerifier](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/UserConsentVerifier)
sample.

## What it shows

The sample retains both upstream scenarios:

1. Check whether Windows Hello, a PIN, fingerprint, or another verification device is
   available for the current user.
2. Request user verification with a Windows-owned prompt associated with the WinUI window.

## APIs featured

- `Windows.Security.Credentials.UI.UserConsentVerifier`
- `Windows.Security.Credentials.UI.UserConsentVerifierInterop`
- `UserConsentVerifierInterop.RequestVerificationForWindowAsync`
- `WinRT.Interop.WindowNative.GetWindowHandle`

## Learn docs this serves

- [UserConsentVerifier class](https://learn.microsoft.com/uwp/api/windows.security.credentials.ui.userconsentverifier)
- [IUserConsentVerifierInterop interface](https://learn.microsoft.com/windows/win32/api/userconsentverifierinterop/nn-userconsentverifierinterop-iuserconsentverifierinterop)
- [Call interop APIs from a .NET app](https://learn.microsoft.com/windows/apps/desktop/modernize/winrt-com-interop-csharp)

## Build & run

```powershell
dotnet build -c Debug -p:Platform=x64
dotnet run -c Debug -p:Platform=x64
```

## Migration notes

- `UserConsentVerifier.CheckAvailabilityAsync` remains usable for the availability check.
- The UWP-only `RequestVerificationAsync` call was replaced by
  `UserConsentVerifierInterop.RequestVerificationForWindowAsync`, initialized with the main
  WinUI window HWND.
- All availability and verification results are surfaced in the scenario and shell
  `InfoBar`.
- The project and package minimum version are Windows 11 build 22000 because that is the
  minimum supported version for `IUserConsentVerifierInterop`.

## Known differences / limitations

- A Windows Hello, PIN, fingerprint, or compatible verifier must be configured to display and
  complete the interactive prompt. Without one, both scenarios report `DeviceNotPresent`.
- Verification confirms the signed-in user for a sample action; the sample does not authorize
  a real purchase or expose credential data to the app.
