namespace SDKTemplate;

internal sealed record DeviceListEntry(string Id, string Name, string InstanceId)
{
    public string DisplayName => string.IsNullOrWhiteSpace(Name) ? InstanceId : Name;
}
