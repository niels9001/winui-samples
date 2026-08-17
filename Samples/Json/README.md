# JSON

Ported to WinUI 3 / Windows App SDK from the UWP
[Json](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/Json)
sample.

## What it shows

This sample parses JSON into editable .NET objects and serializes those objects back to
JSON. It demonstrates JSON objects, arrays, strings, numbers, booleans, and null values.

## APIs featured

- `Windows.Data.Json.JsonObject`
- `Windows.Data.Json.JsonArray`
- `Windows.Data.Json.JsonValue`
- `Windows.Data.Json.JsonError`

## Learn docs this serves

- [Windows.Data.Json namespace](https://learn.microsoft.com/uwp/api/windows.data.json)
- [JsonObject class](https://learn.microsoft.com/uwp/api/windows.data.json.jsonobject)

## Build & run

```powershell
dotnet build -c Debug -p:Platform=x64
dotnet run -c Debug -p:Platform=x64
```

## Migration notes

The sample navigates directly to its only scenario instead of showing a one-item navigation
menu. The Windows Runtime JSON APIs work unchanged in a packaged WinUI 3 app. For new
.NET-only code, `System.Text.Json` is also a common alternative.
