# XmlDocument

Ported to WinUI 3 / Windows App SDK from the UWP
[XmlDocument](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/XmlDocument)
sample.

## What it shows

The sample covers five XML workflows:

1. Build an RSS document from a template with elements, attributes, text, and CDATA.
2. Load a product document, select nodes with XPath, update them, and save the DOM.
3. Compare DTD and external-resource behavior with `XmlLoadSettings`.
4. Query employee records with XPath and derive gift assignments.
5. Transform editable XML with an XSL stylesheet and display or save the result.

All inputs are packaged with the sample. Saved output is written to the app's local
storage.

## APIs featured

- `Windows.Data.Xml.Dom.XmlDocument`
- `Windows.Data.Xml.Dom.XmlLoadSettings`
- `Windows.Data.Xml.Xsl.XsltProcessor`
- `Microsoft.UI.Text.TextGetOptions` and `TextSetOptions`
- `Windows.Storage.StorageFile` and `ApplicationData`

## Learn docs this serves

- [XmlDocument class](https://learn.microsoft.com/en-us/uwp/api/windows.data.xml.dom.xmldocument?view=winrt-28000)
- [XmlLoadSettings class](https://learn.microsoft.com/en-us/uwp/api/windows.data.xml.dom.xmlloadsettings?view=winrt-28000)
- [XsltProcessor class](https://learn.microsoft.com/en-us/uwp/api/windows.data.xml.xsl.xsltprocessor?view=winrt-28000)
- [TextGetOptions enumeration](https://learn.microsoft.com/windows/windows-app-sdk/api/winrt/microsoft.ui.text.textgetoptions)
- [TextSetOptions enumeration](https://learn.microsoft.com/windows/windows-app-sdk/api/winrt/microsoft.ui.text.textsetoptions)

## Build & run

```powershell
dotnet build -c Debug -p:Platform=x64
dotnet run -c Debug -p:Platform=x64
```

## Migration notes

The UWP shell was replaced with the repository's WinUI 3 `NavigationView` and
`InfoBar` shell, with a Mica backdrop and app title bar. Rich text document access
uses `Microsoft.UI.Text`.

The XSLT scenario displays transformed HTML as markup in a native text editor. It
does not instantiate `WebView`, `WebView2`, or another Trident-backed renderer.
External DTD resolution is demonstrated only with the trusted DTD packaged in the
app.

## Known differences / limitations

Transformed HTML is shown as source text rather than rendered web content. The DTD
scenario intentionally does not resolve arbitrary network resources.
