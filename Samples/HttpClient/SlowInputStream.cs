using System.Runtime.InteropServices.WindowsRuntime;
using Windows.Foundation;
using Windows.Storage.Streams;

namespace SDKTemplate;

public sealed class SlowInputStream : IInputStream
{
    private readonly uint length;
    private uint position;

    public SlowInputStream(uint length)
    {
        this.length = length;
    }

    public IAsyncOperationWithProgress<IBuffer, uint> ReadAsync(
        IBuffer buffer,
        uint count,
        InputStreamOptions options)
    {
        return AsyncInfo.Run<IBuffer, uint>(
            async (token, progress) =>
            {
                uint bytesToRead = Math.Min(count, length - position);
                if (bytesToRead == 0)
                {
                    return Array.Empty<byte>().AsBuffer();
                }

                await Task.Delay(100, token);
                byte[] data = new byte[bytesToRead];
                Array.Fill(data, (byte)'@');
                position += bytesToRead;
                progress.Report(bytesToRead);
                return data.AsBuffer();
            });
    }

    public void Dispose()
    {
        GC.SuppressFinalize(this);
    }
}
