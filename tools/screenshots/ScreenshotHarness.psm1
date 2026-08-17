#requires -Version 7.0

Set-StrictMode -Version Latest

$script:ModuleRoot = Split-Path -Parent $PSCommandPath
$script:DefaultRepositoryRoot = Split-Path -Parent (Split-Path -Parent $script:ModuleRoot)
$script:BoundsProject = Join-Path $script:ModuleRoot 'WindowBounds\WindowBounds.csproj'
$script:BoundsDll = Join-Path $script:ModuleRoot 'WindowBounds\bin\Release\net10.0-windows10.0.17763.0\WindowBounds.dll'
$script:CapturePlanExporter = Join-Path $script:ModuleRoot 'export-capture-plan.mjs'

function ConvertTo-DisplayCommand {
    param(
        [Parameter(Mandatory)]
        [string] $FilePath,

        [Parameter(Mandatory)]
        [AllowEmptyCollection()]
        [string[]] $ArgumentList
    )

    $displayArguments = foreach ($argument in $ArgumentList) {
        if ($argument -match '[\s"]') {
            '"{0}"' -f ($argument -replace '"', '\"')
        }
        else {
            $argument
        }
    }

    return (@($FilePath) + $displayArguments) -join ' '
}

function Write-HarnessLog {
    param(
        [Parameter(Mandatory)]
        [hashtable] $Context,

        [Parameter(Mandatory)]
        [ValidateSet('DEBUG', 'INFO', 'WARN', 'ERROR')]
        [string] $Level,

        [Parameter(Mandatory)]
        [string] $Message
    )

    $line = '{0:o} [{1}] {2}' -f [DateTimeOffset]::UtcNow, $Level, $Message
    [System.IO.File]::AppendAllText($Context.LogPath, "$line$([Environment]::NewLine)")
    if (-not $Context.Quiet) {
        Write-Host $line
    }
}

function New-ProcessStartInfo {
    param(
        [Parameter(Mandatory)]
        [string] $FilePath,

        [Parameter(Mandatory)]
        [AllowEmptyCollection()]
        [string[]] $ArgumentList,

        [Parameter(Mandatory)]
        [string] $WorkingDirectory
    )

    $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
    $startInfo.FileName = $FilePath
    $startInfo.WorkingDirectory = $WorkingDirectory
    $startInfo.UseShellExecute = $false
    $startInfo.CreateNoWindow = $true
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    foreach ($argument in $ArgumentList) {
        $startInfo.ArgumentList.Add($argument)
    }

    return $startInfo
}

function Invoke-CapturedProcess {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $FilePath,

        [Parameter(Mandatory)]
        [AllowEmptyCollection()]
        [string[]] $ArgumentList,

        [Parameter(Mandatory)]
        [string] $WorkingDirectory,

        [Parameter()]
        [ValidateRange(1, 7200)]
        [int] $TimeoutSeconds = 120,

        [Parameter()]
        [hashtable] $Context,

        [Parameter()]
        [switch] $RequireSuccess
    )

    $displayCommand = ConvertTo-DisplayCommand -FilePath $FilePath -ArgumentList $ArgumentList
    if ($null -ne $Context) {
        Write-HarnessLog -Context $Context -Level INFO -Message "Running: $displayCommand"
    }

    $process = [System.Diagnostics.Process]::new()
    $process.StartInfo = New-ProcessStartInfo `
        -FilePath $FilePath `
        -ArgumentList $ArgumentList `
        -WorkingDirectory $WorkingDirectory
    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()

    if (-not $process.Start()) {
        throw "Failed to start: $displayCommand"
    }

    $stdoutTask = $process.StandardOutput.ReadToEndAsync()
    $stderrTask = $process.StandardError.ReadToEndAsync()
    if (-not $process.WaitForExit($TimeoutSeconds * 1000)) {
        Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
        $process.WaitForExit()
        throw "Command timed out after $TimeoutSeconds seconds: $displayCommand"
    }

    $stopwatch.Stop()
    $stdout = $stdoutTask.GetAwaiter().GetResult().TrimEnd()
    $stderr = $stderrTask.GetAwaiter().GetResult().TrimEnd()
    $result = [pscustomobject]@{
        FilePath = $FilePath
        Arguments = $ArgumentList
        Command = $displayCommand
        ExitCode = $process.ExitCode
        StandardOutput = $stdout
        StandardError = $stderr
        DurationMilliseconds = $stopwatch.ElapsedMilliseconds
    }

    if ($null -ne $Context) {
        if ($stdout) {
            Write-HarnessLog -Context $Context -Level DEBUG -Message $stdout
        }
        if ($stderr) {
            Write-HarnessLog -Context $Context -Level WARN -Message $stderr
        }
    }

    if ($RequireSuccess -and $result.ExitCode -ne 0) {
        throw "Command failed with exit code $($result.ExitCode): $displayCommand`n$stderr"
    }

    return $result
}

function Start-CapturedProcess {
    param(
        [Parameter(Mandatory)]
        [string] $FilePath,

        [Parameter(Mandatory)]
        [AllowEmptyCollection()]
        [string[]] $ArgumentList,

        [Parameter(Mandatory)]
        [string] $WorkingDirectory,

        [Parameter(Mandatory)]
        [hashtable] $Context
    )

    $displayCommand = ConvertTo-DisplayCommand -FilePath $FilePath -ArgumentList $ArgumentList
    Write-HarnessLog -Context $Context -Level INFO -Message "Starting: $displayCommand"

    $process = [System.Diagnostics.Process]::new()
    $process.StartInfo = New-ProcessStartInfo `
        -FilePath $FilePath `
        -ArgumentList $ArgumentList `
        -WorkingDirectory $WorkingDirectory
    if (-not $process.Start()) {
        throw "Failed to start: $displayCommand"
    }

    return [pscustomobject]@{
        Process = $process
        StandardOutputTask = $process.StandardOutput.ReadToEndAsync()
        StandardErrorTask = $process.StandardError.ReadToEndAsync()
        Command = $displayCommand
    }
}

function Complete-CapturedProcess {
    param(
        [Parameter(Mandatory)]
        [pscustomobject] $TrackedProcess,

        [Parameter(Mandatory)]
        [string] $StandardOutputPath,

        [Parameter(Mandatory)]
        [string] $StandardErrorPath,

        [Parameter(Mandatory)]
        [hashtable] $Context,

        [Parameter()]
        [ValidateRange(1, 120)]
        [int] $TimeoutSeconds = 15
    )

    $process = $TrackedProcess.Process
    if (-not $process.HasExited -and -not $process.WaitForExit($TimeoutSeconds * 1000)) {
        Write-HarnessLog -Context $Context -Level WARN -Message "Stopping exact WinApp CLI process $($process.Id) after cleanup timeout."
        Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
        $process.WaitForExit()
    }

    $stdout = $TrackedProcess.StandardOutputTask.GetAwaiter().GetResult()
    $stderr = $TrackedProcess.StandardErrorTask.GetAwaiter().GetResult()
    [System.IO.File]::WriteAllText($StandardOutputPath, $stdout)
    [System.IO.File]::WriteAllText($StandardErrorPath, $stderr)

    return [pscustomobject]@{
        ExitCode = $process.ExitCode
        StandardOutput = $stdout.TrimEnd()
        StandardError = $stderr.TrimEnd()
    }
}

function Test-PathWithinRoot {
    param(
        [Parameter(Mandatory)]
        [string] $Path,

        [Parameter(Mandatory)]
        [string] $Root
    )

    $fullPath = [System.IO.Path]::GetFullPath($Path)
    $fullRoot = [System.IO.Path]::GetFullPath($Root).TrimEnd(
        [System.IO.Path]::DirectorySeparatorChar,
        [System.IO.Path]::AltDirectorySeparatorChar)
    $rootPrefix = "$fullRoot$([System.IO.Path]::DirectorySeparatorChar)"
    return $fullPath.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase)
}

function Test-PathWithinOrEqualRoot {
    param(
        [Parameter(Mandatory)]
        [string] $Path,

        [Parameter(Mandatory)]
        [string] $Root
    )

    $fullPath = [System.IO.Path]::GetFullPath($Path)
    $fullRoot = [System.IO.Path]::GetFullPath($Root).TrimEnd(
        [System.IO.Path]::DirectorySeparatorChar,
        [System.IO.Path]::AltDirectorySeparatorChar)
    return $fullPath.Equals($fullRoot, [StringComparison]::OrdinalIgnoreCase) -or
        (Test-PathWithinRoot -Path $fullPath -Root $fullRoot)
}

function Test-CapturePackageIdentityName {
    param(
        [Parameter(Mandatory)]
        [string] $PackageIdentityName
    )

    return $PackageIdentityName.Length -ge 3 -and
        $PackageIdentityName.Length -le 50 -and
        $PackageIdentityName -match '^[A-Za-z0-9.-]+$'
}

function New-CapturePackageIdentity {
    param(
        [Parameter(Mandatory)]
        [string] $SampleId,

        [Parameter(Mandatory)]
        [string] $ScreenshotId,

        [Parameter(Mandatory)]
        [string] $RunId,

        [Parameter()]
        [AllowEmptyCollection()]
        [string[]] $UnavailableIdentityNames = @()
    )

    foreach ($value in @($SampleId, $ScreenshotId, $RunId)) {
        if ([string]::IsNullOrWhiteSpace($value)) {
            throw 'Capture identity inputs must not be empty.'
        }
    }

    $identityInput = "winui-samples-capture-v1`n$SampleId`n$ScreenshotId`n$RunId"
    $identityBytes = [System.Text.Encoding]::UTF8.GetBytes($identityInput)
    $sha256 = [System.Security.Cryptography.SHA256]::Create()
    try {
        $identityHash = [Convert]::ToHexString(
            $sha256.ComputeHash($identityBytes)).ToLowerInvariant()
    }
    finally {
        $sha256.Dispose()
    }

    $packageIdentityName = "WinUISamples.Capture.$($identityHash.Substring(0, 24))"
    if (-not (Test-CapturePackageIdentityName -PackageIdentityName $packageIdentityName)) {
        throw "Generated capture identity '$packageIdentityName' is not a valid package identity name."
    }
    if (@($UnavailableIdentityNames | Where-Object {
            $unavailableIdentityName = [string]$_
            $unavailableIdentityName -and
                $unavailableIdentityName.Equals(
                    $packageIdentityName,
                    [StringComparison]::OrdinalIgnoreCase)
        }).Count -gt 0) {
        throw "Temporary capture identity '$packageIdentityName' is already registered; refusing to replace or reuse it."
    }

    return $packageIdentityName
}

function Resolve-MakePriPath {
    $command = Get-Command makepri.exe -CommandType Application -ErrorAction SilentlyContinue |
        Select-Object -First 1
    if ($null -ne $command) {
        return [System.IO.Path]::GetFullPath($command.Source)
    }

    $installedRoots = Get-ItemProperty `
        -LiteralPath 'HKLM:\SOFTWARE\Microsoft\Windows Kits\Installed Roots' `
        -ErrorAction SilentlyContinue
    $kitsRoot = if ($null -ne $installedRoots) {
        [string]$installedRoots.KitsRoot10
    }
    else {
        ''
    }
    if ([string]::IsNullOrWhiteSpace($kitsRoot)) {
        throw 'Windows SDK 10 is required, but KitsRoot10 is not registered.'
    }

    $candidates = [System.Collections.Generic.List[object]]::new()
    foreach ($directory in Get-ChildItem -LiteralPath (Join-Path $kitsRoot 'bin') -Directory -ErrorAction SilentlyContinue) {
        $version = $null
        if (-not [Version]::TryParse($directory.Name, [ref]$version)) {
            continue
        }
        $candidatePath = Join-Path $directory.FullName 'x64\makepri.exe'
        if (Test-Path -LiteralPath $candidatePath -PathType Leaf) {
            $candidates.Add([pscustomobject]@{
                Version = $version
                Path = $candidatePath
            })
        }
    }

    $selected = $candidates | Sort-Object Version -Descending | Select-Object -First 1
    if ($null -eq $selected) {
        throw "Windows SDK 10 is installed at '$kitsRoot', but x64\makepri.exe was not found."
    }
    return [System.IO.Path]::GetFullPath($selected.Path)
}

function Copy-PackageRecipeLayout {
    param(
        [Parameter(Mandatory)]
        [string] $RecipePath,

        [Parameter(Mandatory)]
        [string] $StagingRoot,

        [Parameter(Mandatory)]
        [string] $OwnedRoot
    )

    $recipePath = [System.IO.Path]::GetFullPath($RecipePath)
    $stagingRoot = [System.IO.Path]::GetFullPath($StagingRoot)
    $ownedRoot = [System.IO.Path]::GetFullPath($OwnedRoot)
    if (-not (Test-Path -LiteralPath $recipePath -PathType Leaf)) {
        throw "Package recipe '$recipePath' does not exist."
    }
    if (-not (Test-PathWithinRoot -Path $stagingRoot -Root $ownedRoot)) {
        throw "Staging root '$stagingRoot' is not owned by run work directory '$ownedRoot'."
    }
    if (Test-Path -LiteralPath $stagingRoot) {
        if (@(Get-ChildItem -LiteralPath $stagingRoot -Force).Count -gt 0) {
            throw "Staging root '$stagingRoot' must be empty."
        }
    }
    else {
        [System.IO.Directory]::CreateDirectory($stagingRoot) | Out-Null
    }

    [xml] $recipe = Get-Content -LiteralPath $recipePath -Raw
    $recipeItems = @($recipe.SelectNodes(
        "/*[local-name()='Project']/*[local-name()='ItemGroup']/*[local-name()='AppXManifest' or local-name()='AppxPackagedFile']"))
    $manifestItems = @($recipeItems | Where-Object { $_.LocalName -eq 'AppXManifest' })
    if ($manifestItems.Count -ne 1) {
        throw "Package recipe '$recipePath' must contain exactly one AppXManifest item."
    }

    $recipeDirectory = Split-Path -Parent $recipePath
    $destinations = [System.Collections.Generic.HashSet[string]]::new(
        [StringComparer]::OrdinalIgnoreCase)
    $stagedManifestPath = $null
    $sourceManifestPath = $null
    $sourceResourceIndexPath = $null
    $copiedFileCount = 0
    foreach ($item in $recipeItems) {
        $packagePathNode = $item.SelectSingleNode("./*[local-name()='PackagePath']")
        if ($null -eq $packagePathNode -or [string]::IsNullOrWhiteSpace($packagePathNode.InnerText)) {
            throw "Package recipe item '$($item.Include)' has no PackagePath."
        }

        $packagePath = $packagePathNode.InnerText.Trim().Replace(
            [System.IO.Path]::AltDirectorySeparatorChar,
            [System.IO.Path]::DirectorySeparatorChar)
        if ([System.IO.Path]::IsPathRooted($packagePath)) {
            throw "Package path '$packagePath' must be relative."
        }
        $destinationPath = [System.IO.Path]::GetFullPath((Join-Path $stagingRoot $packagePath))
        if (-not (Test-PathWithinRoot -Path $destinationPath -Root $stagingRoot)) {
            throw "Package path '$packagePath' escapes staging root '$stagingRoot'."
        }
        if (-not $destinations.Add($destinationPath)) {
            throw "Package recipe maps multiple files to '$packagePath'."
        }

        $sourcePath = [System.IO.Path]::GetFullPath([string]$item.Include, $recipeDirectory)
        if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
            throw "Package recipe source '$sourcePath' does not exist."
        }
        if ($packagePath.Equals('resources.pri', [StringComparison]::OrdinalIgnoreCase)) {
            $sourceResourceIndexPath = $sourcePath
            continue
        }

        [System.IO.Directory]::CreateDirectory((Split-Path -Parent $destinationPath)) | Out-Null
        [System.IO.File]::Copy($sourcePath, $destinationPath, $false)
        $copiedFileCount++
        if ($item.LocalName -eq 'AppXManifest') {
            $sourceManifestPath = $sourcePath
            $stagedManifestPath = $destinationPath
        }
    }

    if (-not $stagedManifestPath -or -not (Test-Path -LiteralPath $stagedManifestPath -PathType Leaf)) {
        throw "Package recipe '$recipePath' did not stage its manifest."
    }
    if (-not $sourceResourceIndexPath) {
        throw "Package recipe '$recipePath' has no root resources.pri to regenerate."
    }

    return [pscustomobject]@{
        StagingRoot = $stagingRoot
        StagedManifestPath = $stagedManifestPath
        SourceManifestPath = $sourceManifestPath
        SourceResourceIndexPath = $sourceResourceIndexPath
        CopiedFileCount = $copiedFileCount
    }
}

function Set-StagedPackageIdentity {
    param(
        [Parameter(Mandatory)]
        [string] $ManifestPath,

        [Parameter(Mandatory)]
        [string] $OwnedRoot,

        [Parameter(Mandatory)]
        [string] $ExpectedSourceIdentityName,

        [Parameter(Mandatory)]
        [string] $CaptureIdentityName
    )

    $manifestPath = [System.IO.Path]::GetFullPath($ManifestPath)
    if (-not (Test-PathWithinRoot -Path $manifestPath -Root $OwnedRoot)) {
        throw "Staged manifest '$manifestPath' is outside owned root '$OwnedRoot'."
    }
    if (-not (Test-CapturePackageIdentityName -PackageIdentityName $CaptureIdentityName)) {
        throw "Capture identity '$CaptureIdentityName' is not valid."
    }

    $manifest = [System.Xml.XmlDocument]::new()
    $manifest.PreserveWhitespace = $true
    $manifest.Load($manifestPath)
    $identityNode = $manifest.SelectSingleNode(
        "/*[local-name()='Package']/*[local-name()='Identity']")
    if ($null -eq $identityNode) {
        throw "Staged manifest '$manifestPath' has no package Identity."
    }
    $sourceIdentityName = $identityNode.GetAttribute('Name')
    if (-not $sourceIdentityName.Equals(
            $ExpectedSourceIdentityName,
            [StringComparison]::OrdinalIgnoreCase)) {
        throw "Staged manifest identity '$sourceIdentityName' does not match expected source identity '$ExpectedSourceIdentityName'."
    }

    $identityNode.SetAttribute('Name', $CaptureIdentityName)
    $settings = [System.Xml.XmlWriterSettings]::new()
    $settings.Encoding = [System.Text.UTF8Encoding]::new($false)
    $settings.Indent = $false
    $settings.NewLineHandling = [System.Xml.NewLineHandling]::None
    $writer = [System.Xml.XmlWriter]::Create($manifestPath, $settings)
    try {
        $manifest.Save($writer)
    }
    finally {
        $writer.Dispose()
    }

    return [pscustomobject]@{
        SourceIdentityName = $sourceIdentityName
        CaptureIdentityName = $CaptureIdentityName
        ManifestPath = $manifestPath
    }
}

function Get-ScreenshotCapturePlan {
    [CmdletBinding()]
    param(
        [Parameter()]
        [string] $RepositoryRoot = $script:DefaultRepositoryRoot,

        [Parameter()]
        [string] $OutputPath = (Join-Path ([System.IO.Path]::GetTempPath()) "winui-capture-plan-$([Guid]::NewGuid().ToString('N')).json"),

        [Parameter()]
        [hashtable] $Context
    )

    $repositoryRoot = [System.IO.Path]::GetFullPath($RepositoryRoot)
    $node = Get-Command node -ErrorAction SilentlyContinue
    if ($null -eq $node) {
        throw 'Node.js 22 or newer is required to validate and read sample.yml metadata.'
    }

    foreach ($dependency in @('ajv', 'yaml')) {
        $dependencyPath = Join-Path $repositoryRoot "node_modules\$dependency"
        if (-not (Test-Path -LiteralPath $dependencyPath -PathType Container)) {
            throw "Catalog dependency '$dependency' is missing. Run 'pnpm install --frozen-lockfile' at the repository root."
        }
    }

    $result = Invoke-CapturedProcess `
        -FilePath $node.Source `
        -ArgumentList @(
            $script:CapturePlanExporter,
            '--output', $OutputPath,
            '--repo-root', $repositoryRoot
        ) `
        -WorkingDirectory $repositoryRoot `
        -TimeoutSeconds 120 `
        -Context $Context `
        -RequireSuccess

    if (-not (Test-Path -LiteralPath $OutputPath -PathType Leaf)) {
        throw "Capture plan exporter did not create '$OutputPath'."
    }

    return Get-Content -LiteralPath $OutputPath -Raw | ConvertFrom-Json -Depth 30
}

function Select-CaptureSamples {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [pscustomobject] $Plan,

        [Parameter()]
        [string[]] $Sample,

        [Parameter()]
        [switch] $All
    )

    $available = @($Plan.samples)
    if ($All) {
        return $available
    }

    if ($null -eq $Sample -or $Sample.Count -eq 0) {
        throw 'Specify -Sample <id-or-project> (one or more values) or -All.'
    }

    $selected = [System.Collections.Generic.List[object]]::new()
    foreach ($requested in $Sample) {
        $matches = @($available | Where-Object {
            $_.id.Equals($requested, [StringComparison]::OrdinalIgnoreCase) -or
            $_.project.folder.Equals($requested, [StringComparison]::OrdinalIgnoreCase) -or
            $_.project.name.Equals($requested, [StringComparison]::OrdinalIgnoreCase)
        })

        if ($matches.Count -eq 0) {
            $names = ($available | ForEach-Object { $_.project.folder }) -join ', '
            throw "Unknown sample '$requested'. Metadata is available for: $names"
        }
        if ($matches.Count -gt 1) {
            throw "Sample selector '$requested' is ambiguous."
        }
        if (-not ($selected | Where-Object { $_.id -eq $matches[0].id })) {
            $selected.Add($matches[0])
        }
    }

    return $selected.ToArray()
}

function Resolve-SampleIdentity {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [pscustomobject] $Sample,

        [Parameter(Mandatory)]
        [string] $RepositoryRoot
    )

    $samplesRoot = Join-Path $RepositoryRoot 'Samples'
    $sampleDirectory = [System.IO.Path]::GetFullPath((Join-Path $samplesRoot $Sample.project.folder))
    if (-not (Test-PathWithinRoot -Path $sampleDirectory -Root $samplesRoot)) {
        throw "Sample folder '$($Sample.project.folder)' escapes the Samples directory."
    }
    if (-not (Test-Path -LiteralPath $sampleDirectory -PathType Container)) {
        throw "Sample directory '$sampleDirectory' does not exist."
    }

    $projectPath = Join-Path $sampleDirectory "$($Sample.project.name).csproj"
    if (-not (Test-Path -LiteralPath $projectPath -PathType Leaf)) {
        throw "Metadata project '$($Sample.project.name)' does not resolve to '$projectPath'."
    }

    [xml] $projectXml = Get-Content -LiteralPath $projectPath -Raw
    $targetFrameworkNode = $projectXml.SelectSingleNode("/*[local-name()='Project']/*[local-name()='PropertyGroup']/*[local-name()='TargetFramework']")
    if ($null -eq $targetFrameworkNode -or [string]::IsNullOrWhiteSpace($targetFrameworkNode.InnerText)) {
        throw "Project '$projectPath' does not declare TargetFramework."
    }

    $assemblyNameNode = $projectXml.SelectSingleNode("/*[local-name()='Project']/*[local-name()='PropertyGroup']/*[local-name()='AssemblyName']")
    $assemblyName = if ($null -eq $assemblyNameNode -or [string]::IsNullOrWhiteSpace($assemblyNameNode.InnerText)) {
        $Sample.project.name
    }
    else {
        $assemblyNameNode.InnerText
    }

    $manifestPath = Join-Path $sampleDirectory 'Package.appxmanifest'
    if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
        throw "Package manifest '$manifestPath' does not exist."
    }

    [xml] $manifestXml = Get-Content -LiteralPath $manifestPath -Raw
    $namespace = [System.Xml.XmlNamespaceManager]::new($manifestXml.NameTable)
    $namespace.AddNamespace('f', 'http://schemas.microsoft.com/appx/manifest/foundation/windows10')
    $identityNode = $manifestXml.SelectSingleNode('/f:Package/f:Identity', $namespace)
    $applicationNodes = @($manifestXml.SelectNodes('/f:Package/f:Applications/f:Application', $namespace))
    if ($null -eq $identityNode -or [string]::IsNullOrWhiteSpace($identityNode.Name)) {
        throw "Package manifest '$manifestPath' has no identity name."
    }
    if ($applicationNodes.Count -ne 1) {
        throw "Package manifest '$manifestPath' must contain exactly one application for deterministic capture."
    }

    $visualElements = $applicationNodes[0].ChildNodes | Where-Object {
        $_.LocalName -eq 'VisualElements'
    } | Select-Object -First 1
    $displayName = if ($null -ne $visualElements -and $visualElements.HasAttribute('DisplayName')) {
        $visualElements.GetAttribute('DisplayName')
    }
    else {
        $Sample.project.name
    }

    return [pscustomobject]@{
        SampleId = $Sample.id
        ProjectFolder = $Sample.project.folder
        ProjectName = $Sample.project.name
        SampleDirectory = $sampleDirectory
        ProjectPath = $projectPath
        SourceManifestPath = $manifestPath
        PackageIdentityName = $identityNode.Name
        ApplicationId = $applicationNodes[0].Id
        ManifestExecutable = $applicationNodes[0].Executable
        DisplayName = $displayName
        AssemblyName = $assemblyName
        TargetFramework = $targetFrameworkNode.InnerText
        ExpectedProcessName = $assemblyName
    }
}

function New-SampleBuildCommand {
    param(
        [Parameter(Mandatory)]
        [pscustomobject] $Identity
    )

    return [pscustomobject]@{
        FilePath = 'dotnet'
        Arguments = @(
            'build',
            $Identity.ProjectPath,
            '-c', 'Debug',
            '-p:Platform=x64',
            '--nologo'
        )
    }
}

function New-BuildPropertiesCommand {
    param(
        [Parameter(Mandatory)]
        [pscustomobject] $Identity
    )

    return [pscustomobject]@{
        FilePath = 'dotnet'
        Arguments = @(
            'msbuild',
            $Identity.ProjectPath,
            '-nologo',
            '-getProperty:TargetPath',
            '-getProperty:TargetDir',
            '-getProperty:TargetName',
            '-getProperty:TargetFramework',
            '-getProperty:RuntimeIdentifier',
            '-p:Configuration=Debug',
            '-p:Platform=x64'
        )
    }
}

function New-WinAppRunCommand {
    param(
        [Parameter(Mandatory)]
        [string] $InputFolder,

        [Parameter(Mandatory)]
        [string] $ManifestPath,

        [Parameter(Mandatory)]
        [string] $PackageOutputPath
    )

    return [pscustomobject]@{
        FilePath = 'winapp'
        Arguments = @(
            'run',
            $InputFolder,
            '--manifest', $ManifestPath,
            '--output-appx-directory', $PackageOutputPath,
            '--unregister-on-exit',
            '--json'
        )
    }
}

function ConvertFrom-CaptureSelector {
    param(
        [Parameter(Mandatory)]
        [string] $Selector
    )

    if ($Selector -notmatch '^(?i)(?<kind>text|name|automationid)=(?<value>.+)$') {
        return $null
    }

    return [pscustomobject]@{
        Kind = $Matches.kind.ToLowerInvariant()
        Value = $Matches.value
    }
}

function ConvertTo-WinAppSelector {
    param(
        [Parameter(Mandatory)]
        [string] $Selector
    )

    $parsed = ConvertFrom-CaptureSelector -Selector $Selector
    if ($null -ne $parsed) {
        return $parsed.Value
    }

    return $Selector
}

function New-WinAppUiCommand {
    param(
        [Parameter(Mandatory)]
        [ValidateSet('list-windows', 'search', 'wait-for', 'invoke', 'click', 'set-value', 'screenshot')]
        [string] $Operation,

        [Parameter()]
        [string] $Selector,

        [Parameter()]
        [string] $Value,

        [Parameter()]
        [long] $WindowHandle,

        [Parameter()]
        [int] $ProcessId,

        [Parameter()]
        [string] $OutputPath,

        [Parameter()]
        [int] $TimeoutMilliseconds,

        [Parameter()]
        [switch] $CaptureScreen
    )

    $arguments = [System.Collections.Generic.List[string]]::new()
    $arguments.Add('ui')
    $arguments.Add($Operation)
    if ($Selector) {
        $arguments.Add((ConvertTo-WinAppSelector -Selector $Selector))
    }
    if ($Operation -eq 'set-value') {
        if ($null -eq $Value) {
            throw 'set-value requires -Value.'
        }
        $arguments.Add($Value)
    }
    if ($WindowHandle -gt 0) {
        $arguments.Add('--window')
        $arguments.Add([string]$WindowHandle)
    }
    elseif ($ProcessId -gt 0) {
        $arguments.Add('--app')
        $arguments.Add([string]$ProcessId)
    }
    if ($TimeoutMilliseconds -gt 0) {
        $arguments.Add('--timeout')
        $arguments.Add([string]$TimeoutMilliseconds)
    }
    if ($OutputPath) {
        $arguments.Add('--output')
        $arguments.Add($OutputPath)
    }
    if ($CaptureScreen) {
        $arguments.Add('--capture-screen')
    }
    $arguments.Add('--json')

    return [pscustomobject]@{
        FilePath = 'winapp'
        Arguments = $arguments.ToArray()
    }
}

function Ensure-WindowBoundsHelper {
    param(
        [Parameter(Mandatory)]
        [string] $RepositoryRoot,

        [Parameter(Mandatory)]
        [hashtable] $Context
    )

    $sourceFiles = @(
        $script:BoundsProject,
        (Join-Path (Split-Path -Parent $script:BoundsProject) 'Program.cs')
    )
    $needsBuild = -not (Test-Path -LiteralPath $script:BoundsDll -PathType Leaf)
    if (-not $needsBuild) {
        $outputTime = (Get-Item -LiteralPath $script:BoundsDll).LastWriteTimeUtc
        $needsBuild = @($sourceFiles | Where-Object {
            (Get-Item -LiteralPath $_).LastWriteTimeUtc -gt $outputTime
        }).Count -gt 0
    }

    if ($needsBuild) {
        Invoke-CapturedProcess `
            -FilePath 'dotnet' `
            -ArgumentList @('build', $script:BoundsProject, '-c', 'Release', '--nologo') `
            -WorkingDirectory $RepositoryRoot `
            -TimeoutSeconds 180 `
            -Context $Context `
            -RequireSuccess | Out-Null
    }

    if (-not (Test-Path -LiteralPath $script:BoundsDll -PathType Leaf)) {
        throw "Window bounds helper was not built at '$script:BoundsDll'."
    }

    return $script:BoundsDll
}

function Invoke-WindowBoundsHelper {
    param(
        [Parameter(Mandatory)]
        [string[]] $Arguments,

        [Parameter(Mandatory)]
        [string] $RepositoryRoot,

        [Parameter(Mandatory)]
        [hashtable] $Context
    )

    $result = Invoke-CapturedProcess `
        -FilePath 'dotnet' `
        -ArgumentList (@($script:BoundsDll) + $Arguments) `
        -WorkingDirectory $RepositoryRoot `
        -TimeoutSeconds 30 `
        -Context $Context `
        -RequireSuccess
    return $result.StandardOutput | ConvertFrom-Json -Depth 10
}

function Get-ExistingPackage {
    param(
        [Parameter(Mandatory)]
        [string] $PackageIdentityName
    )

    return @(Get-AppxPackage -Name $PackageIdentityName -ErrorAction SilentlyContinue)
}

function Test-HarnessPrerequisites {
    param(
        [Parameter(Mandatory)]
        [object[]] $Samples,

        [Parameter(Mandatory)]
        [string] $RepositoryRoot,

        [Parameter(Mandatory)]
        [string] $OutputRoot,

        [Parameter(Mandatory)]
        [int] $WindowX,

        [Parameter(Mandatory)]
        [int] $WindowY,

        [Parameter(Mandatory)]
        [int] $WindowWidth,

        [Parameter(Mandatory)]
        [int] $WindowHeight,

        [Parameter(Mandatory)]
        [double] $MinimumFreeSpaceGB,

        [Parameter(Mandatory)]
        [bool] $AllowNon100PercentScaling,

        [Parameter(Mandatory)]
        [bool] $DryRun,

        [Parameter(Mandatory)]
        [hashtable] $Context
    )

    if (-not $IsWindows) {
        throw 'Screenshot capture requires Windows.'
    }
    if (-not $DryRun -and -not [Environment]::UserInteractive) {
        throw 'Screenshot capture requires an interactive, unlocked user session.'
    }
    if ([Environment]::Is64BitOperatingSystem -ne $true) {
        throw 'The x64 capture harness requires a 64-bit Windows installation.'
    }

    foreach ($commandName in @('dotnet', 'winapp', 'node', 'Get-AppxPackage', 'Remove-AppxPackage')) {
        if ($null -eq (Get-Command $commandName -ErrorAction SilentlyContinue)) {
            throw "Required command '$commandName' is not available."
        }
    }

    $dotnetVersionResult = Invoke-CapturedProcess `
        -FilePath 'dotnet' `
        -ArgumentList @('--version') `
        -WorkingDirectory $RepositoryRoot `
        -Context $Context `
        -RequireSuccess
    $dotnetVersion = [Version]($dotnetVersionResult.StandardOutput -replace '-.*$', '')
    if ($dotnetVersion.Major -lt 10) {
        throw ".NET SDK 10 or newer is required; found $dotnetVersion."
    }

    $winAppVersion = (Invoke-CapturedProcess `
        -FilePath 'winapp' `
        -ArgumentList @('--version') `
        -WorkingDirectory $RepositoryRoot `
        -Context $Context `
        -RequireSuccess).StandardOutput

    $capabilityChecks = @(
        @{ Arguments = @('run', '--help'); Patterns = @('--output-appx-directory', '--unregister-on-exit', '--json') },
        @{ Arguments = @('ui', 'list-windows', '--help'); Patterns = @('--app', '--json') },
        @{ Arguments = @('ui', 'search', '--help'); Patterns = @('--window', '--json') },
        @{ Arguments = @('ui', 'wait-for', '--help'); Patterns = @('--window', '--timeout', '--json') },
        @{ Arguments = @('ui', 'invoke', '--help'); Patterns = @('--window', '--json') },
        @{ Arguments = @('ui', 'click', '--help'); Patterns = @('--window', '--json') },
        @{ Arguments = @('ui', 'screenshot', '--help'); Patterns = @('--window', '--capture-screen', '--output', '--json') }
    )
    foreach ($check in $capabilityChecks) {
        $help = Invoke-CapturedProcess `
            -FilePath 'winapp' `
            -ArgumentList $check.Arguments `
            -WorkingDirectory $RepositoryRoot `
            -Context $Context `
            -RequireSuccess
        $combined = "$($help.StandardOutput)`n$($help.StandardError)"
        foreach ($pattern in $check.Patterns) {
            if ($combined -notmatch [Regex]::Escape($pattern)) {
                throw "Installed WinApp CLI lacks required capability '$pattern' for '$($check.Arguments -join ' ')'."
            }
        }
    }

    $display = $null
    $makePriPath = $null
    if (-not $DryRun) {
        $makePriPath = Resolve-MakePriPath
        Ensure-WindowBoundsHelper -RepositoryRoot $RepositoryRoot -Context $Context | Out-Null
        $display = Invoke-WindowBoundsHelper `
            -Arguments @('system-info') `
            -RepositoryRoot $RepositoryRoot `
            -Context $Context
        if (-not $AllowNon100PercentScaling -and [double]$display.scalePercent -ne 100.0) {
            throw "Display scaling must be 100% for deterministic capture; found $($display.scalePercent)%. Use -AllowNon100PercentScaling only for diagnostics."
        }

        $virtualRight = [int]$display.virtualScreen.x + [int]$display.virtualScreen.width
        $virtualBottom = [int]$display.virtualScreen.y + [int]$display.virtualScreen.height
        if ($WindowX -lt [int]$display.virtualScreen.x -or
            $WindowY -lt [int]$display.virtualScreen.y -or
            $WindowX + $WindowWidth -gt $virtualRight -or
            $WindowY + $WindowHeight -gt $virtualBottom) {
            throw "Requested window bounds ${WindowWidth}x${WindowHeight}@($WindowX,$WindowY) do not fit the virtual screen $($display.virtualScreen.width)x$($display.virtualScreen.height)@($($display.virtualScreen.x),$($display.virtualScreen.y))."
        }
    }

    $outputRootItem = Get-Item -LiteralPath $OutputRoot
    $drive = Get-PSDrive -Name $outputRootItem.PSDrive.Name
    $freeSpaceGB = [Math]::Round($drive.Free / 1GB, 2)
    if ($freeSpaceGB -lt $MinimumFreeSpaceGB) {
        throw "Output drive has $freeSpaceGB GB free; at least $MinimumFreeSpaceGB GB is required."
    }

    $osVersion = [Environment]::OSVersion.Version
    foreach ($sample in $Samples) {
        $minimum = [Version]$sample.requirements.minimumWindowsVersion
        if ($osVersion -lt $minimum) {
            throw "Sample '$($sample.id)' requires Windows $minimum or newer; found $osVersion."
        }
        $targetMajor = if ($sample.PSObject.Properties.Name -contains 'identity') {
            [int]([Regex]::Match($sample.identity.TargetFramework, '^net(\d+)').Groups[1].Value)
        }
        else {
            10
        }
        if ($targetMajor -gt $dotnetVersion.Major) {
            throw "Sample '$($sample.id)' targets .NET $targetMajor but installed SDK is $dotnetVersion."
        }
    }

    return [ordered]@{
        windowsVersion = $osVersion.ToString()
        operatingSystem = [Environment]::OSVersion.VersionString
        dotnetSdk = $dotnetVersionResult.StandardOutput
        winAppCli = $winAppVersion
        makePriPath = $makePriPath
        dpi = if ($null -ne $display) { [int]$display.dpi } else { $null }
        scalePercent = if ($null -ne $display) { [double]$display.scalePercent } else { $null }
        virtualScreen = if ($null -ne $display) { $display.virtualScreen } else { $null }
        freeSpaceGB = $freeSpaceGB
        userInteractive = [Environment]::UserInteractive
    }
}

function Get-EvaluatedBuildOutput {
    param(
        [Parameter(Mandatory)]
        [pscustomobject] $Identity,

        [Parameter(Mandatory)]
        [string] $RepositoryRoot,

        [Parameter(Mandatory)]
        [hashtable] $Context
    )

    $command = New-BuildPropertiesCommand -Identity $Identity
    $result = Invoke-CapturedProcess `
        -FilePath $command.FilePath `
        -ArgumentList $command.Arguments `
        -WorkingDirectory $RepositoryRoot `
        -TimeoutSeconds 120 `
        -Context $Context `
        -RequireSuccess
    $properties = ($result.StandardOutput | ConvertFrom-Json -Depth 10).Properties
    $targetDirectory = [System.IO.Path]::GetFullPath($properties.TargetDir)
    if (-not (Test-PathWithinRoot -Path $targetDirectory -Root $Identity.SampleDirectory)) {
        throw "Evaluated target directory '$targetDirectory' escapes the sample directory."
    }

    $executablePath = Join-Path $targetDirectory "$($properties.TargetName).exe"
    if (-not (Test-Path -LiteralPath $executablePath -PathType Leaf)) {
        throw "Built executable '$executablePath' does not exist."
    }

    $manifestCandidates = @(@(
        (Join-Path $targetDirectory 'AppxManifest.xml'),
        (Join-Path $targetDirectory 'Package.appxmanifest')
    ) | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf })
    if ($manifestCandidates.Count -eq 0) {
        $manifestCandidates = @(Get-ChildItem -LiteralPath $targetDirectory -Recurse -File |
            Where-Object { $_.Name -in @('AppxManifest.xml', 'Package.appxmanifest') } |
            Select-Object -ExpandProperty FullName)
    }
    if ($manifestCandidates.Count -ne 1) {
        throw "Expected exactly one built package manifest under '$targetDirectory'; found $($manifestCandidates.Count)."
    }

    [xml] $builtManifest = Get-Content -LiteralPath $manifestCandidates[0] -Raw
    $namespace = [System.Xml.XmlNamespaceManager]::new($builtManifest.NameTable)
    $namespace.AddNamespace('f', 'http://schemas.microsoft.com/appx/manifest/foundation/windows10')
    $builtIdentity = $builtManifest.SelectSingleNode('/f:Package/f:Identity', $namespace)
    if ($null -eq $builtIdentity -or $builtIdentity.Name -ne $Identity.PackageIdentityName) {
        throw "Built manifest identity does not match source identity '$($Identity.PackageIdentityName)'."
    }

    $recipeCandidates = @(Get-ChildItem -LiteralPath $targetDirectory -File -Filter '*.build.appxrecipe')
    if ($recipeCandidates.Count -ne 1) {
        throw "Expected exactly one build appxrecipe in '$targetDirectory'; found $($recipeCandidates.Count)."
    }
    $recipePath = $recipeCandidates[0].FullName
    [xml] $recipe = Get-Content -LiteralPath $recipePath -Raw
    $recipeIdentityNode = $recipe.SelectSingleNode(
        "/*[local-name()='Project']/*[local-name()='PropertyGroup']/*[local-name()='PackageIdentityName']")
    if ($null -eq $recipeIdentityNode -or
        -not $recipeIdentityNode.InnerText.Equals(
            $Identity.PackageIdentityName,
            [StringComparison]::OrdinalIgnoreCase)) {
        throw "Package recipe identity does not match source identity '$($Identity.PackageIdentityName)'."
    }
    $intermediateNode = $recipe.SelectSingleNode(
        "/*[local-name()='Project']/*[local-name()='PropertyGroup']/*[local-name()='IntermediateOutputPath']")
    if ($null -eq $intermediateNode -or [string]::IsNullOrWhiteSpace($intermediateNode.InnerText)) {
        throw "Package recipe '$recipePath' has no IntermediateOutputPath."
    }
    $intermediateOutputPath = [System.IO.Path]::GetFullPath(
        $intermediateNode.InnerText,
        $Identity.SampleDirectory)
    if (-not (Test-PathWithinRoot -Path $intermediateOutputPath -Root $Identity.SampleDirectory)) {
        throw "Package intermediate directory '$intermediateOutputPath' escapes the sample directory."
    }
    $priConfigPath = Join-Path $intermediateOutputPath 'priconfig.xml'
    if (-not (Test-Path -LiteralPath $priConfigPath -PathType Leaf)) {
        throw "Generated PRI configuration '$priConfigPath' does not exist."
    }

    return [pscustomobject]@{
        TargetDirectory = $targetDirectory
        TargetPath = $properties.TargetPath
        TargetName = $properties.TargetName
        TargetFramework = $properties.TargetFramework
        RuntimeIdentifier = $properties.RuntimeIdentifier
        ExecutablePath = $executablePath
        ManifestPath = $manifestCandidates[0]
        RecipePath = $recipePath
        IntermediateOutputPath = $intermediateOutputPath
        PriConfigPath = $priConfigPath
    }
}

function New-IsolatedPackageLayout {
    param(
        [Parameter(Mandatory)]
        [pscustomobject] $Identity,

        [Parameter(Mandatory)]
        [pscustomobject] $BuildOutput,

        [Parameter(Mandatory)]
        [string] $StagingRoot,

        [Parameter(Mandatory)]
        [string] $OwnedRoot,

        [Parameter(Mandatory)]
        [string] $CaptureIdentityName,

        [Parameter(Mandatory)]
        [string] $MakePriPath,

        [Parameter(Mandatory)]
        [string] $RepositoryRoot,

        [Parameter(Mandatory)]
        [hashtable] $Context
    )

    if (-not (Test-CapturePackageIdentityName -PackageIdentityName $CaptureIdentityName)) {
        throw "Temporary package identity '$CaptureIdentityName' is invalid."
    }
    $layout = Copy-PackageRecipeLayout `
        -RecipePath $BuildOutput.RecipePath `
        -StagingRoot $StagingRoot `
        -OwnedRoot $OwnedRoot
    if (-not ([System.IO.Path]::GetFullPath($layout.SourceManifestPath).Equals(
                [System.IO.Path]::GetFullPath($BuildOutput.ManifestPath),
                [StringComparison]::OrdinalIgnoreCase))) {
        throw "Package recipe manifest '$($layout.SourceManifestPath)' does not match evaluated manifest '$($BuildOutput.ManifestPath)'."
    }

    $sourceManifestHash = (Get-FileHash -LiteralPath $layout.SourceManifestPath -Algorithm SHA256).Hash
    $sourceResourceHash = (Get-FileHash -LiteralPath $layout.SourceResourceIndexPath -Algorithm SHA256).Hash
    Set-StagedPackageIdentity `
        -ManifestPath $layout.StagedManifestPath `
        -OwnedRoot $OwnedRoot `
        -ExpectedSourceIdentityName $Identity.PackageIdentityName `
        -CaptureIdentityName $CaptureIdentityName | Out-Null

    $stagedResourceIndexPath = Join-Path $layout.StagingRoot 'resources.pri'
    $makePriResult = Invoke-CapturedProcess `
        -FilePath $MakePriPath `
        -ArgumentList @(
            'new',
            '/pr', $Identity.SampleDirectory,
            '/cf', $BuildOutput.PriConfigPath,
            '/of', $stagedResourceIndexPath,
            '/mn', $layout.StagedManifestPath,
            '/o'
        ) `
        -WorkingDirectory $RepositoryRoot `
        -TimeoutSeconds 120 `
        -Context $Context `
        -RequireSuccess
    if (-not (Test-Path -LiteralPath $stagedResourceIndexPath -PathType Leaf)) {
        throw "MakePri reported success but did not create '$stagedResourceIndexPath'."
    }

    $priDumpPath = Join-Path $OwnedRoot 'resources.pri.xml'
    Invoke-CapturedProcess `
        -FilePath $MakePriPath `
        -ArgumentList @(
            'dump',
            '/if', $stagedResourceIndexPath,
            '/of', $priDumpPath,
            '/o'
        ) `
        -WorkingDirectory $RepositoryRoot `
        -TimeoutSeconds 120 `
        -Context $Context `
        -RequireSuccess | Out-Null
    [xml] $priDump = Get-Content -LiteralPath $priDumpPath -Raw
    $resourceMap = $priDump.SelectSingleNode(
        "/*[local-name()='PriInfo']/*[local-name()='ResourceMap' and @primary='true']")
    if ($null -eq $resourceMap -or
        -not $resourceMap.GetAttribute('name').Equals(
            $CaptureIdentityName,
            [StringComparison]::Ordinal)) {
        throw "Generated PRI resource map does not match temporary identity '$CaptureIdentityName'."
    }

    $sourceManifestHashAfter = (Get-FileHash -LiteralPath $layout.SourceManifestPath -Algorithm SHA256).Hash
    $sourceResourceHashAfter = (Get-FileHash -LiteralPath $layout.SourceResourceIndexPath -Algorithm SHA256).Hash
    if ($sourceManifestHash -ne $sourceManifestHashAfter -or
        $sourceResourceHash -ne $sourceResourceHashAfter) {
        throw 'Source build outputs changed while staging the temporary package identity.'
    }

    Write-HarnessLog `
        -Context $Context `
        -Level INFO `
        -Message "Staged $($layout.CopiedFileCount + 1) package files with temporary identity '$CaptureIdentityName'."
    return [pscustomobject]@{
        InputFolder = $layout.StagingRoot
        ManifestPath = $layout.StagedManifestPath
        ResourceIndexPath = $stagedResourceIndexPath
        ResourceIndexDumpPath = $priDumpPath
        PackageIdentityName = $CaptureIdentityName
        SourcePackageIdentityName = $Identity.PackageIdentityName
        CopiedFileCount = $layout.CopiedFileCount + 1
        MakePriCommand = $makePriResult.Command
        SourceManifestSha256 = $sourceManifestHash
        SourceResourceIndexSha256 = $sourceResourceHash
    }
}

function Add-ValidatedLaunchedProcessIds {
    param(
        [Parameter(Mandatory)]
        [pscustomobject] $Identity,

        [Parameter(Mandatory)]
        [pscustomobject] $BuildOutput,

        [Parameter(Mandatory)]
        [string] $PackageOutputPath,

        [Parameter(Mandatory)]
        [AllowEmptyCollection()]
        [int[]] $PreexistingProcessIds,

        [Parameter(Mandatory)]
        [AllowEmptyCollection()]
        [System.Collections.Generic.HashSet[int]] $ObservedProcessIds
    )

    foreach ($process in Get-Process -ErrorAction SilentlyContinue) {
        if (-not $process.ProcessName.Equals(
                $Identity.ExpectedProcessName,
                [StringComparison]::OrdinalIgnoreCase) -or
            $process.Id -in $PreexistingProcessIds -or
            $process.HasExited) {
            continue
        }

        try {
            $processPath = [System.IO.Path]::GetFullPath($process.Path)
        }
        catch {
            continue
        }
        $pathIsValid = Test-PathWithinRoot -Path $processPath -Root $PackageOutputPath
        $fileNameIsValid = [System.IO.Path]::GetFileName($processPath).Equals(
            "$($BuildOutput.TargetName).exe",
            [StringComparison]::OrdinalIgnoreCase)
        if ($pathIsValid -and $fileNameIsValid) {
            [void]$ObservedProcessIds.Add($process.Id)
        }
    }
}

function Wait-ForLaunchedWindow {
    param(
        [Parameter(Mandatory)]
        [pscustomobject] $Identity,

        [Parameter(Mandatory)]
        [pscustomobject] $BuildOutput,

        [Parameter(Mandatory)]
        [string] $PackageOutputPath,

        [Parameter(Mandatory)]
        [AllowEmptyCollection()]
        [int[]] $PreexistingProcessIds,

        [Parameter(Mandatory)]
        [pscustomobject] $WinAppProcess,

        [Parameter(Mandatory)]
        [AllowEmptyCollection()]
        [System.Collections.Generic.HashSet[int]] $ObservedProcessIds,

        [Parameter(Mandatory)]
        [int] $TimeoutSeconds,

        [Parameter(Mandatory)]
        [string] $RepositoryRoot,

        [Parameter(Mandatory)]
        [hashtable] $Context
    )

    $deadline = [DateTimeOffset]::UtcNow.AddSeconds($TimeoutSeconds)
    do {
        Add-ValidatedLaunchedProcessIds `
            -Identity $Identity `
            -BuildOutput $BuildOutput `
            -PackageOutputPath $PackageOutputPath `
            -PreexistingProcessIds $PreexistingProcessIds `
            -ObservedProcessIds $ObservedProcessIds
        $command = New-WinAppUiCommand -Operation list-windows -ProcessId 0
        $command.Arguments = @('ui', 'list-windows', '--app', $Identity.ExpectedProcessName, '--json')
        $result = Invoke-CapturedProcess `
            -FilePath $command.FilePath `
            -ArgumentList $command.Arguments `
            -WorkingDirectory $RepositoryRoot `
            -TimeoutSeconds 15 `
            -Context $Context
        if ($result.ExitCode -eq 0 -and $result.StandardOutput) {
            $windows = @($result.StandardOutput | ConvertFrom-Json -Depth 10)
            $candidates = [System.Collections.Generic.List[object]]::new()
            foreach ($window in $windows) {
                $requiredProperties = @('hwnd', 'processId', 'processName', 'title')
                $missingProperties = @($requiredProperties | Where-Object {
                    $window.PSObject.Properties.Name -notcontains $_
                })
                if ($missingProperties.Count -gt 0) {
                    throw "WinApp list-windows JSON is missing required properties: $($missingProperties -join ', ')."
                }
                $processId = [int]$window.processId
                if ($processId -in $PreexistingProcessIds) {
                    continue
                }
                if (-not $window.processName.Equals($Identity.ExpectedProcessName, [StringComparison]::OrdinalIgnoreCase)) {
                    continue
                }

                $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
                if ($null -eq $process -or $process.HasExited) {
                    continue
                }
                try {
                    $processPath = [System.IO.Path]::GetFullPath($process.Path)
                }
                catch {
                    continue
                }
                $pathIsValid = Test-PathWithinRoot -Path $processPath -Root $PackageOutputPath
                if (-not $pathIsValid -or
                    -not [System.IO.Path]::GetFileName($processPath).Equals(
                        "$($BuildOutput.TargetName).exe",
                        [StringComparison]::OrdinalIgnoreCase)) {
                    continue
                }
                [void]$ObservedProcessIds.Add($processId)

                $candidates.Add([pscustomobject]@{
                    Hwnd = [long]$window.hwnd
                    ProcessId = $processId
                    ProcessPath = $processPath
                    ProcessName = $window.processName
                    Title = $window.title
                })
            }

            if ($candidates.Count -gt 0) {
                $preferred = @($candidates | Where-Object {
                    $_.Title.Equals($Identity.DisplayName, [StringComparison]::OrdinalIgnoreCase)
                })
                if ($preferred.Count -eq 1) {
                    return $preferred[0]
                }
                if ($candidates.Count -eq 1) {
                    return $candidates[0]
                }
                throw "Multiple new windows matched '$($Identity.ExpectedProcessName)'; refusing to guess."
            }
        }

        if ($WinAppProcess.Process.HasExited) {
            $stdout = $WinAppProcess.StandardOutputTask.GetAwaiter().GetResult()
            $stderr = $WinAppProcess.StandardErrorTask.GetAwaiter().GetResult()
            throw "WinApp CLI exited before a validated window appeared (exit $($WinAppProcess.Process.ExitCode)).`n$stdout`n$stderr"
        }

        Start-Sleep -Milliseconds 250
    } while ([DateTimeOffset]::UtcNow -lt $deadline)

    throw "Timed out after $TimeoutSeconds seconds waiting for a validated '$($Identity.ExpectedProcessName)' window."
}

function Invoke-WinAppUi {
    param(
        [Parameter(Mandatory)]
        [pscustomobject] $Command,

        [Parameter(Mandatory)]
        [string] $RepositoryRoot,

        [Parameter(Mandatory)]
        [int] $TimeoutSeconds,

        [Parameter(Mandatory)]
        [hashtable] $Context,

        [Parameter()]
        [switch] $RequireSuccess
    )

    return Invoke-CapturedProcess `
        -FilePath $Command.FilePath `
        -ArgumentList $Command.Arguments `
        -WorkingDirectory $RepositoryRoot `
        -TimeoutSeconds $TimeoutSeconds `
        -Context $Context `
        -RequireSuccess:$RequireSuccess
}

function Invoke-CaptureAction {
    param(
        [Parameter(Mandatory)]
        [pscustomobject] $Action,

        [Parameter(Mandatory)]
        [long] $WindowHandle,

        [Parameter(Mandatory)]
        [int] $TimeoutSeconds,

        [Parameter(Mandatory)]
        [string] $RepositoryRoot,

        [Parameter(Mandatory)]
        [hashtable] $Context
    )

    if ($Action.type -in @('input', 'select', 'click')) {
        $actionReadyCommand = New-WinAppUiCommand `
            -Operation wait-for `
            -Selector $Action.selector `
            -WindowHandle $WindowHandle `
            -TimeoutMilliseconds ($TimeoutSeconds * 1000)
        Invoke-WinAppUi `
            -Command $actionReadyCommand `
            -RepositoryRoot $RepositoryRoot `
            -TimeoutSeconds ($TimeoutSeconds + 5) `
            -Context $Context `
            -RequireSuccess | Out-Null
    }

    switch ($Action.type) {
        'wait' {
            Start-Sleep -Milliseconds ([int]$Action.durationMs)
        }
        'input' {
            $resolvedSelector = Resolve-WinAppActionSelector `
                -Selector $Action.selector `
                -WindowHandle $WindowHandle `
                -TimeoutSeconds $TimeoutSeconds `
                -RepositoryRoot $RepositoryRoot `
                -Context $Context
            $command = New-WinAppUiCommand `
                -Operation set-value `
                -Selector $resolvedSelector `
                -Value ([string]$Action.value) `
                -WindowHandle $WindowHandle
            Invoke-WinAppUi `
                -Command $command `
                -RepositoryRoot $RepositoryRoot `
                -TimeoutSeconds $TimeoutSeconds `
                -Context $Context `
                -RequireSuccess | Out-Null
        }
        'select' {
            $resolvedSelector = Resolve-WinAppActionSelector `
                -Selector $Action.selector `
                -WindowHandle $WindowHandle `
                -TimeoutSeconds $TimeoutSeconds `
                -RepositoryRoot $RepositoryRoot `
                -Context $Context
            $openCommand = New-WinAppUiCommand `
                -Operation invoke `
                -Selector $resolvedSelector `
                -WindowHandle $WindowHandle
            Invoke-WinAppUi `
                -Command $openCommand `
                -RepositoryRoot $RepositoryRoot `
                -TimeoutSeconds $TimeoutSeconds `
                -Context $Context `
                -RequireSuccess | Out-Null

            $waitCommand = New-WinAppUiCommand `
                -Operation wait-for `
                -Selector ([string]$Action.value) `
                -WindowHandle $WindowHandle `
                -TimeoutMilliseconds ($TimeoutSeconds * 1000)
            Invoke-WinAppUi `
                -Command $waitCommand `
                -RepositoryRoot $RepositoryRoot `
                -TimeoutSeconds ($TimeoutSeconds + 5) `
                -Context $Context `
                -RequireSuccess | Out-Null

            Invoke-InvokableElement `
                -Selector ([string]$Action.value) `
                -WindowHandle $WindowHandle `
                -TimeoutSeconds $TimeoutSeconds `
                -RepositoryRoot $RepositoryRoot `
                -Context $Context
        }
        'click' {
            $resolvedSelector = Resolve-WinAppActionSelector `
                -Selector $Action.selector `
                -WindowHandle $WindowHandle `
                -TimeoutSeconds $TimeoutSeconds `
                -RepositoryRoot $RepositoryRoot `
                -Context $Context
            Invoke-InvokableElement `
                -Selector $resolvedSelector `
                -WindowHandle $WindowHandle `
                -TimeoutSeconds $TimeoutSeconds `
                -RepositoryRoot $RepositoryRoot `
                -Context $Context
        }
        default {
            throw "Unsupported capture action '$($Action.type)'."
        }
    }
}

function Resolve-WinAppActionSelector {
    param(
        [Parameter(Mandatory)]
        [string] $Selector,

        [Parameter(Mandatory)]
        [long] $WindowHandle,

        [Parameter(Mandatory)]
        [int] $TimeoutSeconds,

        [Parameter(Mandatory)]
        [string] $RepositoryRoot,

        [Parameter(Mandatory)]
        [hashtable] $Context
    )

    $parsed = ConvertFrom-CaptureSelector -Selector $Selector
    if ($null -eq $parsed) {
        return $Selector
    }

    $selectorKind = $parsed.Kind
    $selectorValue = $parsed.Value
    $searchCommand = [pscustomobject]@{
        FilePath = 'winapp'
        Arguments = @(
            'ui', 'search', $selectorValue,
            '--window', [string]$WindowHandle,
            '--max', '50',
            '--json'
        )
    }
    $searchResult = Invoke-WinAppUi `
        -Command $searchCommand `
        -RepositoryRoot $RepositoryRoot `
        -TimeoutSeconds $TimeoutSeconds `
        -Context $Context `
        -RequireSuccess
    $search = $searchResult.StandardOutput | ConvertFrom-Json -Depth 20
    if ($search.PSObject.Properties.Name -notcontains 'matches') {
        throw "WinApp search JSON for '$Selector' has no matches property."
    }

    $exactMatches = @(@($search.matches) | Where-Object {
        if ($selectorKind -eq 'automationid') {
            $_.PSObject.Properties.Name -contains 'automationId' -and
                [string]::Equals(
                    [string]$_.automationId,
                    $selectorValue,
                    [StringComparison]::OrdinalIgnoreCase)
        }
        else {
            $_.PSObject.Properties.Name -contains 'name' -and
                [string]::Equals(
                    [string]$_.name,
                    $selectorValue,
                    [StringComparison]::OrdinalIgnoreCase)
        }
    })
    if ($exactMatches.Count -ne 1) {
        throw "Selector '$Selector' resolved to $($exactMatches.Count) exact elements; expected one."
    }
    if ($exactMatches[0].PSObject.Properties.Name -notcontains 'selector' -or
        [string]::IsNullOrWhiteSpace($exactMatches[0].selector)) {
        throw "WinApp search result for '$Selector' has no semantic selector."
    }

    return [string]$exactMatches[0].selector
}

function Invoke-InvokableElement {
    param(
        [Parameter(Mandatory)]
        [string] $Selector,

        [Parameter(Mandatory)]
        [long] $WindowHandle,

        [Parameter(Mandatory)]
        [int] $TimeoutSeconds,

        [Parameter(Mandatory)]
        [string] $RepositoryRoot,

        [Parameter(Mandatory)]
        [hashtable] $Context
    )

    $invokeCommand = New-WinAppUiCommand `
        -Operation invoke `
        -Selector $Selector `
        -WindowHandle $WindowHandle
    $invokeResult = Invoke-WinAppUi `
        -Command $invokeCommand `
        -RepositoryRoot $RepositoryRoot `
        -TimeoutSeconds $TimeoutSeconds `
        -Context $Context
    if ($invokeResult.ExitCode -eq 0) {
        return
    }

    Write-HarnessLog -Context $Context -Level INFO -Message "InvokePattern was unavailable for '$Selector'; falling back to an exact UI click."
    $clickCommand = New-WinAppUiCommand `
        -Operation click `
        -Selector $Selector `
        -WindowHandle $WindowHandle
    Invoke-WinAppUi `
        -Command $clickCommand `
        -RepositoryRoot $RepositoryRoot `
        -TimeoutSeconds $TimeoutSeconds `
        -Context $Context `
        -RequireSuccess | Out-Null
}

function Test-PngImage {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $Path,

        [Parameter(Mandatory)]
        [int] $ExpectedWidth,

        [Parameter(Mandatory)]
        [int] $ExpectedHeight,

        [Parameter()]
        [ValidateRange(0.5, 1.0)]
        [double] $UniformThreshold = 0.985,

        [Parameter()]
        [object[]] $AdditionalAllowedDimensions = @()
    )

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "Screenshot '$Path' does not exist."
    }

    Add-Type -AssemblyName System.Drawing.Common
    $bitmap = [System.Drawing.Bitmap]::new($Path)
    try {
        $isPng = $bitmap.RawFormat.Guid -eq [System.Drawing.Imaging.ImageFormat]::Png.Guid
        $allowedDimensions = @(
            [pscustomobject]@{ Width = $ExpectedWidth; Height = $ExpectedHeight }
        ) + @($AdditionalAllowedDimensions | Where-Object {
            $null -ne $_ -and
            $_.PSObject.Properties.Name -contains 'Width' -and
            $_.PSObject.Properties.Name -contains 'Height'
        })
        $dimensionMatches = @($allowedDimensions | Where-Object {
            [int]$_.Width -eq $bitmap.Width -and [int]$_.Height -eq $bitmap.Height
        }).Count -gt 0
        $gridWidth = [Math]::Min(64, $bitmap.Width)
        $gridHeight = [Math]::Min(64, $bitmap.Height)
        $counts = @{}
        $channelSums = [double[]]::new(3)
        $channelSquares = [double[]]::new(3)
        $alphaSum = 0.0
        $sampleCount = 0

        for ($gridY = 0; $gridY -lt $gridHeight; $gridY++) {
            $y = if ($gridHeight -eq 1) { 0 } else {
                [int][Math]::Round($gridY * ($bitmap.Height - 1) / ($gridHeight - 1))
            }
            for ($gridX = 0; $gridX -lt $gridWidth; $gridX++) {
                $x = if ($gridWidth -eq 1) { 0 } else {
                    [int][Math]::Round($gridX * ($bitmap.Width - 1) / ($gridWidth - 1))
                }
                $color = $bitmap.GetPixel($x, $y)
                $alpha = $color.A / 255.0
                $alphaSum += $alpha
                $red = [int][Math]::Round(($color.R * $alpha) + (255 * (1 - $alpha)))
                $green = [int][Math]::Round(($color.G * $alpha) + (255 * (1 - $alpha)))
                $blue = [int][Math]::Round(($color.B * $alpha) + (255 * (1 - $alpha)))
                $quantized = '{0:X1}{1:X1}{2:X1}' -f @(
                    [int][Math]::Floor($red / 16),
                    [int][Math]::Floor($green / 16),
                    [int][Math]::Floor($blue / 16))
                $counts[$quantized] = 1 + [int]($counts[$quantized] ?? 0)
                $channels = @($red, $green, $blue)
                for ($channel = 0; $channel -lt 3; $channel++) {
                    $channelSums[$channel] += $channels[$channel]
                    $channelSquares[$channel] += $channels[$channel] * $channels[$channel]
                }
                $sampleCount++
            }
        }

        $dominantCount = ($counts.Values | Measure-Object -Maximum).Maximum
        $dominantFraction = if ($sampleCount -eq 0) { 1.0 } else { $dominantCount / $sampleCount }
        $visibleAlphaFraction = if ($sampleCount -eq 0) { 0.0 } else { $alphaSum / $sampleCount }
        $standardDeviations = for ($channel = 0; $channel -lt 3; $channel++) {
            $mean = $channelSums[$channel] / $sampleCount
            [Math]::Sqrt([Math]::Max(0, ($channelSquares[$channel] / $sampleCount) - ($mean * $mean)))
        }
        $mostlyUniform = $visibleAlphaFraction -lt 0.05 -or
            $dominantFraction -ge $UniformThreshold -or
            (($standardDeviations | Measure-Object -Maximum).Maximum -lt 3.0)

        return [pscustomobject]@{
            Path = [System.IO.Path]::GetFullPath($Path)
            IsPng = $isPng
            Width = $bitmap.Width
            Height = $bitmap.Height
            DimensionMatches = $dimensionMatches
            AllowedDimensions = @($allowedDimensions | ForEach-Object {
                '{0}x{1}' -f [int]$_.Width, [int]$_.Height
            } | Select-Object -Unique)
            SampleCount = $sampleCount
            VisibleAlphaFraction = [Math]::Round($visibleAlphaFraction, 6)
            DominantColorFraction = [Math]::Round($dominantFraction, 6)
            ChannelStandardDeviation = @($standardDeviations | ForEach-Object { [Math]::Round($_, 3) })
            MostlyUniform = $mostlyUniform
            Sha256 = (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
            IsValid = $isPng -and $dimensionMatches -and -not $mostlyUniform
        }
    }
    finally {
        $bitmap.Dispose()
    }
}

function Write-CaptureReport {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [System.Collections.IDictionary] $Report,

        [Parameter(Mandatory)]
        [string] $Path
    )

    $directory = Split-Path -Parent $Path
    [System.IO.Directory]::CreateDirectory($directory) | Out-Null
    $json = $Report | ConvertTo-Json -Depth 30
    [System.IO.File]::WriteAllText($Path, "$json$([Environment]::NewLine)")
}

function Write-CaptureContactSheet {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [System.Collections.IDictionary] $Report,

        [Parameter(Mandatory)]
        [string] $Path
    )

    $encode = {
        param([object] $Value)
        [System.Net.WebUtility]::HtmlEncode([string]$Value)
    }
    $cards = foreach ($result in $Report.results) {
        $title = & $encode "$($result.projectFolder) — $($result.screenshotId)"
        $status = & $encode $result.status
        $alt = & $encode $result.alt
        $details = & $encode ($result.reason ?? '')
        $image = if ($result.status -eq 'captured' -and $result.reviewImage) {
            $source = & $encode ($result.reviewImage -replace '\\', '/')
            "<img src=`"$source`" alt=`"$alt`" loading=`"lazy`">"
        }
        else {
            "<div class=`"placeholder`">$details</div>"
        }
        @"
<article>
  <h2>$title</h2>
  <p class="status $status">$status</p>
  $image
  <p>$alt</p>
</article>
"@
    }

    $runId = & $encode $Report.runId
    $html = @"
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>WinUI sample capture $runId</title>
  <style>
    :root { color-scheme: light dark; font-family: system-ui, sans-serif; }
    body { margin: 2rem; }
    main { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.5rem; }
    article { border: 1px solid #8888; border-radius: .5rem; padding: 1rem; overflow: hidden; }
    h1, h2 { margin-top: 0; }
    h2 { font-size: 1rem; }
    img { width: 100%; height: auto; border: 1px solid #8886; }
    .placeholder { min-height: 12rem; display: grid; place-items: center; background: #8882; padding: 1rem; }
    .status { font-weight: 700; text-transform: uppercase; font-size: .75rem; }
    .captured { color: #168038; }
    .failed { color: #c42b1c; }
  </style>
</head>
<body>
  <h1>WinUI sample captures</h1>
  <p>Run <code>$runId</code>. Optimization is intentionally deferred to the site pipeline.</p>
  <main>
$($cards -join "`n")
  </main>
</body>
</html>
"@
    [System.IO.Directory]::CreateDirectory((Split-Path -Parent $Path)) | Out-Null
    [System.IO.File]::WriteAllText($Path, $html)
}

function Stop-OwnedProcess {
    param(
        [Parameter(Mandatory)]
        [int] $ProcessId,

        [Parameter(Mandatory)]
        [string] $PackageOutputPath,

        [Parameter(Mandatory)]
        [string] $ExpectedExecutableName,

        [Parameter(Mandatory)]
        [hashtable] $Context
    )

    $process = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
    if ($null -eq $process -or $process.HasExited) {
        return
    }
    try {
        $processPath = [System.IO.Path]::GetFullPath($process.Path)
    }
    catch {
        throw "Process $ProcessId was not stopped because its executable path could not be validated."
    }

    $isOwned = (Test-PathWithinRoot -Path $processPath -Root $PackageOutputPath) -and
        [System.IO.Path]::GetFileName($processPath).Equals(
            $ExpectedExecutableName,
            [StringComparison]::OrdinalIgnoreCase)
    if (-not $isOwned) {
        throw "Process $ProcessId at '$processPath' was not stopped because run ownership could not be proven."
    }

    Write-HarnessLog -Context $Context -Level INFO -Message "Stopping exact launched process ID $ProcessId."
    Stop-Process -Id $ProcessId -Force -ErrorAction Stop
    if (-not $process.WaitForExit(10000)) {
        throw "Run-owned process $ProcessId did not exit within 10 seconds."
    }
}

function Select-OwnedHarnessPackages {
    param(
        [Parameter(Mandatory)]
        [AllowEmptyCollection()]
        [object[]] $Packages,

        [Parameter(Mandatory)]
        [string] $PackageIdentityName,

        [Parameter(Mandatory)]
        [string] $OwnedRoot
    )

    $owned = [System.Collections.Generic.List[object]]::new()
    foreach ($package in $Packages) {
        if ($package.PSObject.Properties.Name -notcontains 'Name' -or
            -not ([string]$package.Name).Equals(
                $PackageIdentityName,
                [StringComparison]::OrdinalIgnoreCase) -or
            -not [bool]$package.IsDevelopmentMode) {
            continue
        }
        $installLocation = [string]$package.InstallLocation
        if ($installLocation -and
            (Test-PathWithinOrEqualRoot -Path $installLocation -Root $OwnedRoot)) {
            $owned.Add($package)
        }
    }
    return $owned.ToArray()
}

function Remove-HarnessPackage {
    param(
        [Parameter(Mandatory)]
        [string] $PackageIdentityName,

        [Parameter(Mandatory)]
        [string] $OwnedRoot,

        [Parameter(Mandatory)]
        [bool] $PackageExistedBefore,

        [Parameter(Mandatory)]
        [hashtable] $Context
    )

    if ($PackageExistedBefore) {
        throw "Package '$PackageIdentityName' existed before the run and will not be unregistered."
    }

    $packages = @(Get-ExistingPackage -PackageIdentityName $PackageIdentityName)
    $ownedPackages = @(Select-OwnedHarnessPackages `
        -Packages $packages `
        -PackageIdentityName $PackageIdentityName `
        -OwnedRoot $OwnedRoot)
    $ownedPackageFullNames = @($ownedPackages | ForEach-Object { [string]$_.PackageFullName })
    $unownedPackageFullNames = [System.Collections.Generic.List[string]]::new()
    foreach ($package in $packages) {
        if ([string]$package.PackageFullName -in $ownedPackageFullNames) {
            Write-HarnessLog -Context $Context -Level INFO -Message "Unregistering exact harness package '$($package.PackageFullName)'."
            Remove-AppxPackage -Package $package.PackageFullName -ErrorAction Stop
        }
        else {
            Write-HarnessLog -Context $Context -Level WARN -Message "Package '$($package.PackageFullName)' was not removed because ownership could not be proven."
            $unownedPackageFullNames.Add([string]$package.PackageFullName)
        }
    }
    if ($unownedPackageFullNames.Count -gt 0) {
        throw "Temporary identity '$PackageIdentityName' has registration(s) outside the run work directory: $($unownedPackageFullNames -join ', ')."
    }
}

function Set-HarnessTheme {
    param(
        [Parameter(Mandatory)]
        [ValidateSet('system', 'light', 'dark')]
        [string] $Theme,

        [Parameter(Mandatory)]
        [hashtable] $Context
    )

    if ($Theme -eq 'system') {
        return $null
    }

    $keyPath = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize'
    $propertyName = 'AppsUseLightTheme'
    $properties = Get-ItemProperty -LiteralPath $keyPath -ErrorAction Stop
    $hadValue = $properties.PSObject.Properties.Name -contains $propertyName
    $oldValue = if ($hadValue) { [int]$properties.$propertyName } else { $null }
    $newValue = if ($Theme -eq 'light') { 1 } else { 0 }
    Set-ItemProperty -LiteralPath $keyPath -Name $propertyName -Type DWord -Value $newValue
    Write-HarnessLog -Context $Context -Level INFO -Message "Set current-user app theme to $Theme for newly launched samples."

    return [pscustomobject]@{
        KeyPath = $keyPath
        PropertyName = $propertyName
        HadValue = $hadValue
        OldValue = $oldValue
    }
}

function Restore-HarnessTheme {
    param(
        [Parameter()]
        [AllowNull()]
        [pscustomobject] $State,

        [Parameter(Mandatory)]
        [hashtable] $Context
    )

    if ($null -eq $State) {
        return
    }

    if ($State.HadValue) {
        Set-ItemProperty `
            -LiteralPath $State.KeyPath `
            -Name $State.PropertyName `
            -Type DWord `
            -Value $State.OldValue
    }
    else {
        Remove-ItemProperty -LiteralPath $State.KeyPath -Name $State.PropertyName -ErrorAction SilentlyContinue
    }
    Write-HarnessLog -Context $Context -Level INFO -Message 'Restored the current-user app theme setting.'
}

function Get-CaptureSkipReason {
    param(
        [Parameter(Mandatory)]
        [pscustomobject] $Sample,

        [Parameter(Mandatory)]
        [pscustomobject] $Screenshot
    )

    if ($Screenshot.capture.mode -eq 'manual') {
        return 'Metadata marks this capture recipe as manual.'
    }
    if ('x64' -notin @($Sample.requirements.supportedArchitectures)) {
        return 'The sample metadata does not support the harness x64 target.'
    }

    return $null
}

function Test-RequiresScreenCapture {
    param(
        [Parameter(Mandatory)]
        [pscustomobject] $Screenshot,

        [Parameter(Mandatory)]
        [bool] $ForceScreenCapture
    )

    if ($ForceScreenCapture) {
        return $true
    }

    $notes = if ($Screenshot.capture.PSObject.Properties.Name -contains 'notes') {
        [string]$Screenshot.capture.notes
    }
    else {
        ''
    }
    return $notes -match '(?i)\b(popup|overlay|flyout|open menu|context menu)\b'
}

function Get-PreexistingProcessIds {
    param(
        [Parameter(Mandatory)]
        [string] $ExpectedProcessName
    )

    return @(Get-Process -ErrorAction SilentlyContinue |
        Where-Object { $_.ProcessName.Equals($ExpectedProcessName, [StringComparison]::OrdinalIgnoreCase) } |
        Select-Object -ExpandProperty Id)
}

function Invoke-OneCapture {
    param(
        [Parameter(Mandatory)]
        [pscustomobject] $Sample,

        [Parameter(Mandatory)]
        [pscustomobject] $Screenshot,

        [Parameter(Mandatory)]
        [pscustomobject] $Identity,

        [Parameter(Mandatory)]
        [pscustomobject] $BuildOutput,

        [Parameter(Mandatory)]
        [string] $CaptureIdentityName,

        [Parameter(Mandatory)]
        [string] $MakePriPath,

        [Parameter(Mandatory)]
        [string] $TemporaryDirectory,

        [Parameter(Mandatory)]
        [string] $RepositoryRoot,

        [Parameter(Mandatory)]
        [int] $WindowX,

        [Parameter(Mandatory)]
        [int] $WindowY,

        [Parameter(Mandatory)]
        [int] $WindowWidth,

        [Parameter(Mandatory)]
        [int] $WindowHeight,

        [Parameter(Mandatory)]
        [int] $TimeoutSeconds,

        [Parameter(Mandatory)]
        [int] $StabilityMilliseconds,

        [Parameter(Mandatory)]
        [bool] $ForceScreenCapture,

        [Parameter(Mandatory)]
        [bool] $AllowNon100PercentScaling,

        [Parameter(Mandatory)]
        [hashtable] $Context
    )

    $TemporaryDirectory = [System.IO.Path]::GetFullPath($TemporaryDirectory)
    [System.IO.Directory]::CreateDirectory($TemporaryDirectory) | Out-Null
    $stagingRoot = Join-Path $TemporaryDirectory 'staged'
    $packageOutputPath = Join-Path $TemporaryDirectory 'appx'
    $winAppStdoutPath = Join-Path $TemporaryDirectory 'winapp.stdout.log'
    $winAppStderrPath = Join-Path $TemporaryDirectory 'winapp.stderr.log'
    $temporaryScreenshotPath = Join-Path $TemporaryDirectory 'capture.png'
    $preexistingPackages = @(Get-ExistingPackage -PackageIdentityName $CaptureIdentityName)
    if ($preexistingPackages.Count -gt 0) {
        $locations = @($preexistingPackages | ForEach-Object { $_.InstallLocation }) -join ', '
        throw "Temporary capture identity '$CaptureIdentityName' is already registered at '$locations'. The harness will not replace, reuse, or unregister it."
    }

    $preexistingProcessIds = @(Get-PreexistingProcessIds -ExpectedProcessName $Identity.ExpectedProcessName)
    if ($preexistingProcessIds.Count -gt 0) {
        throw "Process '$($Identity.ExpectedProcessName)' is already running (PID $($preexistingProcessIds -join ', ')); close it before capture."
    }

    $isolatedLayout = New-IsolatedPackageLayout `
        -Identity $Identity `
        -BuildOutput $BuildOutput `
        -StagingRoot $stagingRoot `
        -OwnedRoot $TemporaryDirectory `
        -CaptureIdentityName $CaptureIdentityName `
        -MakePriPath $MakePriPath `
        -RepositoryRoot $RepositoryRoot `
        -Context $Context
    $runCommand = New-WinAppRunCommand `
        -InputFolder $isolatedLayout.InputFolder `
        -ManifestPath $isolatedLayout.ManifestPath `
        -PackageOutputPath $packageOutputPath
    $trackedWinApp = $null
    $launchedWindow = $null
    $observedProcessIds = [System.Collections.Generic.HashSet[int]]::new()
    try {
        $trackedWinApp = Start-CapturedProcess `
            -FilePath $runCommand.FilePath `
            -ArgumentList $runCommand.Arguments `
            -WorkingDirectory $RepositoryRoot `
            -Context $Context
        $launchedWindow = Wait-ForLaunchedWindow `
            -Identity $Identity `
            -BuildOutput $BuildOutput `
            -PackageOutputPath $packageOutputPath `
            -PreexistingProcessIds $preexistingProcessIds `
            -WinAppProcess $trackedWinApp `
            -ObservedProcessIds $observedProcessIds `
            -TimeoutSeconds $TimeoutSeconds `
            -RepositoryRoot $RepositoryRoot `
            -Context $Context
        $bounds = Invoke-WindowBoundsHelper `
            -Arguments @(
                'set-bounds',
                '--hwnd', [string]$launchedWindow.Hwnd,
                '--process-id', [string]$launchedWindow.ProcessId,
                '--x', [string]$WindowX,
                '--y', [string]$WindowY,
                '--width', [string]$WindowWidth,
                '--height', [string]$WindowHeight
            ) `
            -RepositoryRoot $RepositoryRoot `
            -Context $Context
        if (-not $AllowNon100PercentScaling -and [int]$bounds.dpi -ne 96) {
            throw "Target window DPI must be 96 (100% scaling); found $($bounds.dpi). Use -AllowNon100PercentScaling only for diagnostics."
        }

        $actions = if ($Screenshot.capture.PSObject.Properties.Name -contains 'actions') {
            @($Screenshot.capture.actions)
        }
        else {
            @()
        }
        foreach ($action in $actions) {
            Invoke-CaptureAction `
                -Action $action `
                -WindowHandle $launchedWindow.Hwnd `
                -TimeoutSeconds $TimeoutSeconds `
                -RepositoryRoot $RepositoryRoot `
                -Context $Context
        }

        $readinessCommand = New-WinAppUiCommand `
            -Operation wait-for `
            -Selector $Screenshot.capture.readinessSelector `
            -WindowHandle $launchedWindow.Hwnd `
            -TimeoutMilliseconds ($TimeoutSeconds * 1000)
        Invoke-WinAppUi `
            -Command $readinessCommand `
            -RepositoryRoot $RepositoryRoot `
            -TimeoutSeconds ($TimeoutSeconds + 5) `
            -Context $Context `
            -RequireSuccess | Out-Null

        Start-Sleep -Milliseconds $StabilityMilliseconds
        $captureScreen = Test-RequiresScreenCapture `
            -Screenshot $Screenshot `
            -ForceScreenCapture $ForceScreenCapture
        $screenshotCommand = New-WinAppUiCommand `
            -Operation screenshot `
            -WindowHandle $launchedWindow.Hwnd `
            -OutputPath $temporaryScreenshotPath `
            -CaptureScreen:$captureScreen
        $captureResult = Invoke-WinAppUi `
            -Command $screenshotCommand `
            -RepositoryRoot $RepositoryRoot `
            -TimeoutSeconds $TimeoutSeconds `
            -Context $Context `
            -RequireSuccess

        if (-not (Test-Path -LiteralPath $temporaryScreenshotPath -PathType Leaf)) {
            $reportedPath = $null
            try {
                $captureJson = $captureResult.StandardOutput | ConvertFrom-Json -Depth 10
                $captureItem = @($captureJson)[0]
                if ($captureItem.PSObject.Properties.Name -contains 'filePath') {
                    $reportedPath = [string]$captureItem.filePath
                }
            }
            catch {
                $reportedPath = $null
            }
            if ($reportedPath) {
                $reportedPath = [System.IO.Path]::GetFullPath($reportedPath, $RepositoryRoot)
            }
            if ($reportedPath -and
                (Test-PathWithinRoot -Path $reportedPath -Root $TemporaryDirectory) -and
                [System.IO.Path]::GetExtension($reportedPath).Equals(
                    '.png',
                    [StringComparison]::OrdinalIgnoreCase) -and
                (Test-Path -LiteralPath $reportedPath -PathType Leaf)) {
                $temporaryScreenshotPath = $reportedPath
            }
            else {
                throw "WinApp CLI reported success but did not create a PNG inside '$TemporaryDirectory'."
            }
        }

        $additionalAllowedDimensions = @(
            $bounds.after.client,
            $bounds.after.extendedFrame
        )
        if ($captureScreen) {
            $screen = Invoke-WindowBoundsHelper `
                -Arguments @('system-info') `
                -RepositoryRoot $RepositoryRoot `
                -Context $Context
            $additionalAllowedDimensions += $screen.virtualScreen
        }
        $image = Test-PngImage `
            -Path $temporaryScreenshotPath `
            -ExpectedWidth $WindowWidth `
            -ExpectedHeight $WindowHeight `
            -AdditionalAllowedDimensions $additionalAllowedDimensions
        if (-not $image.IsValid) {
            throw "Captured image failed validation: PNG=$($image.IsPng), dimensions=$($image.Width)x$($image.Height), expected=${WindowWidth}x${WindowHeight}, mostlyUniform=$($image.MostlyUniform)."
        }

        return [pscustomobject]@{
            TemporaryScreenshotPath = $temporaryScreenshotPath
            Image = $image
            Window = $launchedWindow
            Bounds = $bounds
            CaptureScreen = $captureScreen
            PackageIdentityName = $CaptureIdentityName
            SourcePackageIdentityName = $Identity.PackageIdentityName
            IsolatedLayout = $isolatedLayout
            RunCommand = $runCommand
            ReadinessCommand = $readinessCommand
            ScreenshotCommand = $screenshotCommand
        }
    }
    finally {
        $cleanupErrors = [System.Collections.Generic.List[string]]::new()
        try {
            Add-ValidatedLaunchedProcessIds `
                -Identity $Identity `
                -BuildOutput $BuildOutput `
                -PackageOutputPath $packageOutputPath `
                -PreexistingProcessIds $preexistingProcessIds `
                -ObservedProcessIds $observedProcessIds
        }
        catch {
            $cleanupErrors.Add("Failed to discover run-owned processes during cleanup: $($_.Exception.Message)")
        }
        if ($null -ne $launchedWindow) {
            [void]$observedProcessIds.Add([int]$launchedWindow.ProcessId)
        }
        foreach ($launchedProcessId in @($observedProcessIds)) {
            try {
                Stop-OwnedProcess `
                    -ProcessId $launchedProcessId `
                    -PackageOutputPath $packageOutputPath `
                    -ExpectedExecutableName "$($BuildOutput.TargetName).exe" `
                    -Context $Context
            }
            catch {
                $cleanupErrors.Add("Failed to stop run-owned process $launchedProcessId`: $($_.Exception.Message)")
            }
        }
        if ($null -ne $trackedWinApp) {
            try {
                Complete-CapturedProcess `
                    -TrackedProcess $trackedWinApp `
                    -StandardOutputPath $winAppStdoutPath `
                    -StandardErrorPath $winAppStderrPath `
                    -Context $Context | Out-Null
            }
            catch {
                $cleanupErrors.Add("Failed to complete the exact WinApp CLI process: $($_.Exception.Message)")
            }
        }
        try {
            Remove-HarnessPackage `
                -PackageIdentityName $CaptureIdentityName `
                -OwnedRoot $TemporaryDirectory `
                -PackageExistedBefore ($preexistingPackages.Count -gt 0) `
                -Context $Context
        }
        catch {
            $cleanupErrors.Add("Failed to unregister the run-owned package: $($_.Exception.Message)")
        }
        if ($cleanupErrors.Count -gt 0) {
            foreach ($cleanupError in $cleanupErrors) {
                Write-HarnessLog -Context $Context -Level ERROR -Message $cleanupError
            }
            throw "Capture cleanup failed: $($cleanupErrors -join ' ')"
        }
    }
}

function Add-DuplicateGroups {
    param(
        [Parameter(Mandatory)]
        [System.Collections.IDictionary] $Report
    )

    $captured = @($Report.results | Where-Object { $_.status -eq 'captured' -and $_.sha256 })
    $groups = @($captured |
        Group-Object sha256 |
        Where-Object Count -gt 1 |
        ForEach-Object {
            [ordered]@{
                sha256 = $_.Name
                captures = @($_.Group | ForEach-Object {
                    "$($_.projectFolder)/$($_.screenshotId)"
                })
            }
        })
    $Report.duplicateGroups = $groups
}

function Get-DryRunCommands {
    param(
        [Parameter(Mandatory)]
        [pscustomobject] $Identity,

        [Parameter(Mandatory)]
        [pscustomobject] $Screenshot,

        [Parameter(Mandatory)]
        [string] $PackageOutputPath,

        [Parameter()]
        [string] $CaptureIdentityName = '<temporary-capture-identity>',

        [Parameter(Mandatory)]
        [int] $WindowX,

        [Parameter(Mandatory)]
        [int] $WindowY,

        [Parameter(Mandatory)]
        [int] $WindowWidth,

        [Parameter(Mandatory)]
        [int] $WindowHeight,

        [Parameter(Mandatory)]
        [int] $TimeoutSeconds,

        [Parameter(Mandatory)]
        [int] $StabilityMilliseconds,

        [Parameter(Mandatory)]
        [bool] $ForceScreenCapture
    )

    $windowPlaceholder = 123456
    $commands = [System.Collections.Generic.List[string]]::new()
    $build = New-SampleBuildCommand -Identity $Identity
    $commands.Add((ConvertTo-DisplayCommand -FilePath $build.FilePath -ArgumentList $build.Arguments))

    $captureWorkDirectory = Split-Path -Parent $PackageOutputPath
    $stagingRoot = Join-Path $captureWorkDirectory 'staged'
    $commands.Add(
        "Stage build appxrecipe into '$stagingRoot'; set only staged Identity.Name to '$CaptureIdentityName'; regenerate staged resources.pri with MakePri")
    $run = New-WinAppRunCommand `
        -InputFolder $stagingRoot `
        -ManifestPath (Join-Path $stagingRoot 'AppxManifest.xml') `
        -PackageOutputPath $PackageOutputPath
    $commands.Add((ConvertTo-DisplayCommand -FilePath $run.FilePath -ArgumentList $run.Arguments))
    $commands.Add((ConvertTo-DisplayCommand `
        -FilePath 'winapp' `
        -ArgumentList @('ui', 'list-windows', '--app', $Identity.ExpectedProcessName, '--json')))
    $commands.Add((ConvertTo-DisplayCommand `
        -FilePath 'dotnet' `
        -ArgumentList @(
            $script:BoundsDll,
            'set-bounds',
            '--hwnd', '<validated-hwnd>',
            '--process-id', '<launched-pid>',
            '--x', [string]$WindowX,
            '--y', [string]$WindowY,
            '--width', [string]$WindowWidth,
            '--height', [string]$WindowHeight
        )))

    $actions = if ($Screenshot.capture.PSObject.Properties.Name -contains 'actions') {
        @($Screenshot.capture.actions)
    }
    else {
        @()
    }
    $addSelectorResolution = {
        param([string] $Selector)
        $parsed = ConvertFrom-CaptureSelector -Selector $Selector
        if ($null -ne $parsed) {
            $searchValue = $parsed.Value
            $commands.Add((ConvertTo-DisplayCommand `
                -FilePath 'winapp' `
                -ArgumentList @(
                    'ui', 'search', $searchValue,
                    '--window', [string]$windowPlaceholder,
                    '--max', '50',
                    '--json'
                )))
            return "<unique-semantic-selector-for:$Selector>"
        }
        return $Selector
    }
    foreach ($action in $actions) {
        if ($action.type -in @('input', 'select', 'click')) {
            $actionReady = New-WinAppUiCommand `
                -Operation wait-for `
                -Selector $action.selector `
                -WindowHandle $windowPlaceholder `
                -TimeoutMilliseconds ($TimeoutSeconds * 1000)
            $commands.Add((ConvertTo-DisplayCommand `
                -FilePath $actionReady.FilePath `
                -ArgumentList $actionReady.Arguments))
        }
        switch ($action.type) {
            'wait' {
                $commands.Add("Start-Sleep -Milliseconds $([int]$action.durationMs)")
            }
            'input' {
                $resolvedSelector = & $addSelectorResolution $action.selector
                $command = New-WinAppUiCommand `
                    -Operation set-value `
                    -Selector $resolvedSelector `
                    -Value ([string]$action.value) `
                    -WindowHandle $windowPlaceholder
                $commands.Add((ConvertTo-DisplayCommand -FilePath $command.FilePath -ArgumentList $command.Arguments))
            }
            'click' {
                $resolvedSelector = & $addSelectorResolution $action.selector
                $invokeCommand = New-WinAppUiCommand `
                    -Operation invoke `
                    -Selector $resolvedSelector `
                    -WindowHandle $windowPlaceholder
                $commands.Add("TRY " + (ConvertTo-DisplayCommand `
                    -FilePath $invokeCommand.FilePath `
                    -ArgumentList $invokeCommand.Arguments))
                $clickCommand = New-WinAppUiCommand `
                    -Operation click `
                    -Selector $resolvedSelector `
                    -WindowHandle $windowPlaceholder
                $commands.Add("FALLBACK_ON_INVOKE_FAILURE " + (ConvertTo-DisplayCommand `
                    -FilePath $clickCommand.FilePath `
                    -ArgumentList $clickCommand.Arguments))
            }
            'select' {
                $resolvedSelector = & $addSelectorResolution $action.selector
                $openCommand = New-WinAppUiCommand `
                    -Operation invoke `
                    -Selector $resolvedSelector `
                    -WindowHandle $windowPlaceholder
                $commands.Add((ConvertTo-DisplayCommand -FilePath $openCommand.FilePath -ArgumentList $openCommand.Arguments))
                $waitForValue = New-WinAppUiCommand `
                    -Operation wait-for `
                    -Selector ([string]$action.value) `
                    -WindowHandle $windowPlaceholder `
                    -TimeoutMilliseconds ($TimeoutSeconds * 1000)
                $commands.Add((ConvertTo-DisplayCommand -FilePath $waitForValue.FilePath -ArgumentList $waitForValue.Arguments))
                $selectCommand = New-WinAppUiCommand `
                    -Operation invoke `
                    -Selector ([string]$action.value) `
                    -WindowHandle $windowPlaceholder
                $commands.Add("TRY " + (ConvertTo-DisplayCommand `
                    -FilePath $selectCommand.FilePath `
                    -ArgumentList $selectCommand.Arguments))
                $selectFallback = New-WinAppUiCommand `
                    -Operation click `
                    -Selector ([string]$action.value) `
                    -WindowHandle $windowPlaceholder
                $commands.Add("FALLBACK_ON_INVOKE_FAILURE " + (ConvertTo-DisplayCommand `
                    -FilePath $selectFallback.FilePath `
                    -ArgumentList $selectFallback.Arguments))
            }
        }
    }

    $readiness = New-WinAppUiCommand `
        -Operation wait-for `
        -Selector $Screenshot.capture.readinessSelector `
        -WindowHandle $windowPlaceholder `
        -TimeoutMilliseconds ($TimeoutSeconds * 1000)
    $commands.Add((ConvertTo-DisplayCommand -FilePath $readiness.FilePath -ArgumentList $readiness.Arguments))
    $commands.Add("Start-Sleep -Milliseconds $StabilityMilliseconds")
    $screenCapture = Test-RequiresScreenCapture `
        -Screenshot $Screenshot `
        -ForceScreenCapture $ForceScreenCapture
    $screenshotCommand = New-WinAppUiCommand `
        -Operation screenshot `
        -WindowHandle $windowPlaceholder `
        -OutputPath '<run-work>\capture.png' `
        -CaptureScreen:$screenCapture
    $commands.Add((ConvertTo-DisplayCommand `
        -FilePath $screenshotCommand.FilePath `
        -ArgumentList $screenshotCommand.Arguments))
    return $commands.ToArray()
}

function Invoke-SampleScreenshotHarness {
    [CmdletBinding()]
    param(
        [Parameter()]
        [string[]] $Sample,

        [Parameter()]
        [switch] $All,

        [Parameter()]
        [switch] $DryRun,

        [Parameter()]
        [string] $RepositoryRoot = $script:DefaultRepositoryRoot,

        [Parameter()]
        [string] $OutputRoot = $script:DefaultRepositoryRoot,

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
        [switch] $Quiet
    )

    $repositoryRoot = [System.IO.Path]::GetFullPath($RepositoryRoot)
    $outputRoot = [System.IO.Path]::GetFullPath($OutputRoot)
    [System.IO.Directory]::CreateDirectory($outputRoot) | Out-Null

    $runId = '{0:yyyyMMdd-HHmmss}-{1}' -f [DateTimeOffset]::UtcNow, ([Guid]::NewGuid().ToString('N').Substring(0, 8))
    $runDirectory = Join-Path $outputRoot "artifacts\screenshot-captures\$runId"
    $resultsDirectory = Join-Path $runDirectory 'results'
    [System.IO.Directory]::CreateDirectory($resultsDirectory) | Out-Null
    $context = @{
        LogPath = Join-Path $runDirectory 'run.log'
        Quiet = [bool]$Quiet
    }
    [System.IO.File]::WriteAllText($context.LogPath, '')

    $reportPath = Join-Path $runDirectory 'run.json'
    $contactSheetPath = Join-Path $runDirectory 'contact-sheet.html'
    $planPath = Join-Path $runDirectory 'capture-plan.json'
    $report = [ordered]@{
        schemaVersion = 1
        runId = $runId
        status = 'running'
        startedAt = [DateTimeOffset]::UtcNow.ToString('o')
        completedAt = $null
        repositoryRoot = $repositoryRoot
        outputRoot = $outputRoot
        reportPath = $reportPath
        contactSheetPath = $contactSheetPath
        options = [ordered]@{
            sample = @($Sample | Where-Object { $null -ne $_ })
            all = [bool]$All
            dryRun = [bool]$DryRun
            theme = $Theme
            window = [ordered]@{
                x = $WindowX
                y = $WindowY
                width = $WindowWidth
                height = $WindowHeight
            }
            timeoutSeconds = $TimeoutSeconds
            stabilityMilliseconds = $StabilityMilliseconds
            preserveFailureArtifacts = $PreserveFailureArtifacts
            overwrite = [bool]$Overwrite
            allowNon100PercentScaling = [bool]$AllowNon100PercentScaling
            forceScreenCapture = [bool]$CaptureScreen
        }
        environment = $null
        coverage = $null
        optimization = [ordered]@{
            webDerivative = $null
            reason = 'No repository-pinned deterministic Windows image optimizer is available; PNG optimization is deferred to the site pipeline.'
        }
        results = [System.Collections.Generic.List[object]]::new()
        duplicateGroups = @()
        counts = $null
        errors = [System.Collections.Generic.List[string]]::new()
    }

    $themeState = $null
    try {
        Write-HarnessLog -Context $context -Level INFO -Message "Starting screenshot run $runId."
        $plan = Get-ScreenshotCapturePlan `
            -RepositoryRoot $repositoryRoot `
            -OutputPath $planPath `
            -Context $context
        $report.coverage = $plan.coverage
        $selected = @(Select-CaptureSamples -Plan $plan -Sample $Sample -All:$All)
        if ($selected.Count -eq 0) {
            throw 'No sample metadata matched the requested selection.'
        }

        $plannedOutputOwners = [System.Collections.Generic.Dictionary[string, string]]::new(
            [StringComparer]::OrdinalIgnoreCase)
        foreach ($selectedSample in $selected) {
            $selectedSample | Add-Member `
                -NotePropertyName identity `
                -NotePropertyValue (Resolve-SampleIdentity -Sample $selectedSample -RepositoryRoot $repositoryRoot)
            $captureBlockReason = $null
            if (-not $DryRun) {
                $automaticRecipes = @(@($selectedSample.screenshots) | Where-Object {
                    $null -eq (Get-CaptureSkipReason -Sample $selectedSample -Screenshot $_)
                })
                if ($automaticRecipes.Count -gt 0) {
                    $existingProcesses = @(Get-PreexistingProcessIds `
                        -ExpectedProcessName $selectedSample.identity.ExpectedProcessName)
                    if ($existingProcesses.Count -gt 0) {
                        $captureBlockReason = "Process '$($selectedSample.identity.ExpectedProcessName)' is already running (PID $($existingProcesses -join ', ')); close it before capture."
                    }
                }
            }
            $selectedSample | Add-Member `
                -NotePropertyName captureBlockReason `
                -NotePropertyValue $captureBlockReason

            for ($index = 0; $index -lt @($selectedSample.screenshots).Count; $index++) {
                $screenshot = @($selectedSample.screenshots)[$index]
                $fileName = if ($index -eq 0) { 'hero.png' } else { "$($screenshot.id).png" }
                $destination = Join-Path $outputRoot "Samples\$($selectedSample.project.folder)\media\$fileName"
                $destination = [System.IO.Path]::GetFullPath($destination)
                $owner = "$($selectedSample.project.folder)/$($screenshot.id)"
                if ($plannedOutputOwners.ContainsKey($destination)) {
                    throw "Capture output collision: '$owner' and '$($plannedOutputOwners[$destination])' both map to '$destination'."
                }
                $plannedOutputOwners.Add($destination, $owner)
                $skipReason = Get-CaptureSkipReason -Sample $selectedSample -Screenshot $screenshot
                if (-not $DryRun -and
                    -not $skipReason -and
                    (Test-Path -LiteralPath $destination) -and
                    -not $Overwrite) {
                    throw "Output '$destination' already exists. Use -Overwrite to replace it only after a new capture validates."
                }
            }
        }

        $report.environment = Test-HarnessPrerequisites `
            -Samples $selected `
            -RepositoryRoot $repositoryRoot `
            -OutputRoot $outputRoot `
            -WindowX $WindowX `
            -WindowY $WindowY `
            -WindowWidth $WindowWidth `
            -WindowHeight $WindowHeight `
            -MinimumFreeSpaceGB $MinimumFreeSpaceGB `
            -AllowNon100PercentScaling ([bool]$AllowNon100PercentScaling) `
            -DryRun ([bool]$DryRun) `
            -Context $context
        $hasRunnableCapture = $false
        foreach ($candidateSample in $selected) {
            if ($candidateSample.captureBlockReason) {
                continue
            }
            $candidateRecipes = @(@($candidateSample.screenshots) | Where-Object {
                $null -eq (Get-CaptureSkipReason -Sample $candidateSample -Screenshot $_)
            })
            if ($candidateRecipes.Count -gt 0) {
                $hasRunnableCapture = $true
                break
            }
        }
        if (-not $DryRun -and $hasRunnableCapture) {
            $themeState = Set-HarnessTheme -Theme $Theme -Context $context
        }

        foreach ($selectedSample in $selected) {
            $identity = $selectedSample.identity
            $buildOutput = $null
            $sampleBlockReason = $selectedSample.captureBlockReason
            $automaticScreenshots = @(@($selectedSample.screenshots) | Where-Object {
                $null -eq (Get-CaptureSkipReason -Sample $selectedSample -Screenshot $_)
            })

            if ($DryRun) {
                foreach ($screenshot in @($selectedSample.screenshots)) {
                    $skipReason = Get-CaptureSkipReason -Sample $selectedSample -Screenshot $screenshot
                    $index = [Array]::IndexOf(@($selectedSample.screenshots), $screenshot)
                    $fileName = if ($index -eq 0) { 'hero.png' } else { "$($screenshot.id).png" }
                    $plannedWork = Join-Path $runDirectory "work\$($selectedSample.project.folder)\$($screenshot.id)\appx"
                    $captureIdentityName = New-CapturePackageIdentity `
                        -SampleId $selectedSample.id `
                        -ScreenshotId $screenshot.id `
                        -RunId $runId
                    $report.results.Add([ordered]@{
                        sampleId = $selectedSample.id
                        projectFolder = $selectedSample.project.folder
                        screenshotId = $screenshot.id
                        alt = $screenshot.alt
                        status = if ($skipReason) { 'manual' } else { 'planned' }
                        reason = $skipReason
                        output = "Samples\$($selectedSample.project.folder)\media\$fileName"
                        reviewImage = $null
                        packageIdentityName = if ($skipReason) { $null } else { $captureIdentityName }
                        commands = if ($skipReason) {
                            @()
                        }
                        else {
                            @(Get-DryRunCommands `
                                -Identity $identity `
                                -Screenshot $screenshot `
                                -PackageOutputPath $plannedWork `
                                -CaptureIdentityName $captureIdentityName `
                                -WindowX $WindowX `
                                -WindowY $WindowY `
                                -WindowWidth $WindowWidth `
                                -WindowHeight $WindowHeight `
                                -TimeoutSeconds $TimeoutSeconds `
                                -StabilityMilliseconds $StabilityMilliseconds `
                                -ForceScreenCapture ([bool]$CaptureScreen))
                        }
                    })
                }
                continue
            }

            if ($automaticScreenshots.Count -gt 0 -and -not $sampleBlockReason) {
                try {
                    $buildCommand = New-SampleBuildCommand -Identity $identity
                    Invoke-CapturedProcess `
                        -FilePath $buildCommand.FilePath `
                        -ArgumentList $buildCommand.Arguments `
                        -WorkingDirectory $repositoryRoot `
                        -TimeoutSeconds 1800 `
                        -Context $context `
                        -RequireSuccess | Out-Null
                    $buildOutput = Get-EvaluatedBuildOutput `
                        -Identity $identity `
                        -RepositoryRoot $repositoryRoot `
                        -Context $context
                }
                catch {
                    $message = "Build failed for '$($selectedSample.project.folder)': $($_.Exception.Message)"
                    Write-HarnessLog -Context $context -Level ERROR -Message $message
                    $report.errors.Add($message)
                }
            }

            for ($index = 0; $index -lt @($selectedSample.screenshots).Count; $index++) {
                $screenshot = @($selectedSample.screenshots)[$index]
                $captureIdentityName = New-CapturePackageIdentity `
                    -SampleId $selectedSample.id `
                    -ScreenshotId $screenshot.id `
                    -RunId $runId
                $fileName = if ($index -eq 0) { 'hero.png' } else { "$($screenshot.id).png" }
                $relativeOutput = "Samples\$($selectedSample.project.folder)\media\$fileName"
                $destination = Join-Path $outputRoot $relativeOutput
                $sidecarDestination = [System.IO.Path]::ChangeExtension($destination, '.json')
                $reviewDirectory = Join-Path $resultsDirectory $selectedSample.project.folder
                $reviewImagePath = Join-Path $reviewDirectory $fileName
                $result = [ordered]@{
                    sampleId = $selectedSample.id
                    projectFolder = $selectedSample.project.folder
                    screenshotId = $screenshot.id
                    scenario = $screenshot.scenario
                    alt = $screenshot.alt
                    mode = $screenshot.capture.mode
                    status = 'pending'
                    reason = $null
                    output = $relativeOutput
                    sidecar = [System.IO.Path]::ChangeExtension($relativeOutput, '.json')
                    reviewImage = "results\$($selectedSample.project.folder)\$fileName"
                    sha256 = $null
                    width = $null
                    height = $null
                    mostlyUniform = $null
                    captureScreen = $null
                    hwnd = $null
                    processId = $null
                    sourcePackageIdentityName = $identity.PackageIdentityName
                    packageIdentityName = $null
                    commands = @()
                }

                $skipReason = Get-CaptureSkipReason -Sample $selectedSample -Screenshot $screenshot
                if ($skipReason) {
                    $result.status = 'manual'
                    $result.reason = $skipReason
                    $result.reviewImage = $null
                    $report.results.Add($result)
                    continue
                }
                $result.packageIdentityName = $captureIdentityName
                if ($sampleBlockReason) {
                    $result.status = 'failed'
                    $result.reason = $sampleBlockReason
                    $result.reviewImage = $null
                    $report.errors.Add("Capture blocked for '$($selectedSample.project.folder)/$($screenshot.id)': $sampleBlockReason")
                    $report.results.Add($result)
                    continue
                }
                if ($null -eq $buildOutput) {
                    $result.status = 'failed'
                    $result.reason = 'The sample build did not complete successfully.'
                    $result.reviewImage = $null
                    $report.results.Add($result)
                    continue
                }

                $temporaryDirectory = Join-Path $runDirectory "work\$($selectedSample.project.folder)\$($screenshot.id)"
                try {
                    $capture = Invoke-OneCapture `
                        -Sample $selectedSample `
                        -Screenshot $screenshot `
                        -Identity $identity `
                        -BuildOutput $buildOutput `
                        -CaptureIdentityName $captureIdentityName `
                        -MakePriPath $report.environment.makePriPath `
                        -TemporaryDirectory $temporaryDirectory `
                        -RepositoryRoot $repositoryRoot `
                        -WindowX $WindowX `
                        -WindowY $WindowY `
                        -WindowWidth $WindowWidth `
                        -WindowHeight $WindowHeight `
                        -TimeoutSeconds $TimeoutSeconds `
                        -StabilityMilliseconds $StabilityMilliseconds `
                        -ForceScreenCapture ([bool]$CaptureScreen) `
                        -AllowNon100PercentScaling ([bool]$AllowNon100PercentScaling) `
                        -Context $context

                    [System.IO.Directory]::CreateDirectory((Split-Path -Parent $destination)) | Out-Null
                    [System.IO.Directory]::CreateDirectory($reviewDirectory) | Out-Null
                    Copy-Item -LiteralPath $capture.TemporaryScreenshotPath -Destination $destination -Force
                    Copy-Item -LiteralPath $capture.TemporaryScreenshotPath -Destination $reviewImagePath -Force

                    $sidecar = [ordered]@{
                        schemaVersion = 1
                        sampleId = $selectedSample.id
                        screenshotId = $screenshot.id
                        scenario = $screenshot.scenario
                        alt = $screenshot.alt
                        sourceMetadata = "Samples/$($selectedSample.project.folder)/sample.yml"
                        image = [ordered]@{
                            file = $fileName
                            width = $capture.Image.Width
                            height = $capture.Image.Height
                            sha256 = $capture.Image.Sha256
                        }
                    }
                    [System.IO.File]::WriteAllText(
                        $sidecarDestination,
                        (($sidecar | ConvertTo-Json -Depth 10) + [Environment]::NewLine))
                    Copy-Item `
                        -LiteralPath $sidecarDestination `
                        -Destination ([System.IO.Path]::ChangeExtension($reviewImagePath, '.json')) `
                        -Force

                    $result.status = 'captured'
                    $result.sha256 = $capture.Image.Sha256
                    $result.width = $capture.Image.Width
                    $result.height = $capture.Image.Height
                    $result.mostlyUniform = $capture.Image.MostlyUniform
                    $result.captureScreen = $capture.CaptureScreen
                    $result.hwnd = $capture.Window.Hwnd
                    $result.processId = $capture.Window.ProcessId
                    $result.packageIdentityName = $capture.PackageIdentityName
                    $result.commands = @(
                        ConvertTo-DisplayCommand -FilePath $capture.RunCommand.FilePath -ArgumentList $capture.RunCommand.Arguments
                        ConvertTo-DisplayCommand -FilePath $capture.ReadinessCommand.FilePath -ArgumentList $capture.ReadinessCommand.Arguments
                        ConvertTo-DisplayCommand -FilePath $capture.ScreenshotCommand.FilePath -ArgumentList $capture.ScreenshotCommand.Arguments
                    )

                    if (-not $PreserveFailureArtifacts) {
                        Remove-Item -LiteralPath $temporaryDirectory -Recurse -Force -ErrorAction SilentlyContinue
                    }
                }
                catch {
                    $result.status = 'failed'
                    $result.reason = $_.Exception.Message
                    $result.reviewImage = $null
                    $message = "Capture failed for '$($selectedSample.project.folder)/$($screenshot.id)': $($result.reason)"
                    Write-HarnessLog -Context $context -Level ERROR -Message $message
                    $report.errors.Add($message)
                    if (-not $PreserveFailureArtifacts -and (Test-Path -LiteralPath $temporaryDirectory)) {
                        Remove-Item -LiteralPath $temporaryDirectory -Recurse -Force -ErrorAction SilentlyContinue
                    }
                }
                $report.results.Add($result)
                Write-CaptureReport -Report $report -Path $reportPath
            }
        }

        $report.status = if ($DryRun) {
            'dry-run'
        }
        elseif (@($report.results | Where-Object status -eq 'failed').Count -gt 0) {
            'failed'
        }
        else {
            'succeeded'
        }
    }
    catch {
        $report.status = 'failed'
        $report.errors.Add($_.Exception.Message)
        Write-HarnessLog -Context $context -Level ERROR -Message $_.Exception.Message
    }
    finally {
        try {
            Restore-HarnessTheme -State $themeState -Context $context
        }
        catch {
            $report.errors.Add("Failed to restore theme: $($_.Exception.Message)")
            $report.status = 'failed'
        }
        Add-DuplicateGroups -Report $report
        $report.counts = [ordered]@{
            total = @($report.results).Count
            captured = @($report.results | Where-Object status -eq 'captured').Count
            planned = @($report.results | Where-Object status -eq 'planned').Count
            manual = @($report.results | Where-Object status -eq 'manual').Count
            failed = @($report.results | Where-Object status -eq 'failed').Count
        }
        $report.completedAt = [DateTimeOffset]::UtcNow.ToString('o')
        Write-CaptureReport -Report $report -Path $reportPath
        Write-CaptureContactSheet -Report $report -Path $contactSheetPath
        Write-HarnessLog -Context $context -Level INFO -Message "Completed screenshot run $runId with status '$($report.status)'."
    }

    return [pscustomobject]$report
}

Export-ModuleMember -Function @(
    'ConvertTo-DisplayCommand',
    'Get-ScreenshotCapturePlan',
    'Select-CaptureSamples',
    'Resolve-SampleIdentity',
    'New-SampleBuildCommand',
    'New-BuildPropertiesCommand',
    'New-WinAppRunCommand',
    'New-WinAppUiCommand',
    'Invoke-WindowBoundsHelper',
    'Test-PngImage',
    'Write-CaptureReport',
    'Write-CaptureContactSheet',
    'Invoke-SampleScreenshotHarness'
)
