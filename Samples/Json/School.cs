using Windows.Data.Json;

namespace SDKTemplate;

internal sealed class School
{
    public School()
    {
    }

    public School(JsonObject jsonObject)
    {
        JsonObject school = jsonObject.GetNamedObject(
            "school",
            new JsonObject());
        Id = school.GetNamedString("id", string.Empty);
        Name = school.GetNamedString("name", string.Empty);
        Type = jsonObject.GetNamedString("type", string.Empty);
    }

    public string Id { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public string Type { get; set; } = string.Empty;

    public JsonObject ToJsonObject()
    {
        var school = new JsonObject
        {
            ["id"] = JsonValue.CreateStringValue(Id),
            ["name"] = JsonValue.CreateStringValue(Name)
        };

        return new JsonObject
        {
            ["school"] = school,
            ["type"] = JsonValue.CreateStringValue(Type)
        };
    }
}
