# XmlDocument

Ported to WinUI 3 / Windows App SDK from the UWP
[XmlDocument](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/XmlDocument) sample.

## What it shows

This sample demonstrates five common uses of the Windows Runtime XML APIs:

- Load an RSS template, create a CDATA section, mutate the DOM, and serialize it.
- Select product attributes with XPath, update the DOM, and save the result.
- Compare `XmlLoadSettings.ProhibitDtd` and `ResolveExternals` when loading from a file and a buffer.
- Run XPath queries that filter employee data and read selected nodes.
- Apply an editable XSLT stylesheet, return HTML markup as a string, or save the transformed document.

## APIs featured

- `Windows.Data.Xml.Dom.XmlDocument`
- `Windows.Data.Xml.Dom.XmlLoadSettings`
- `Windows.Data.Xml.Xsl.XsltProcessor`
- `Windows.Storage.StorageFile`, `ApplicationData`, and `DataWriter`
- `Microsoft.UI.Text.TextGetOptions` and `TextSetOptions`

## Learn docs this serves

- [XmlDocument class](https://learn.microsoft.com/uwp/api/windows.data.xml.dom.xmldocument)
- [XmlLoadSettings class](https://learn.microsoft.com/uwp/api/windows.data.xml.dom.xmlloadsettings)
- [XsltProcessor class](https://learn.microsoft.com/uwp/api/windows.data.xml.xsl.xsltprocessor)

## Build & run

```powershell
dotnet build -c Debug -p:Platform=x64
dotnet run -c Debug -p:Platform=x64
```

## Migration notes

All five upstream C# scenarios and their XML, DTD, and XSLT assets are retained. The UWP shell was replaced with the repository-standard WinUI 3 `NavigationView` and `InfoBar`, and the window uses Mica plus the WinUI `TitleBar`.

`RichEditBox.Document` now uses `Microsoft.UI.Text.TextGetOptions` and `TextSetOptions`. The XSLT string result is displayed as markup in the native editor; no Trident-backed HTML or web control is used. File, malformed-XML, prohibited-DTD, and XSLT transformation failures are reported explicitly.

## Known differences / limitations

External DTD resolution is demonstrated only with the trusted DTD packaged with the sample. All meaningful upstream XML and XSLT behavior is otherwise preserved.
