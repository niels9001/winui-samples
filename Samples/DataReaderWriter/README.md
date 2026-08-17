# DataReaderWriter

Ported to WinUI 3 / Windows App SDK from the UWP
[DataReaderWriter](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/DataReaderWriter)
sample.

## What it shows

This sample demonstrates two stream-reading patterns:

1. **Read and write simple structured data** writes length-prefixed UTF-8 strings to an
   `InMemoryRandomAccessStream`, then reads the values back with matching byte order and
   encoding.
2. **Dump file contents using ReadBytes()** opens a packaged image as a sequential stream,
   reads it in chunks, and formats the bytes as a hexadecimal dump.

## APIs featured

- `Windows.Storage.Streams.DataReader`
- `Windows.Storage.Streams.DataWriter`
- `Windows.Storage.Streams.InMemoryRandomAccessStream`
- `Windows.Storage.StorageFile.GetFileFromApplicationUriAsync`
- `Windows.Storage.StorageFile.OpenSequentialReadAsync`

## Learn docs this serves

- [DataReader class](https://learn.microsoft.com/uwp/api/windows.storage.streams.datareader)
- [DataWriter class](https://learn.microsoft.com/uwp/api/windows.storage.streams.datawriter)
- [InMemoryRandomAccessStream class](https://learn.microsoft.com/uwp/api/windows.storage.streams.inmemoryrandomaccessstream)

## Requirements

The sample requires Windows 10 version 1809 (10.0.17763.0) or later. It uses only memory
and an image packaged with the app, so it does not require external files, hardware,
network access, or account services.

## Build & run

```powershell
dotnet build -c Debug -p:Platform=x64
dotnet run -c Debug -p:Platform=x64
```

## Migration notes

`DataReader`, `DataWriter`, and the storage stream APIs work unchanged in a packaged WinUI
3 app. The UWP shell was replaced with the shared `NavigationView` and `InfoBar` shell, and
the scenario pages use WinUI 3 styles without explicit page backgrounds.

## Known differences / limitations

None. Both original scenarios are present.
