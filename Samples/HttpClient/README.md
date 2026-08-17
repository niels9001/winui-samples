# HttpClient

Ported to WinUI 3 / Windows App SDK from the UWP
[HttpClient](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/HttpClient)
sample.

## What it shows

This sample demonstrates asynchronous GET and POST requests, streamed content and progress,
HTTP caching, cookies, composable filters, metered-connection policy, and server certificate
validation with `Windows.Web.Http.HttpClient`.

## APIs featured

- `Windows.Web.Http.HttpClient`, `HttpRequestMessage`, and `HttpResponseMessage`
- `Windows.Web.Http.IHttpContent` and the built-in HTTP content classes
- `Windows.Web.Http.Filters.IHttpFilter` and `HttpBaseProtocolFilter`
- `Windows.Web.Http.HttpCookieManager`
- `Windows.Networking.Connectivity.ConnectionCost`
- `Windows.Security.Cryptography.Certificates.Certificate`

## Learn docs this serves

- [Windows.Web.Http namespace](https://learn.microsoft.com/uwp/api/windows.web.http)
- [HttpClient class](https://learn.microsoft.com/uwp/api/windows.web.http.httpclient)
- [HttpBaseProtocolFilter class](https://learn.microsoft.com/uwp/api/windows.web.http.filters.httpbaseprotocolfilter)

## Build & run

```powershell
dotnet build -c Debug -p:Platform=x64
dotnet run -c Debug -p:Platform=x64
```

## Migration notes

The original UWP sample required an elevated IIS setup and a C++/WinRT runtime component.
This port hosts a small HTTP-only loopback test server in the full-trust sample process and
implements the plug-in, retry, and metered-connection filters in managed code. Certificate
validation still uses external HTTPS endpoints because the loopback server intentionally
does not implement TLS. The sample requires Windows 10 version 1903 or later.
