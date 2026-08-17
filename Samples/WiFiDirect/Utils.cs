using System;
using System.Threading.Tasks;
using Microsoft.UI.Dispatching;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Automation;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Input;
using Windows.Devices.Enumeration;
using Windows.Foundation;
using Windows.Networking.Sockets;

namespace SDKTemplate;

public static class Globals
{
    public static readonly byte[] CustomOui = [0xAA, 0xBB, 0xCC];

    public const byte CustomOuiType = 0xDD;

    public static readonly byte[] WfaOui = [0x50, 0x6F, 0x9A];

    public static readonly byte[] MicrosoftOui = [0x00, 0x50, 0xF2];

    public const string ServerPort = "50001";
}

public static class Utils
{
    private const int NoUnicodeTranslationHResult = unchecked((int)0x80070459);

    public static bool CanSendMessage(string? message, object? connectedDevice)
    {
        return !string.IsNullOrWhiteSpace(message) && connectedDevice is not null;
    }

    public static T GetSelectedItemTag<T>(ComboBox comboBox)
    {
        if (comboBox.SelectedItem is not FrameworkElement element)
        {
            throw new InvalidOperationException("The combo box does not have a selected item.");
        }

        if (element.Tag is null)
        {
            if (default(T) is null)
            {
                return default!;
            }

            throw new InvalidOperationException("The selected item does not have a tag.");
        }

        if (element.Tag is T value)
        {
            return value;
        }

        throw new InvalidOperationException(
            $"The selected item tag is not a {typeof(T).Name} value.");
    }

    public static bool IsNonEmptyString(string? value)
    {
        return !string.IsNullOrWhiteSpace(value);
    }

    public static bool IsNonNull(object? value)
    {
        return value is not null;
    }

    internal static async Task HandlePairingAsync(
        DispatcherQueue dispatcherQueue,
        DevicePairingRequestedEventArgs args)
    {
        using Deferral deferral = args.GetDeferral();

        switch (args.PairingKind)
        {
            case DevicePairingKinds.DisplayPin:
                await ShowPinToUserAsync(dispatcherQueue, args.Pin);
                args.Accept();
                break;

            case DevicePairingKinds.ConfirmOnly:
                args.Accept();
                break;

            case DevicePairingKinds.ProvidePin:
                string? pin = await GetPinFromUserAsync(dispatcherQueue);
                if (!string.IsNullOrWhiteSpace(pin))
                {
                    args.Accept(pin);
                }

                break;
        }
    }

    internal static bool IsExpectedSocketException(Exception exception)
    {
        return exception is ObjectDisposedException
            || SocketError.GetStatus(exception.HResult) != SocketErrorStatus.Unknown;
    }

    internal static bool IsTextDecodingException(Exception exception)
    {
        return exception.HResult == NoUnicodeTranslationHResult;
    }

    internal static Task<T> RunOnDispatcherAsync<T>(
        DispatcherQueue dispatcherQueue,
        Func<Task<T>> callback)
    {
        if (dispatcherQueue.HasThreadAccess)
        {
            return callback();
        }

        var completionSource = new TaskCompletionSource<T>(
            TaskCreationOptions.RunContinuationsAsynchronously);

        if (!dispatcherQueue.TryEnqueue(async () =>
        {
            try
            {
                completionSource.SetResult(await callback());
            }
            catch (Exception exception)
            {
                completionSource.SetException(exception);
            }
        }))
        {
            completionSource.SetException(
                new InvalidOperationException("The UI dispatcher is shutting down."));
        }

        return completionSource.Task;
    }

    private static async Task<string?> GetPinFromUserAsync(DispatcherQueue dispatcherQueue)
    {
        return await RunOnDispatcherAsync(dispatcherQueue, async () =>
        {
            var pinBox = new TextBox
            {
                InputScope = new InputScope
                {
                    Names =
                    {
                        new InputScopeName(InputScopeNameValue.NumericPin),
                    },
                },
            };
            AutomationProperties.SetName(pinBox, "PIN");

            var dialog = new ContentDialog
            {
                XamlRoot = GetDialogXamlRoot(),
                Title = "Enter PIN",
                Content = pinBox,
                PrimaryButtonText = "OK",
                CloseButtonText = "Cancel",
                DefaultButton = ContentDialogButton.Primary,
            };

            ContentDialogResult result = await dialog.ShowAsync();
            return result == ContentDialogResult.Primary ? pinBox.Text.Trim() : null;
        });
    }

    private static XamlRoot GetDialogXamlRoot()
    {
        return App.MainWindow.Content?.XamlRoot
            ?? throw new InvalidOperationException("The main window is not ready to show a dialog.");
    }

    private static async Task ShowPinToUserAsync(
        DispatcherQueue dispatcherQueue,
        string pin)
    {
        await RunOnDispatcherAsync(dispatcherQueue, async () =>
        {
            var dialog = new ContentDialog
            {
                XamlRoot = GetDialogXamlRoot(),
                Title = "Wi-Fi Direct pairing",
                Content = $"Enter this PIN on the remote device: {pin}",
                CloseButtonText = "OK",
                DefaultButton = ContentDialogButton.Close,
            };

            await dialog.ShowAsync();
            return true;
        });
    }
}
