# ContentIndexer

Ported to WinUI 3 / Windows App SDK from the UWP
[ContentIndexer](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/ContentIndexer) sample.

## What it shows

Adding, updating, deleting, and querying app content in Windows Search in two ways: directly through `ContentIndexer`, and by writing `appcontent-ms` schema files into the app's `LocalState\Indexed` folder. The sample also tracks the index revision to detect missed operations.

## APIs featured

- `Windows.Storage.Search.ContentIndexer`
- `Windows.Storage.Search.IndexableContent` and `ValueAndLanguage`
- `Windows.Storage.SystemProperties`
- `Windows.Storage.Search.QueryOptions` and `IndexerOption.OnlyUseIndexer`
- `Windows.Storage.StorageFolder.CreateFileQuery` and `CreateFileQueryWithOptions`
- `Windows.Storage.ApplicationData.LocalSettings`

## Learn docs this serves

- [Application content schema](https://learn.microsoft.com/uwp/schemas/appcontentschema/schema-root)
- [ContentIndexer class](https://learn.microsoft.com/uwp/api/windows.storage.search.contentindexer)

## Build & run

```powershell
dotnet build -c Debug -p:Platform=x64
dotnet run -c Debug -p:Platform=x64
```

## Migration notes

- All seven scenarios from the UWP sample are present.
- The expected index revision remains persisted through `ApplicationData.Current.LocalSettings`.
- The three `appcontent-ms` fixtures are packaged as content and copied into `LocalFolder\Indexed` for indexing.
- Buttons in scenarios 2 through 7 define automation IDs, but the representative first scenario does not; its deterministic capture therefore uses visible text and performs no index mutation.
- The package declares only `runFullTrust`; no device or account capability is required.

## Known differences / limitations

Interactive indexing behavior was not reverified for this metadata update. The representative capture is limited to the untouched initial form because the source does not establish an idempotent post-add state across repeated runs.
