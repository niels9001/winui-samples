#requires -Version 7.0

[CmdletBinding(DefaultParameterSetName = 'Sample')]
param(
    [Parameter(Mandatory, Position = 0, ParameterSetName = 'Sample')]
    [string[]] $Sample,

    [Parameter(Mandatory, ParameterSetName = 'All')]
    [switch] $All,

    [Parameter(Mandatory, ParameterSetName = 'List')]
    [switch] $List,

    [Parameter()]
    [switch] $DryRun,

    [Parameter()]
    [string] $OutputRoot = (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)),

    [Parameter()]
    [ValidateSet('system', 'light', 'dark')]
    [string] $Theme = 'system',

    [Parameter()]
    [ValidateRange(640, 7680)]
    [int] $WindowWidth = 1440,

    [Parameter()]
    [ValidateRange(480, 4320)]
    [int] $WindowHeight = 900,

    [Parameter()]
    [int] $WindowX = 40,

    [Parameter()]
    [int] $WindowY = 40,

    [Parameter()]
    [ValidateRange(5, 600)]
    [int] $TimeoutSeconds = 60,

    [Parameter()]
    [ValidateRange(0, 10000)]
    [int] $StabilityMilliseconds = 1200,

    [Parameter()]
    [ValidateRange(1, 100)]
    [double] $MinimumFreeSpaceGB = 5,

    [Parameter()]
    [bool] $PreserveFailureArtifacts = $true,

    [Parameter()]
    [switch] $Overwrite,

    [Parameter()]
    [switch] $AllowNon100PercentScaling,

    [Parameter()]
    [switch] $CaptureScreen,

    [Parameter()]
    [switch] $NonInteractive,

    [Parameter()]
    [switch] $Json
)

$ErrorActionPreference = 'Stop'
$repositoryRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Import-Module (Join-Path $PSScriptRoot 'ScreenshotHarness.psm1') -Force

try {
    if ($List) {
        $temporaryPlan = Join-Path ([System.IO.Path]::GetTempPath()) "winui-capture-plan-$([Guid]::NewGuid().ToString('N')).json"
        try {
            $plan = Get-ScreenshotCapturePlan -RepositoryRoot $repositoryRoot -OutputPath $temporaryPlan
            $items = @($plan.samples | ForEach-Object {
                [pscustomobject]@{
                    id = $_.id
                    project = $_.project.folder
                    screenshots = @($_.screenshots).Count
                    automatic = @($_.screenshots | Where-Object { $_.capture.mode -eq 'automatic' }).Count
                    manual = @($_.screenshots | Where-Object { $_.capture.mode -eq 'manual' }).Count
                    hardwareOrAccountDependent = @($_.requirements.hardware).Count -gt 0 -or
                        @($_.requirements.accountServices).Count -gt 0
                }
            })
            if ($Json) {
                $items | ConvertTo-Json -Depth 10
            }
            else {
                $items | Format-Table -AutoSize
            }
        }
        finally {
            Remove-Item -LiteralPath $temporaryPlan -Force -ErrorAction SilentlyContinue
        }
        return
    }

    $arguments = @{
        RepositoryRoot = $repositoryRoot
        OutputRoot = $OutputRoot
        Theme = $Theme
        WindowWidth = $WindowWidth
        WindowHeight = $WindowHeight
        WindowX = $WindowX
        WindowY = $WindowY
        TimeoutSeconds = $TimeoutSeconds
        StabilityMilliseconds = $StabilityMilliseconds
        MinimumFreeSpaceGB = $MinimumFreeSpaceGB
        PreserveFailureArtifacts = $PreserveFailureArtifacts
        AllowNon100PercentScaling = [bool]$AllowNon100PercentScaling
        CaptureScreen = [bool]$CaptureScreen
        DryRun = [bool]$DryRun
        Overwrite = [bool]$Overwrite
        Quiet = [bool]$Json
    }
    if ($All) {
        $arguments.All = $true
    }
    else {
        $arguments.Sample = $Sample
    }

    $report = Invoke-SampleScreenshotHarness @arguments
    if ($Json) {
        $report | ConvertTo-Json -Depth 30
    }
    elseif (-not $NonInteractive) {
        Write-Host "Status: $($report.status)"
        Write-Host "Report: $($report.reportPath)"
        Write-Host "Contact sheet: $($report.contactSheetPath)"
    }

    if ($report.status -eq 'failed') {
        exit 1
    }
}
catch {
    [Console]::Error.WriteLine($_.Exception.Message)
    exit 1
}
