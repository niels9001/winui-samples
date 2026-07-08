# ApplicationResources

Ported to WinUI 3 / Windows App SDK from the UWP
[ApplicationResources](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/ApplicationResources)
sample.

## What it shows

This sample demonstrates MRT resource loading from XAML, code, package manifest entries,
localized string files, qualified image/file resources, language overrides, non-UI thread
lookups, and multi-dimensional fallback.

Scenarios ported:

1. **String Resources In XAML**
2. **File Resources In XAML**
3. **String Resources In Code**
4. **Resources in the AppX manifest**
5. **Additional Resource Files**
6. **Class Library Resources**
7. **Runtime Changes/Events**
8. **Application Languages**
9. **Override Languages**
10. **Multi-dimensional fallback**
11. **Working with webservices**
12. **Retrieving resources in non-UI threads**
13. **File resources in code**

## APIs featured

- `Microsoft.Windows.ApplicationModel.Resources.ResourceLoader`
- `Microsoft.Windows.ApplicationModel.Resources.ResourceManager`
- `Microsoft.Windows.ApplicationModel.Resources.ResourceContext`
- `Microsoft.Windows.ApplicationModel.Resources.ResourceMap`
- `Microsoft.Windows.ApplicationModel.Resources.ResourceCandidate`
- `Windows.Globalization.ApplicationLanguages`
- WinUI `x:Uid` resource binding and package manifest `ms-resource:` references

## Learn docs this serves

- [Manage resources MRT Core (Windows App SDK)](https://learn.microsoft.com/windows/apps/windows-app-sdk/mrtcore/mrtcore-overview)
- [Localize strings in your UI and app package manifest](https://learn.microsoft.com/windows/apps/windows-app-sdk/mrtcore/localize-strings)
- [ResourceLoader Class](https://learn.microsoft.com/windows/windows-app-sdk/api/winrt/microsoft.windows.applicationmodel.resources.resourceloader)
- [ResourceManager Class](https://learn.microsoft.com/windows/windows-app-sdk/api/winrt/microsoft.windows.applicationmodel.resources.resourcemanager)

## Build & run

```powershell
dotnet build -c Debug -p:Platform=x64
winapp run
```

(`dotnet run -c Debug -p:Platform=x64` also works.)

## Migration notes

- **Shell:** standard NavigationView + InfoBar shell (see repo `AGENTS.md`); Mica backdrop,
  app icon in the title bar, no page backgrounds.
- **MRT Core:** UWP `Windows.ApplicationModel.Resources.*` calls were ported to Windows App SDK
  `Microsoft.Windows.ApplicationModel.Resources.*`. Microsoft Learn documents MRT Core APIs in
  that namespace and recommends `ResourceLoader` for simple strings and `ResourceManager` /
  `ResourceContext` for advanced lookups.
- **Manifest resources:** the package display name and description use `ms-resource:` entries
  from the copied `Strings` resource files.
- **File resources:** scenario 13 resolves `Files/appdata/appdata.dat` with a `ResourceContext`
  and reads the selected candidate path, matching MRT Core's documented `Files` subtree model.

### Known differences / limitations

- `ResourceContext.QualifierValues` in Windows App SDK is exposed as `IDictionary<string,string>`,
  so the UWP `MapChanged` event pattern is not available. Scenario 7 demonstrates an explicit
  qualifier change instead.
- MRT Core exposes resolved `ResourceCandidate.QualifierValues`, but not the UWP
  `NamedResource.ResolveAll` / match metadata used by scenario 10. The port shows the resolved
  candidate and its qualifier values.
