# Syndication

Ported to WinUI 3 / Windows App SDK from the UWP
[Syndication](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/Syndication)
sample.

## What it shows

The sample retrieves RSS and Atom feeds with `SyndicationClient`, displays feed and item
metadata, navigates between returned items, opens item links, and enumerates item extension
nodes.

## APIs featured

- `Windows.Web.Syndication.SyndicationClient`
- `Windows.Web.Syndication.SyndicationFeed`
- `Windows.Web.Syndication.SyndicationItem`
- `Windows.Web.Syndication.SyndicationElementExtension`
- `Windows.Web.Syndication.SyndicationError`
- `Windows.System.Launcher`

## Learn docs this serves

- [RSS and Atom feeds](https://learn.microsoft.com/windows/uwp/networking/web-feeds)
- [SyndicationClient class](https://learn.microsoft.com/uwp/api/windows.web.syndication.syndicationclient)
- [SyndicationItem class](https://learn.microsoft.com/uwp/api/windows.web.syndication.syndicationitem)

## Build & run

```powershell
dotnet build -c Debug -p:Platform=x64
dotnet run -c Debug -p:Platform=x64
```

The default address is the Windows Developer Blog RSS feed. Replace it with any reachable
HTTP or HTTPS RSS or Atom endpoint.

## Migration notes

- The sample has one scenario, so it is hosted directly below the standard title bar without
  a NavigationView.
- The retired MSDN feed address was replaced with the current Windows Developer Blog feed,
  and the address is editable.
- The UWP `WebView` was removed because its legacy browser engine can fail fast in packaged
  Windows App SDK apps. Feed HTML is converted to readable native text with managed code
  instead.
- Syndication and web error statuses are reported through an `InfoBar`.
- Both internet and private-network client access are declared so the editable address can
  target public or intranet feeds.

## Known differences / limitations

- Item HTML is displayed as text rather than rendered as a web page. Links embedded only
  inside the item body are not interactive; the item's primary syndication link remains
  available through the dedicated link button.
- Retrieving a feed requires network access and a reachable RSS or Atom endpoint.
