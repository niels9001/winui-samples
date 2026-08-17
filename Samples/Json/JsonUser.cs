using System.Collections.ObjectModel;
using Windows.Data.Json;

namespace SDKTemplate;

internal sealed class JsonUser
{
    public JsonUser()
    {
    }

    public JsonUser(string json)
    {
        JsonObject jsonObject = JsonObject.Parse(json);
        Id = jsonObject.GetNamedString("id", string.Empty);

        IJsonValue phoneValue = jsonObject.GetNamedValue("phone");
        Phone = phoneValue.ValueType == JsonValueType.Null
            ? null
            : phoneValue.GetString();

        Name = jsonObject.GetNamedString("name", string.Empty);
        Timezone = jsonObject.GetNamedNumber("timezone", 0);
        Verified = jsonObject.GetNamedBoolean("verified", false);

        foreach (IJsonValue value in jsonObject.GetNamedArray(
            "education",
            new JsonArray()))
        {
            Education.Add(new School(value.GetObject()));
        }
    }

    public string Id { get; set; } = string.Empty;

    public string? Phone { get; set; }

    public string Name { get; set; } = string.Empty;

    public ObservableCollection<School> Education { get; } = [];

    public double Timezone { get; set; }

    public bool Verified { get; set; }

    public string Stringify()
    {
        var jsonObject = new JsonObject
        {
            ["id"] = JsonValue.CreateStringValue(Id),
            ["phone"] = string.IsNullOrEmpty(Phone)
                ? JsonValue.CreateNullValue()
                : JsonValue.CreateStringValue(Phone),
            ["name"] = JsonValue.CreateStringValue(Name),
            ["timezone"] = JsonValue.CreateNumberValue(Timezone),
            ["verified"] = JsonValue.CreateBooleanValue(Verified)
        };

        var education = new JsonArray();
        foreach (School school in Education)
        {
            education.Add(school.ToJsonObject());
        }

        jsonObject["education"] = education;
        return jsonObject.Stringify();
    }
}
