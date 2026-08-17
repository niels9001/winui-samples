#requires -Version 7.0

[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$repositoryRoot = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
$modulePath = Join-Path $repositoryRoot 'tools\screenshots\ScreenshotHarness.psm1'
$boundsProject = Join-Path $repositoryRoot 'tools\screenshots\WindowBounds\WindowBounds.csproj'
$boundsDll = Join-Path $repositoryRoot 'tools\screenshots\WindowBounds\bin\Release\net10.0-windows10.0.17763.0\WindowBounds.dll'
$temporaryRoot = Join-Path ([System.IO.Path]::GetTempPath()) "winui-screenshot-tests-$([Guid]::NewGuid().ToString('N'))"
$failures = [System.Collections.Generic.List[string]]::new()
$passed = 0

Import-Module $modulePath -Force
[System.IO.Directory]::CreateDirectory($temporaryRoot) | Out-Null

function Assert-True {
    param(
        [Parameter(Mandatory)]
        [bool] $Condition,

        [Parameter(Mandatory)]
        [string] $Message
    )

    if (-not $Condition) {
        throw $Message
    }
}

function Assert-Equal {
    param(
        [Parameter()]
        [AllowNull()]
        [object] $Expected,

        [Parameter()]
        [AllowNull()]
        [object] $Actual,

        [Parameter(Mandatory)]
        [string] $Message
    )

    if ($Expected -ne $Actual) {
        throw "$Message Expected '$Expected', got '$Actual'."
    }
}

function Assert-Throws {
    param(
        [Parameter(Mandatory)]
        [scriptblock] $Body,

        [Parameter(Mandatory)]
        [string] $MessagePattern,

        [Parameter(Mandatory)]
        [string] $Message
    )

    $caught = $null
    try {
        & $Body
    }
    catch {
        $caught = $_
    }
    if ($null -eq $caught) {
        throw "$Message Expected an exception."
    }
    if ($caught.Exception.Message -notmatch $MessagePattern) {
        throw "$Message Unexpected exception: $($caught.Exception.Message)"
    }
}

function Test-Case {
    param(
        [Parameter(Mandatory)]
        [string] $Name,

        [Parameter(Mandatory)]
        [scriptblock] $Body
    )

    try {
        & $Body
        $script:passed++
        Write-Host "PASS $Name"
    }
    catch {
        $script:failures.Add("$Name`: $($_.Exception.Message)")
        Write-Host "FAIL $Name"
    }
}

try {
    Test-Case 'discovers v1 capture metadata' {
        $planPath = Join-Path $temporaryRoot 'capture-plan.json'
        $plan = Get-ScreenshotCapturePlan -RepositoryRoot $repositoryRoot -OutputPath $planPath
        $fileAccess = @(Select-CaptureSamples -Plan $plan -Sample 'FileAccess')
        Assert-Equal 1 $fileAccess.Count 'FileAccess should resolve once.'
        Assert-Equal 'file-access' $fileAccess[0].id 'Stable sample ID should be preserved.'
        Assert-Equal 'create-file' $fileAccess[0].screenshots[0].id 'Authored screenshot order should be preserved.'
        Assert-Equal 'automatic' $fileAccess[0].screenshots[0].capture.mode 'Capture mode should be preserved.'
    }

    Test-Case 'constructs deterministic commands' {
        $identity = [pscustomobject]@{
            ProjectPath = 'C:\repo\Samples\FileAccess\FileAccess.csproj'
        }
        $build = New-SampleBuildCommand -Identity $identity
        Assert-Equal 'dotnet' $build.FilePath 'Build executable should be dotnet.'
        Assert-True ($build.Arguments -contains '-p:Platform=x64') 'Build should force x64.'
        Assert-True ($build.Arguments -contains 'Debug') 'Build should use Debug configuration.'

        $run = New-WinAppRunCommand `
            -InputFolder 'C:\out' `
            -ManifestPath 'C:\out\AppxManifest.xml' `
            -PackageOutputPath 'C:\work\appx'
        Assert-True ($run.Arguments -contains '--unregister-on-exit') 'Run should request package cleanup.'
        Assert-True ($run.Arguments -contains '--json') 'Run should request JSON.'

        $wait = New-WinAppUiCommand `
            -Operation wait-for `
            -Selector 'text=Creating a file' `
            -WindowHandle 1234 `
            -TimeoutMilliseconds 5000
        Assert-Equal 'Creating a file' $wait.Arguments[2] 'Schema text selectors should normalize for WinApp UI.'
        Assert-True ($wait.Arguments -contains '1234') 'UI command should target the validated HWND.'

        $input = New-WinAppUiCommand `
            -Operation set-value `
            -Selector 'AutomationId=RepresentativeInput' `
            -Value 'sample value' `
            -WindowHandle 1234
        Assert-Equal 'RepresentativeInput' $input.Arguments[2] 'Automation ID selectors should normalize for search or direct targeting.'
        Assert-True ($input.Arguments -contains 'sample value') 'Input command should preserve the authored value.'

        $click = New-WinAppUiCommand `
            -Operation click `
            -Selector 'name=Run sample' `
            -WindowHandle 1234
        Assert-Equal 'Run sample' $click.Arguments[2] 'Name selectors should normalize consistently.'

        $parsedSelector = & (Get-Module ScreenshotHarness) {
            ConvertFrom-CaptureSelector -Selector 'AutomationId=RepresentativeAction'
        }
        Assert-Equal 'automationid' $parsedSelector.Kind 'Selector parser should retain the property kind.'
        Assert-Equal 'RepresentativeAction' $parsedSelector.Value 'Selector parser should retain the property value.'

        $automaticDeviceSample = [pscustomobject]@{
            requirements = [pscustomobject]@{
                supportedArchitectures = @('x64')
                hardware = @('Optional test device')
                accountServices = @()
            }
        }
        $automaticRecipe = [pscustomobject]@{
            capture = [pscustomobject]@{ mode = 'automatic' }
        }
        $skipReason = & (Get-Module ScreenshotHarness) {
            param($Sample, $Screenshot)
            Get-CaptureSkipReason -Sample $Sample -Screenshot $Screenshot
        } $automaticDeviceSample $automaticRecipe
        Assert-True ($null -eq $skipReason) 'Authored automatic mode should remain authoritative for safe no-device states.'

        $dryIdentity = [pscustomobject]@{
            ProjectPath = 'C:\repo\Samples\Deferred\Deferred.csproj'
            ExpectedProcessName = 'Deferred'
        }
        $dryScreenshot = [pscustomobject]@{
            capture = [pscustomobject]@{
                readinessSelector = 'text=Send'
                actions = @(
                    [pscustomobject]@{
                        type = 'click'
                        selector = 'text=Adaptive Deferral'
                    }
                )
            }
        }
        $dryCommands = @(& (Get-Module ScreenshotHarness) {
            param($Identity, $Screenshot)
            Get-DryRunCommands `
                -Identity $Identity `
                -Screenshot $Screenshot `
                -PackageOutputPath 'C:\work\appx' `
                -WindowX 40 `
                -WindowY 40 `
                -WindowWidth 1440 `
                -WindowHeight 900 `
                -TimeoutSeconds 60 `
                -StabilityMilliseconds 1200 `
                -ForceScreenCapture $false
        } $dryIdentity $dryScreenshot)
        $actionIndex = -1
        $readinessIndex = -1
        for ($index = 0; $index -lt $dryCommands.Count; $index++) {
            if ($dryCommands[$index] -match 'ui invoke.*Adaptive Deferral') {
                $actionIndex = $index
            }
            if ($dryCommands[$index] -match 'ui wait-for Send') {
                $readinessIndex = $index
            }
        }
        Assert-True ($actionIndex -ge 0) 'Dry-run should include the authored action.'
        Assert-True ($readinessIndex -gt $actionIndex) 'Final readiness should be checked after actions.'
    }

    Test-Case 'rejects an invalid HWND without launching a GUI app' {
        & dotnet build $boundsProject -c Release --nologo | Out-Null
        Assert-Equal 0 $LASTEXITCODE 'Bounds helper should build.'

        $process = [System.Diagnostics.Process]::new()
        $process.StartInfo.FileName = 'dotnet'
        $process.StartInfo.UseShellExecute = $false
        $process.StartInfo.RedirectStandardError = $true
        foreach ($argument in @(
            $boundsDll,
            'set-bounds',
            '--hwnd', '0',
            '--process-id', ([Environment]::ProcessId.ToString()),
            '--x', '0',
            '--y', '0',
            '--width', '800',
            '--height', '600'
        )) {
            $process.StartInfo.ArgumentList.Add($argument)
        }
        [void]$process.Start()
        $stderr = $process.StandardError.ReadToEnd()
        $process.WaitForExit()
        Assert-Equal 2 $process.ExitCode 'Invalid HWND should be an argument error.'
        Assert-True ($stderr -match 'must not be zero') 'Invalid HWND diagnostic should be explicit.'
    }

    Test-Case 'generates deterministic collision-safe capture identities' {
        $identity = & (Get-Module ScreenshotHarness) {
            New-CapturePackageIdentity `
                -SampleId 'file-access' `
                -ScreenshotId 'create-file' `
                -RunId 'test-run'
        }
        $sameIdentity = & (Get-Module ScreenshotHarness) {
            New-CapturePackageIdentity `
                -SampleId 'file-access' `
                -ScreenshotId 'create-file' `
                -RunId 'test-run'
        }
        $otherIdentity = & (Get-Module ScreenshotHarness) {
            New-CapturePackageIdentity `
                -SampleId 'file-access' `
                -ScreenshotId 'other-shot' `
                -RunId 'test-run'
        }

        Assert-Equal $identity $sameIdentity 'The same authored capture and run should produce the same identity.'
        Assert-True ($identity -match '^WinUISamples\.Capture\.[0-9a-f]{24}$') 'Capture identity should contain only package-safe deterministic data.'
        Assert-True ($identity.Length -le 50) 'Capture identity should fit the package identity length limit.'
        Assert-True ($identity -ne $otherIdentity) 'Different authored captures should not share an identity.'
        Assert-Throws -MessagePattern 'already registered' -Message 'Identity collisions must be rejected.' -Body {
            & (Get-Module ScreenshotHarness) {
                param($UnavailableIdentity)
                New-CapturePackageIdentity `
                    -SampleId 'file-access' `
                    -ScreenshotId 'create-file' `
                    -RunId 'test-run' `
                    -UnavailableIdentityNames @($UnavailableIdentity)
            } $identity
        }
    }

    Test-Case 'stages and transforms only an owned package manifest' {
        $fixtureRoot = Join-Path $temporaryRoot 'identity-staging'
        $sourceRoot = Join-Path $fixtureRoot 'source'
        $ownedRoot = Join-Path $fixtureRoot 'run-work'
        $stagingRoot = Join-Path $ownedRoot 'staged'
        [System.IO.Directory]::CreateDirectory($sourceRoot) | Out-Null
        [System.IO.Directory]::CreateDirectory($ownedRoot) | Out-Null

        $sourceManifest = Join-Path $sourceRoot 'AppxManifest.xml'
        $sourcePayload = Join-Path $sourceRoot 'Sample.exe'
        $sourcePri = Join-Path $sourceRoot 'resources.pri'
        $recipePath = Join-Path $sourceRoot 'Sample.build.appxrecipe'
        $phoneProductId = '01234567-89AB-CDEF-0123-456789ABCDEF'
        [System.IO.File]::WriteAllText(
            $sourceManifest,
            "<?xml version=`"1.0`" encoding=`"utf-8`"?><Package xmlns=`"http://schemas.microsoft.com/appx/manifest/foundation/windows10`" xmlns:mp=`"http://schemas.microsoft.com/appx/2014/phone/manifest`"><Identity Name=`"Original.Package`" Publisher=`"CN=Test`" Version=`"1.0.0.0`" ProcessorArchitecture=`"x64`" /><mp:PhoneIdentity PhoneProductId=`"$phoneProductId`" PhonePublisherId=`"00000000-0000-0000-0000-000000000000`" /></Package>")
        [System.IO.File]::WriteAllText($sourcePayload, 'payload')
        [System.IO.File]::WriteAllText($sourcePri, 'source-pri')
        [System.IO.File]::WriteAllText(
            $recipePath,
            "<?xml version=`"1.0`" encoding=`"utf-8`"?><Project xmlns=`"http://schemas.microsoft.com/developer/msbuild/2003`"><ItemGroup><AppXManifest Include=`"$sourceManifest`"><PackagePath>AppxManifest.xml</PackagePath></AppXManifest><AppxPackagedFile Include=`"$sourcePayload`"><PackagePath>Sample.exe</PackagePath></AppxPackagedFile><AppxPackagedFile Include=`"$sourcePri`"><PackagePath>resources.pri</PackagePath></AppxPackagedFile></ItemGroup></Project>")

        $manifestHashBefore = (Get-FileHash -LiteralPath $sourceManifest -Algorithm SHA256).Hash
        $priHashBefore = (Get-FileHash -LiteralPath $sourcePri -Algorithm SHA256).Hash
        $layout = & (Get-Module ScreenshotHarness) {
            param($RecipePath, $StagingRoot, $OwnedRoot)
            Copy-PackageRecipeLayout `
                -RecipePath $RecipePath `
                -StagingRoot $StagingRoot `
                -OwnedRoot $OwnedRoot
        } $recipePath $stagingRoot $ownedRoot
        & (Get-Module ScreenshotHarness) {
            param($ManifestPath, $OwnedRoot)
            Set-StagedPackageIdentity `
                -ManifestPath $ManifestPath `
                -OwnedRoot $OwnedRoot `
                -ExpectedSourceIdentityName 'Original.Package' `
                -CaptureIdentityName 'WinUISamples.Capture.0123456789abcdef01234567'
        } $layout.StagedManifestPath $ownedRoot | Out-Null

        Assert-Equal $manifestHashBefore (Get-FileHash -LiteralPath $sourceManifest -Algorithm SHA256).Hash 'Source manifest must remain immutable.'
        Assert-Equal $priHashBefore (Get-FileHash -LiteralPath $sourcePri -Algorithm SHA256).Hash 'Source PRI must remain immutable.'
        Assert-True (Test-Path -LiteralPath (Join-Path $stagingRoot 'Sample.exe')) 'Recipe payload should be copied into staging.'
        Assert-True (-not (Test-Path -LiteralPath (Join-Path $stagingRoot 'resources.pri'))) 'Identity-bound source PRI should not be copied.'

        [xml] $sourceXml = Get-Content -LiteralPath $sourceManifest -Raw
        [xml] $stagedXml = Get-Content -LiteralPath $layout.StagedManifestPath -Raw
        $sourceIdentity = $sourceXml.SelectSingleNode("/*[local-name()='Package']/*[local-name()='Identity']")
        $stagedIdentity = $stagedXml.SelectSingleNode("/*[local-name()='Package']/*[local-name()='Identity']")
        $stagedPhoneIdentity = $stagedXml.SelectSingleNode("/*[local-name()='Package']/*[local-name()='PhoneIdentity']")
        Assert-Equal 'Original.Package' $sourceIdentity.GetAttribute('Name') 'Source identity should remain unchanged.'
        Assert-Equal 'WinUISamples.Capture.0123456789abcdef01234567' $stagedIdentity.GetAttribute('Name') 'Only staged package identity should change.'
        Assert-Equal $phoneProductId $stagedPhoneIdentity.GetAttribute('PhoneProductId') 'Unrelated staged identity fields should remain unchanged.'

        $escapeStagingRoot = Join-Path $ownedRoot 'escape-staged'
        $escapeRecipePath = Join-Path $sourceRoot 'Escape.build.appxrecipe'
        [System.IO.File]::WriteAllText(
            $escapeRecipePath,
            "<?xml version=`"1.0`" encoding=`"utf-8`"?><Project xmlns=`"http://schemas.microsoft.com/developer/msbuild/2003`"><ItemGroup><AppXManifest Include=`"$sourceManifest`"><PackagePath>AppxManifest.xml</PackagePath></AppXManifest><AppxPackagedFile Include=`"$sourcePayload`"><PackagePath>..\escaped.exe</PackagePath></AppxPackagedFile><AppxPackagedFile Include=`"$sourcePri`"><PackagePath>resources.pri</PackagePath></AppxPackagedFile></ItemGroup></Project>")
        Assert-Throws -MessagePattern 'escapes staging root' -Message 'Traversal outside staging must be rejected.' -Body {
            & (Get-Module ScreenshotHarness) {
                param($RecipePath, $StagingRoot, $OwnedRoot)
                Copy-PackageRecipeLayout `
                    -RecipePath $RecipePath `
                    -StagingRoot $StagingRoot `
                    -OwnedRoot $OwnedRoot
            } $escapeRecipePath $escapeStagingRoot $ownedRoot
        }
        Assert-True (-not (Test-Path -LiteralPath (Join-Path $ownedRoot 'escaped.exe'))) 'Traversal target must not be created.'
    }

    Test-Case 'selects only exact owned development packages for cleanup' {
        $ownedRoot = Join-Path $temporaryRoot 'cleanup-owned'
        $ownedPackagePath = Join-Path $ownedRoot 'appx'
        $externalPath = Join-Path $temporaryRoot 'external-registration'
        $identity = 'WinUISamples.Capture.0123456789abcdef01234567'
        $packages = @(
            [pscustomobject]@{
                Name = $identity
                PackageFullName = "$identity`_owned"
                InstallLocation = $ownedPackagePath
                IsDevelopmentMode = $true
            },
            [pscustomobject]@{
                Name = $identity
                PackageFullName = "$identity`_external"
                InstallLocation = $externalPath
                IsDevelopmentMode = $true
            },
            [pscustomobject]@{
                Name = $identity
                PackageFullName = "$identity`_installed"
                InstallLocation = $ownedPackagePath
                IsDevelopmentMode = $false
            },
            [pscustomobject]@{
                Name = 'Original.Package'
                PackageFullName = 'Original.Package_external'
                InstallLocation = $ownedPackagePath
                IsDevelopmentMode = $true
            }
        )

        $selected = @(& (Get-Module ScreenshotHarness) {
            param($Packages, $Identity, $OwnedRoot)
            Select-OwnedHarnessPackages `
                -Packages $Packages `
                -PackageIdentityName $Identity `
                -OwnedRoot $OwnedRoot
        } $packages $identity $ownedRoot)
        Assert-Equal 1 $selected.Count 'Cleanup should select one exact owned development package.'
        Assert-Equal "$identity`_owned" $selected[0].PackageFullName 'Cleanup should select only the run-owned registration.'

        $observedProcessIds = [System.Collections.Generic.HashSet[int]]::new()
        & (Get-Module ScreenshotHarness) {
            param($ObservedProcessIds, $PackageOutputPath)
            Add-ValidatedLaunchedProcessIds `
                -Identity ([pscustomobject]@{ ExpectedProcessName = 'NoSuchCaptureProcess' }) `
                -BuildOutput ([pscustomobject]@{ TargetName = 'NoSuchCaptureProcess' }) `
                -PackageOutputPath $PackageOutputPath `
                -PreexistingProcessIds @() `
                -ObservedProcessIds $ObservedProcessIds
        } $observedProcessIds $ownedPackagePath
        Assert-Equal 0 $observedProcessIds.Count 'An empty tracked PID set should remain valid during cleanup.'
    }

    Test-Case 'writes machine-readable report and accessible contact sheet' {
        $reportPath = Join-Path $temporaryRoot 'report\run.json'
        $contactPath = Join-Path $temporaryRoot 'report\contact-sheet.html'
        $report = [ordered]@{
            schemaVersion = 1
            runId = 'test-run'
            results = @(
                [ordered]@{
                    projectFolder = 'FileAccess'
                    screenshotId = 'create-file'
                    status = 'manual'
                    alt = 'An app view with <accessible> descriptive text.'
                    reason = 'Manual fixture.'
                    reviewImage = $null
                }
            )
        }
        Write-CaptureReport -Report $report -Path $reportPath
        Write-CaptureContactSheet -Report $report -Path $contactPath
        $parsed = Get-Content -LiteralPath $reportPath -Raw | ConvertFrom-Json
        Assert-Equal 'test-run' $parsed.runId 'Report should round-trip as JSON.'
        $html = Get-Content -LiteralPath $contactPath -Raw
        Assert-True ($html -match '&lt;accessible&gt;') 'Contact sheet should HTML-encode alt text.'
        Assert-True ($html -match 'lang="en"') 'Contact sheet should declare its language.'
    }

    Test-Case 'detects blank images and validates dimensions' {
        Add-Type -AssemblyName System.Drawing.Common
        $solidPath = Join-Path $temporaryRoot 'solid.png'
        $variedPath = Join-Path $temporaryRoot 'varied.png'
        $transparentPath = Join-Path $temporaryRoot 'transparent.png'

        $solid = [System.Drawing.Bitmap]::new(120, 80)
        try {
            $graphics = [System.Drawing.Graphics]::FromImage($solid)
            try {
                $graphics.Clear([System.Drawing.Color]::White)
            }
            finally {
                $graphics.Dispose()
            }
            $solid.Save($solidPath, [System.Drawing.Imaging.ImageFormat]::Png)
        }
        finally {
            $solid.Dispose()
        }

        $varied = [System.Drawing.Bitmap]::new(120, 80)
        try {
            for ($y = 0; $y -lt $varied.Height; $y++) {
                for ($x = 0; $x -lt $varied.Width; $x++) {
                    $color = if ((($x / 10) + ($y / 10)) % 2 -lt 1) {
                        [System.Drawing.Color]::Navy
                    }
                    else {
                        [System.Drawing.Color]::Gold
                    }
                    $varied.SetPixel($x, $y, $color)
                }
            }
            $varied.Save($variedPath, [System.Drawing.Imaging.ImageFormat]::Png)
        }
        finally {
            $varied.Dispose()
        }

        $solidResult = Test-PngImage -Path $solidPath -ExpectedWidth 120 -ExpectedHeight 80
        Assert-True $solidResult.MostlyUniform 'Solid image should be detected as uniform.'
        Assert-True (-not $solidResult.IsValid) 'Solid image should fail validation.'

        $variedResult = Test-PngImage -Path $variedPath -ExpectedWidth 120 -ExpectedHeight 80
        Assert-True (-not $variedResult.MostlyUniform) 'Varied image should not be detected as uniform.'
        Assert-True $variedResult.IsValid 'Varied image should pass PNG and dimension checks.'

        $wrongDimensions = Test-PngImage -Path $variedPath -ExpectedWidth 121 -ExpectedHeight 80
        Assert-True (-not $wrongDimensions.DimensionMatches) 'Dimension mismatch should be detected.'
        Assert-True (-not $wrongDimensions.IsValid) 'Dimension mismatch should fail validation.'

        $transparent = [System.Drawing.Bitmap]::new(
            120,
            80,
            [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        try {
            for ($y = 0; $y -lt $transparent.Height; $y++) {
                for ($x = 0; $x -lt $transparent.Width; $x++) {
                    $transparent.SetPixel(
                        $x,
                        $y,
                        [System.Drawing.Color]::FromArgb(
                            0,
                            ($x * 17) % 255,
                            ($y * 31) % 255,
                            (($x + $y) * 13) % 255))
                }
            }
            $transparent.Save($transparentPath, [System.Drawing.Imaging.ImageFormat]::Png)
        }
        finally {
            $transparent.Dispose()
        }
        $transparentResult = Test-PngImage `
            -Path $transparentPath `
            -ExpectedWidth 120 `
            -ExpectedHeight 80
        Assert-Equal 0 $transparentResult.VisibleAlphaFraction 'Fully transparent image should have no visible alpha coverage.'
        Assert-True (-not $transparentResult.IsValid) 'Fully transparent image should fail validation.'
    }
}
finally {
    Remove-Item -LiteralPath $temporaryRoot -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "$passed test(s) passed; $($failures.Count) failed."
if ($failures.Count -gt 0) {
    foreach ($failure in $failures) {
        [Console]::Error.WriteLine($failure)
    }
    exit 1
}
