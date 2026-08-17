namespace SDKTemplate;

public sealed record Scenario(string Title, Type PageType);

public sealed partial class MainPage
{
    public static IReadOnlyList<Scenario> Scenarios { get; } =
    [
        new("Add a folder", typeof(AddFolderPage)),
        new("List folders", typeof(ListFoldersPage)),
        new("Remove a folder", typeof(RemoveFolderPage))
    ];
}
