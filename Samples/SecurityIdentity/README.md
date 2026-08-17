# SecurityIdentity

This WinUI 3 / Windows App SDK project consolidates the UWP
[UserInfo](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/UserInfo),
[KeyCredentialManager](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/KeyCredentialManager),
and
[PersonalDataEncryption](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/PersonalDataEncryption)
samples.

## What it shows

The sample brings together user discovery, local Windows Hello key credentials, and
personal data protection. The three feature groups contain six scenarios.

## Scenarios

### User info

1. **Find users** - Enumerate visible Windows users and retrieve selected profile
   properties.
2. **Watch users** - Track user additions, updates, removals, and enumeration
   completion with `UserWatcher`.
3. **Check user consent group** - Evaluate child, minor, and adult age-consent groups
   for a selected user.

### Key credential manager

4. **Windows Hello sign-in** - Check local key support, create or open a credential,
   retrieve its public key and optional attestation, and request a signed challenge.
   The server-registration methods are placeholders that complete after a short local
   delay; this sample does not implement an external authentication service.

### Personal data encryption

5. **Files and folders** - Pick a storage item and set its availability to after
   first unlock, while unlocked, or always available.
6. **Memory** - Protect a UTF-8 buffer at a selected availability level and unprotect
   it when the user's data is available.

## APIs featured

- `Windows.System.User`
- `Windows.System.UserWatcher`
- `Windows.Security.Credentials.KeyCredentialManager`
- `Windows.Security.Credentials.KeyCredential`
- `Windows.Security.DataProtection.UserDataProtectionManager`
- `Windows.Security.DataProtection.UserDataAvailability`
- `Windows.Security.Cryptography.CryptographicBuffer`

## Requirements

- The package declares `userAccountInformation`; the properties returned by
  `User` can still be empty or unavailable for a given account.
- The Windows Hello page's own availability guidance expects a connected Microsoft
  account and a Windows PIN. Windows chooses the configured gesture, and key
  attestation is optional.
- The Personal Data Encryption pages enable their controls only when
  `UserDataProtectionManager.TryGetDefault()` returns a manager for the current user.
- The manifest allows build 17763, but `UserDataProtectionManager` is available
  starting with Windows build 18362. The Personal Data Encryption pages therefore
  require 18362 or later.
- File protection uses a manually operated, window-associated picker.

## Learn docs this serves

- [User API reference](https://learn.microsoft.com/uwp/api/windows.system.user)
- [UserWatcher API reference](https://learn.microsoft.com/uwp/api/windows.system.userwatcher)
- [KeyCredentialManager API reference](https://learn.microsoft.com/uwp/api/windows.security.credentials.keycredentialmanager)
- [UserDataProtectionManager API reference](https://learn.microsoft.com/uwp/api/windows.security.dataprotection.userdataprotectionmanager)

## Build & run

```powershell
dotnet build -c Debug -p:Platform=x64
dotnet run -c Debug -p:Platform=x64
```

## Migration notes

The three related UWP samples share the standard NavigationView and InfoBar shell.
The file picker is initialized with the WinUI window handle. Windows Hello remains a
local `KeyCredentialManager` demonstration; legacy Microsoft Passport names remain
inside inherited implementation comments and UI text.

## Known differences / limitations

- The Windows Hello workflow does not provide a real server registration or
  challenge-verification backend.
- The code does not guard its Personal Data Encryption types on Windows builds older
  than 18362 even though the package manifest permits installation there.
- `internetClient` remains declared in the package even though the audited scenarios
  do not implement an external network request.
- User lists, profile properties, age-consent results, key support, attestation, and
  Personal Data Encryption availability all depend on the current Windows
  configuration. Successful identity or PDE validation is not claimed where those
  prerequisites are absent.
