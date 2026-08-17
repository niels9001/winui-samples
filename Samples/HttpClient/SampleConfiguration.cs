namespace SDKTemplate;

public sealed record HttpScenario(
    string Title,
    HttpScenarioKind Kind,
    Type PageType);

public enum HttpScenarioKind
{
    GetText,
    GetStream,
    GetList,
    PostText,
    PostStream,
    PostMultipart,
    PostStreamWithProgress,
    PostCustomContent,
    GetCookies,
    SetCookie,
    DeleteCookie,
    DisableCookies,
    RetryFilter,
    MeteredConnectionFilter,
    ServerCertificateValidation
}

public sealed partial class MainPage
{
    public const string FeatureName = "HttpClient sample";

    public static IReadOnlyList<HttpScenario> Scenarios { get; } =
    [
        new("GET text with cache control", HttpScenarioKind.GetText, typeof(RequestScenarioPage)),
        new("GET stream", HttpScenarioKind.GetStream, typeof(RequestScenarioPage)),
        new("GET XML list", HttpScenarioKind.GetList, typeof(RequestScenarioPage)),
        new("POST text", HttpScenarioKind.PostText, typeof(RequestScenarioPage)),
        new("POST stream", HttpScenarioKind.PostStream, typeof(RequestScenarioPage)),
        new("POST multipart form", HttpScenarioKind.PostMultipart, typeof(RequestScenarioPage)),
        new("POST stream with progress", HttpScenarioKind.PostStreamWithProgress, typeof(RequestScenarioPage)),
        new("POST custom content", HttpScenarioKind.PostCustomContent, typeof(RequestScenarioPage)),
        new("Get cookies", HttpScenarioKind.GetCookies, typeof(CookieManagerPage)),
        new("Set cookie", HttpScenarioKind.SetCookie, typeof(CookieManagerPage)),
        new("Delete cookie", HttpScenarioKind.DeleteCookie, typeof(CookieManagerPage)),
        new("Disable cookies", HttpScenarioKind.DisableCookies, typeof(CookieBehaviorPage)),
        new("Retry filter", HttpScenarioKind.RetryFilter, typeof(RequestScenarioPage)),
        new("Metered connection filter", HttpScenarioKind.MeteredConnectionFilter, typeof(RequestScenarioPage)),
        new("Server certificate validation", HttpScenarioKind.ServerCertificateValidation, typeof(CertificateValidationPage))
    ];
}
