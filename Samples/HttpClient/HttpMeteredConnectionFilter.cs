using System.Runtime.InteropServices.WindowsRuntime;
using Windows.Foundation;
using Windows.Networking.Connectivity;
using Windows.Web.Http;
using Windows.Web.Http.Filters;

namespace SDKTemplate;

public enum MeteredConnectionPriority
{
    Low,
    Medium,
    High
}

public sealed class HttpMeteredConnectionFilter : IHttpFilter
{
    public const string MeteredConnectionPriorityPropertyName =
        "SDKTemplate.HttpMeteredConnectionFilter.Priority";

    private readonly IHttpFilter innerFilter;

    public HttpMeteredConnectionFilter(IHttpFilter innerFilter)
    {
        this.innerFilter = innerFilter ??
            throw new ArgumentNullException(nameof(innerFilter));
    }

    public bool OptIn { get; set; }

    public string CurrentBehavior => GetBehavior().ToString();

    public IAsyncOperationWithProgress<HttpResponseMessage, HttpProgress>
        SendRequestAsync(HttpRequestMessage request)
    {
        return AsyncInfo.Run<HttpResponseMessage, HttpProgress>(
            async (token, progress) =>
            {
                MeteredConnectionPriority priority = GetPriority(request);
                CheckPriority(priority);
                return await innerFilter.SendRequestAsync(request)
                    .AsTask(token, progress);
            });
    }

    public void Dispose()
    {
        innerFilter.Dispose();
        GC.SuppressFinalize(this);
    }

    private static MeteredConnectionPriority GetPriority(
        HttpRequestMessage request)
    {
        if (!request.Properties.TryGetValue(
                MeteredConnectionPriorityPropertyName,
                out object? value))
        {
            return MeteredConnectionPriority.Low;
        }

        return value switch
        {
            int number when Enum.IsDefined(
                typeof(MeteredConnectionPriority),
                number) => (MeteredConnectionPriority)number,
            uint number when number <= (uint)MeteredConnectionPriority.High =>
                (MeteredConnectionPriority)number,
            _ => MeteredConnectionPriority.Low
        };
    }

    private void CheckPriority(MeteredConnectionPriority priority)
    {
        MeteredConnectionBehavior behavior = GetBehavior();
        bool allowed = behavior switch
        {
            MeteredConnectionBehavior.Normal => true,
            MeteredConnectionBehavior.Conservative =>
                priority is MeteredConnectionPriority.Medium or
                    MeteredConnectionPriority.High,
            MeteredConnectionBehavior.OptIn =>
                priority == MeteredConnectionPriority.High && OptIn,
            _ => false
        };

        if (!allowed)
        {
            throw new UnauthorizedAccessException(
                $"A {priority} priority request is not allowed under the " +
                $"{behavior} connection behavior.");
        }
    }

    private static MeteredConnectionBehavior GetBehavior()
    {
        ConnectionProfile? profile =
            NetworkInformation.GetInternetConnectionProfile();
        if (profile is null)
        {
            return MeteredConnectionBehavior.None;
        }

        ConnectionCost cost = profile.GetConnectionCost();
        if (cost.Roaming)
        {
            return MeteredConnectionBehavior.OptIn;
        }

        if (cost.NetworkCostType is
            NetworkCostType.Unrestricted or NetworkCostType.Unknown)
        {
            return MeteredConnectionBehavior.Normal;
        }

        if (!cost.OverDataLimit &&
            cost.NetworkCostType is
                NetworkCostType.Fixed or NetworkCostType.Variable)
        {
            return MeteredConnectionBehavior.Conservative;
        }

        return MeteredConnectionBehavior.OptIn;
    }

    private enum MeteredConnectionBehavior
    {
        None,
        Normal,
        Conservative,
        OptIn
    }
}
