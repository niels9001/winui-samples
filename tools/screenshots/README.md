# Sample screenshot automation

`Invoke-SampleScreenshots.ps1` builds cataloged WinUI samples, launches them with
WinApp CLI, applies the v1 `sample.yml` capture recipe, and produces deterministic
review artifacts.

## Prerequisites

- Windows 10 build 17763 or newer in an interactive, unlocked desktop session.
- 100% display scaling. Other scaling is rejected unless
  `-AllowNon100PercentScaling` is explicitly used for diagnostics.
- .NET SDK 10, Node.js 22+, and repository dependencies installed with
  `pnpm install --frozen-lockfile`.
- Windows SDK 10 with the x64 `makepri.exe` tool.
- A WinApp CLI build whose `winapp ui` surface provides `list-windows`,
  `wait-for`, `invoke`, `click`, and `screenshot --capture-screen`.
- At least 5 GB free on the output drive.

The default outer-window bounds are `1440x900` at `(40,40)`. The harness validates
that those physical pixels fit the virtual desktop. `-Theme light` and
`-Theme dark` temporarily change the current user's app-theme registry value and
restore it after the run; `system` leaves it unchanged.

## Usage

```powershell
# Discover cataloged samples
pwsh ./tools/screenshots/Invoke-SampleScreenshots.ps1 -List

# Inspect every command and output without building or launching
pwsh ./tools/screenshots/Invoke-SampleScreenshots.ps1 -All -DryRun

# Capture one or several samples
pwsh ./tools/screenshots/Invoke-SampleScreenshots.ps1 -Sample FileAccess
pwsh ./tools/screenshots/Invoke-SampleScreenshots.ps1 -Sample FileAccess,Json -Theme dark

# Emit only the final report object on stdout; diagnostics remain in run.log
pwsh ./tools/screenshots/Invoke-SampleScreenshots.ps1 `
  -Sample FileAccess -NonInteractive -Json
```

Existing final images are never replaced unless `-Overwrite` is supplied. A
pre-existing process with the sample executable name stops capture because its
window would be ambiguous. A registration with the source package identity is
safe and may remain installed; the harness never replaces or unregisters it.

## Output contract

For the first authored screenshot recipe:

```text
<output-root>/Samples/<Project>/media/hero.png
<output-root>/Samples/<Project>/media/hero.json
```

Additional recipes use `<screenshot-id>.png` and a matching JSON sidecar. The
sidecar carries the authored alt text, scenario, dimensions, and SHA-256. Every
run also creates:

```text
<output-root>/artifacts/screenshot-captures/<run-id>/
  capture-plan.json
  run.json
  run.log
  contact-sheet.html
  results/<Project>/*
  work/<Project>/<screenshot-id>/staged/*
  work/<Project>/<screenshot-id>/appx/*
```

`run.json` records environment checks, commands, skips, failures, hashes, and
duplicate groups. `contact-sheet.html` is self-contained within the run artifact
tree and uses the authored accessible alt text. Failure work directories are
preserved by default; use `-PreserveFailureArtifacts:$false` to remove them.
Images that are not PNG, have unexpected dimensions, or are blank/mostly uniform
are rejected before final output is replaced.

No optional image encoder is invoked. A repository-pinned deterministic Windows
optimizer is not currently available, so PNG optimization and web derivatives
are intentionally left to the site pipeline.

## Temporary package identity isolation

Each automatic capture gets a deterministic per-run name of the form
`WinUISamples.Capture.<24 lowercase hex characters>`. The hash uses only the
sample ID, screenshot ID, and run ID; it contains no user name, machine path, or
secret. Any registration collision is rejected rather than reused.

The harness reads the generated `.build.appxrecipe` and copies its files into the
capture's `staged` work directory, excluding the identity-bound `resources.pri`.
It changes only `Identity/@Name` in the staged manifest, then uses the generated
MSBuild PRI configuration and XBF intermediates to create a matching staged PRI.
Source manifests, source build outputs, and committed sample files are read-only
and hash-checked for immutability. WinApp CLI launches a second loose layout in
the capture's `appx` directory.

Cleanup targets only path-validated process IDs observed under that run's `appx`
directory and development packages with the exact temporary identity whose
registered path is inside the same run work directory. An external registration
is never removed, including one that races with the temporary identity.

This identity isolation is separate from
[microsoft/WinAppCLI#760](https://github.com/microsoft/WinAppCLI/issues/760),
which tracks first-class deterministic window bounds. The typed bounds helper
remains necessary until #760 ships; identity staging remains necessary while
WinApp CLI registration uses the manifest's source identity.

## FileAccess pilot status

The isolated FileAccess pilot succeeded on August 17, 2026 while its original
identity remained development-registered from another checkout. The harness
built x64 Debug, launched the temporary identity, validated the FileAccess HWND,
set `1440x900` outer bounds at `(40,40)` on a 96-DPI desktop, waited for
`Creating a file`, and captured `Samples/FileAccess/media/hero.png`. The image is
`1440x900`, non-uniform, and has SHA-256
`144bcaa016ce6be0e94aa7eec454e6418911f15299fc127ab367d237c3cc2eab`.
The matching sidecar, run report, logs, and contact sheet were generated. The
temporary process and package were removed; the external original registration
was unchanged.

## Window bounds helper

`WindowBounds` is a small typed .NET helper that validates a live HWND and its
expected process ID before calling `SetWindowPos`. It also reports system/window
DPI so the PowerShell orchestrator can reject non-deterministic display state.
This helper is temporary until WinApp CLI provides first-class deterministic
window bounds; track [microsoft/WinAppCLI#760](https://github.com/microsoft/WinAppCLI/issues/760).

## Self-hosted runner security

The workflow is manual-only and targets the dedicated labels
`[self-hosted, Windows, X64, winui-screenshot]`. The runner must use a disposable
or tightly isolated account, an unlocked interactive desktop, 100% scaling, and
the required WinApp CLI build.

Building and launching a sample executes repository code with the runner user's
full desktop permissions. Never dispatch the workflow for an unreviewed pull
request or arbitrary fork ref. The workflow requires an explicit trusted-ref
confirmation and intentionally does not accept a checkout-ref input. Prefer a
fresh runner image and clear the account's app data between trusted runs.

## Tests

The non-GUI tests cover metadata discovery, command construction, invalid HWND
validation, collision-safe identities, staged manifest immutability, recipe/path
guards, exact package cleanup selection, report/contact-sheet generation, and
PNG checks:

```powershell
pwsh ./tools/screenshots/tests/Invoke-Tests.ps1
```
