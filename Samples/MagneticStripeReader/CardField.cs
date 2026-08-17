using System.ComponentModel;
using System.Runtime.CompilerServices;

namespace SDKTemplate;

public sealed class CardField : INotifyPropertyChanged
{
    private string _value = Strings.Get("NoData");

    internal CardField(string label)
    {
        Label = label;
    }

    public event PropertyChangedEventHandler? PropertyChanged;

    public string Label { get; }

    public string Value
    {
        get => _value;
        private set
        {
            if (_value == value)
            {
                return;
            }

            _value = value;
            PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(nameof(Value)));
        }
    }

    internal void Update(string? value)
    {
        Value = string.IsNullOrEmpty(value) ? Strings.Get("NoData") : value;
    }

    internal void Reset()
    {
        Value = Strings.Get("NoData");
    }
}
