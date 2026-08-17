# Compression

Ported to WinUI 3 / Windows App SDK from the UWP
[Compression](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/Compression) sample.

## What it shows

Picking a file, compressing it in memory with Xpress, XpressHuff, Mszip, or Lzms through `Compressor`, and decompressing the result with `Decompressor` while reporting byte counts for each step.

## APIs featured

- `Windows.Storage.Compression.Compressor`, `Decompressor`, and `CompressAlgorithm`
- `Windows.Storage.Pickers.FileOpenPicker`
- `Windows.Storage.Streams.RandomAccessStream.CopyAsync`

## Learn docs this serves

- [Windows.Storage.Compression namespace](https://learn.microsoft.com/uwp/api/windows.storage.compression)

## Build & run

```powershell
dotnet build -c Debug -p:Platform=x64
dotnet run -c Debug -p:Platform=x64
```

## Migration notes

- The UWP `#if WINDOWS_PHONE_APP` path was removed.
- `FileOpenPicker` is associated with the desktop window through `WinRT.Interop.InitializeWithWindow`.
- This single-scenario project navigates directly to `Scenario1` without a `NavigationView`.
- The root migration table records that the project builds and launches; interactive file-picker and compression behavior was not reverified for this metadata update.
