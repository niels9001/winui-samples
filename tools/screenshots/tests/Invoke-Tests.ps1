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
