using Microsoft.Windows.ApplicationModel.Resources;

namespace AppResourceClassLibrary
{
    public static class LocalizedNamesLibrary
    {
        private static readonly ResourceLoader resourceLoader = new("Resources");

        public static string LibraryName => resourceLoader.GetString("string1");
    }
}
