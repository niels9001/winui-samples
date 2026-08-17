using System;
using System.Collections.Generic;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Navigation;
using Windows.Devices.PointOfService;

namespace SDKTemplate;

public sealed partial class Scenario2_AamvaCards : Page
{
    private readonly MainPage _rootPage = MainPage.Current;
    private readonly CardField _address =
        new(Strings.Get("AddressLabel"));
    private readonly CardField _birthDate =
        new(Strings.Get("BirthDateLabel"));
    private readonly CardField _city =
        new(Strings.Get("CityLabel"));
    private readonly CardField _class =
        new(Strings.Get("ClassLabel"));
    private readonly CardField _endorsements =
        new(Strings.Get("EndorsementsLabel"));
    private readonly CardField _expirationDate =
        new(Strings.Get("ExpirationDateLabel"));
    private readonly CardField _eyeColor =
        new(Strings.Get("EyeColorLabel"));
    private readonly CardField _firstName =
        new(Strings.Get("FirstNameLabel"));
    private readonly CardField _gender =
        new(Strings.Get("GenderLabel"));
    private readonly CardField _hairColor =
        new(Strings.Get("HairColorLabel"));
    private readonly CardField _height =
        new(Strings.Get("HeightLabel"));
    private readonly CardField _licenseNumber =
        new(Strings.Get("LicenseNumberLabel"));
    private readonly CardField _postalCode =
        new(Strings.Get("PostalCodeLabel"));
    private readonly CardField _restrictions =
        new(Strings.Get("RestrictionsLabel"));
    private readonly CardField _state =
        new(Strings.Get("StateLabel"));
    private readonly CardField _suffix =
        new(Strings.Get("SuffixLabel"));
    private readonly CardField _surname =
        new(Strings.Get("SurnameLabel"));
    private readonly CardField _weight =
        new(Strings.Get("WeightLabel"));
    private MagneticStripeReader? _reader;
    private ClaimedMagneticStripeReader? _claimedReader;
    private int _operationVersion;

    public Scenario2_AamvaCards()
    {
        CardFields =
        [
            _address,
            _birthDate,
            _city,
            _class,
            _endorsements,
            _expirationDate,
            _eyeColor,
            _firstName,
            _gender,
            _hairColor,
            _height,
            _licenseNumber,
            _postalCode,
            _restrictions,
            _state,
            _suffix,
            _surname,
            _weight,
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
            claimedReader.AamvaCardDataReceived += ClaimedReader_AamvaCardDataReceived;
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

    private void ClaimedReader_AamvaCardDataReceived(
        ClaimedMagneticStripeReader sender,
        MagneticStripeReaderAamvaCardDataReceivedEventArgs args)
    {
        DispatcherQueue.TryEnqueue(() =>
        {
            if (!ReferenceEquals(Frame?.Content, this))
            {
                return;
            }

            _address.Update(args.Address);
            _birthDate.Update(args.BirthDate);
            _city.Update(args.City);
            _class.Update(args.Class);
            _endorsements.Update(args.Endorsements);
            _expirationDate.Update(args.ExpirationDate);
            _eyeColor.Update(args.EyeColor);
            _firstName.Update(args.FirstName);
            _gender.Update(args.Gender);
            _hairColor.Update(args.HairColor);
            _height.Update(args.Height);
            _licenseNumber.Update(args.LicenseNumber);
            _postalCode.Update(args.PostalCode);
            _restrictions.Update(args.Restrictions);
            _state.Update(args.State);
            _suffix.Update(args.Suffix);
            _surname.Update(args.Surname);
            _weight.Update(args.Weight);
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
            _claimedReader.AamvaCardDataReceived -= ClaimedReader_AamvaCardDataReceived;
            _claimedReader.ReleaseDeviceRequested -= ClaimedReader_ReleaseDeviceRequested;
            _claimedReader.Dispose();
            _claimedReader = null;
        }

        _reader?.Dispose();
        _reader = null;
    }
}
