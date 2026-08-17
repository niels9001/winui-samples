# Personalization

Ported to WinUI 3 / Windows App SDK from the UWP
[Personalization](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/Personalization)
sample.

## What it shows

This sample picks a local JPEG, PNG, or BMP, sets it as the current user's lock screen
image, and reads the active lock screen stream back into a WinUI image preview.

## Scenario

**Pick and set a lock screen image** - Open a desktop file picker, apply the selected
file with `LockScreen.SetImageFileAsync`, retrieve it with
`LockScreen.GetImageStream`, and display the result.

## APIs featured

- `Windows.System.UserProfile.LockScreen`
- `Windows.Storage.Pickers.FileOpenPicker`
- `Windows.Storage.Streams.IRandomAccessStream`
- `Microsoft.UI.Xaml.Media.Imaging.BitmapImage`

## Requirements

- A local JPEG, PNG, or BMP file is required.
- Windows must accept the lock screen update for the current user. The sample calls
  the API directly and does not preflight policy restrictions.

## Learn docs this serves

- [LockScreen API reference](https://learn.microsoft.com/uwp/api/windows.system.userprofile.lockscreen)
- [FileOpenPicker API reference](https://learn.microsoft.com/uwp/api/windows.storage.pickers.fileopenpicker)

## Build & run

```powershell
dotnet build -c Debug -p:Platform=x64
dotnet run -c Debug -p:Platform=x64
```

## Migration notes

The UWP picker flow is retained, but the `FileOpenPicker` must be initialized with
the WinUI window handle before it is shown.

## Known differences / limitations

- File selection and the Windows lock screen update require manual interaction.
- The sample does not add policy-specific eligibility checks or recovery beyond its
  existing error path.
- Successful behavior under managed lock screen policies has not been claimed.
