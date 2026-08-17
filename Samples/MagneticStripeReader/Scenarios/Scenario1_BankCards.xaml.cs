using System;
using System.Collections.Generic;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Navigation;
using Windows.Devices.PointOfService;

namespace SDKTemplate;

public sealed partial class Scenario1_BankCards : Page
{
    private readonly MainPage _rootPage = MainPage.Current;
    private readonly CardField _accountNumber =
        new(Strings.Get("AccountNumberLabel"));
    private readonly CardField _expirationDate =
        new(Strings.Get("ExpirationDateLabel"));
    private readonly CardField _firstName =
        new(Strings.Get("FirstNameLabel"));
    private readonly CardField _middleInitial =
        new(Strings.Get("MiddleInitialLabel"));
    private readonly CardField _serviceCode =
        new(Strings.Get("ServiceCodeLabel"));
    private readonly CardField _suffix =
        new(Strings.Get("SuffixLabel"));
    private readonly CardField _surname =
        new(Strings.Get("SurnameLabel"));
    private readonly CardField _title =
        new(Strings.Get("TitleLabel"));
    private MagneticStripeReader? _reader;
    private ClaimedMagneticStripeReader? _claimedReader;
    private int _operationVersion;

    public Scenario1_BankCards()
    {
        CardFields =
        [
            _accountNumber,
            _expirationDate,
            _firstName,
            _middleInitial,
            _serviceCode,
            _suffix,
            _surname,
            _title,
        ];

        InitializeComponent();
    }

    public IReadOnlyList<CardField> CardFields { get; }

    protected override void OnNavigatedTo(NavigationEventArgs e)
    {
        base.OnNavigatedTo(e);
        ResetScenario();
    }

    protected override void OnNavigatedFrom(NavigationEventArgs e)
    {
        _operationVersion++;
        DisposeReader();
        base.OnNavigatedFrom(e);
    }

    private async void StartReadingButton_Click(object sender, RoutedEventArgs e)
    {
        int operationVersion = ++_operationVersion;
        StartReadingButton.IsEnabled = false;
        _rootPage.NotifyUser(
            Strings.Get("SearchingForReader"),
            NotifyType.StatusMessage);

        try
        {
            MagneticStripeReader? reader =
                await DeviceHelpers.GetFirstMagneticStripeReaderAsync();
            if (operationVersion != _operationVersion)
            {
                reader?.Dispose();
                return;
            }

            if (reader is null)
            {
                _rootPage.NotifyUser(
                    Strings.Get("ReaderNotFound"),
                    NotifyType.ErrorMessage);
                StartReadingButton.IsEnabled = true;
                return;
            }

            _reader = reader;
            ClaimedMagneticStripeReader? claimedReader =
                await reader.ClaimReaderAsync();
            if (operationVersion != _operationVersion)
            {
                claimedReader?.Dispose();
                DisposeReader();
                return;
            }

            if (claimedReader is null)
            {
                _rootPage.NotifyUser(
                    Strings.Get("ClaimReaderFailed"),
                    NotifyType.ErrorMessage);
                DisposeReader();
                StartReadingButton.IsEnabled = true;
                return;
            }

            _claimedReader = claimedReader;
            claimedReader.ReleaseDeviceRequested += ClaimedReader_ReleaseDeviceRequested;
            claimedReader.BankCardDataReceived += ClaimedReader_BankCardDataReceived;
            claimedReader.IsDecodeDataEnabled = true;

            await claimedReader.EnableAsync();

            if (operationVersion != _operationVersion)
            {
                DisposeReader();
                return;
            }

            EndReadingButton.IsEnabled = true;
            _rootPage.NotifyUser(
                Strings.Format("ReadyToSwipeFormat", claimedReader.DeviceId),
                NotifyType.StatusMessage);
        }
        catch (Exception ex)
        {
            if (operationVersion != _operationVersion)
            {
                return;
            }

            DisposeReader();
            StartReadingButton.IsEnabled = true;
            _rootPage.NotifyOperationError(Strings.Get("StartingReaderOperation"), ex);
        }
    }

    private void EndReadingButton_Click(object sender, RoutedEventArgs e)
    {
        ResetScenario();
    }

    private void ClaimedReader_ReleaseDeviceRequested(
        object? sender,
        ClaimedMagneticStripeReader requestedReader)
    {
        try
        {
            requestedReader.RetainDevice();
            _rootPage.NotifyUser(
                Strings.Get("ReaderClaimRetained"),
                NotifyType.StatusMessage);
        }
        catch (Exception ex)
        {
            _rootPage.NotifyOperationError(Strings.Get("RetainingReaderOperation"), ex);
        }
    }

    private void ClaimedReader_BankCardDataReceived(
        ClaimedMagneticStripeReader sender,
        MagneticStripeReaderBankCardDataReceivedEventArgs args)
    {
        DispatcherQueue.TryEnqueue(() =>
        {
            if (!ReferenceEquals(Frame?.Content, this))
            {
                return;
            }

            _accountNumber.Update(args.AccountNumber);
            _expirationDate.Update(args.ExpirationDate);
            _firstName.Update(args.FirstName);
            _middleInitial.Update(args.MiddleInitial);
            _serviceCode.Update(args.ServiceCode);
            _suffix.Update(args.Suffix);
            _surname.Update(args.Surname);
            _title.Update(args.Title);
            _rootPage.NotifyUser(
                Strings.Get("CardDataReceived"),
                NotifyType.StatusMessage);
        });
    }

    private void ResetScenario()
    {
        _operationVersion++;
        DisposeReader();

        foreach (CardField field in CardFields)
        {
            field.Reset();
        }

        StartReadingButton.IsEnabled = true;
        EndReadingButton.IsEnabled = false;
        _rootPage.NotifyUser(
            Strings.Get("StartReadingInstruction"),
            NotifyType.StatusMessage);
    }

    private void DisposeReader()
    {
        if (_claimedReader is not null)
        {
            _claimedReader.BankCardDataReceived -= ClaimedReader_BankCardDataReceived;
            _claimedReader.ReleaseDeviceRequested -= ClaimedReader_ReleaseDeviceRequested;
            _claimedReader.Dispose();
            _claimedReader = null;
        }

        _reader?.Dispose();
        _reader = null;
    }
}
