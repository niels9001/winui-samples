using System.ComponentModel;

namespace SDKTemplate.ViewModels;

public sealed class NewsSectionViewModel : INotifyPropertyChanged
{
    public HeroArticlesViewModel Articles { get; private set; } = new();

    public event PropertyChangedEventHandler? PropertyChanged;

    public void Refresh()
    {
        Articles = new HeroArticlesViewModel();
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(nameof(Articles)));
    }
}
