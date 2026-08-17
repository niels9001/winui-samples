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
pre-existing process or registered package with the sample identity also stops
the capture: the harness will not close, replace, or unregister resources it did
not create. Use a clean capture account or unregister a development package
yourself before starting the harness.

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
  work/<Project>/<screenshot-id>/*
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

## FileAccess pilot status

The x64 Debug FileAccess build succeeded on August 17, 2026. The GUI pilot then
stopped before launch because package identity
`65B8319D-B5F1-42F4-8FF7-6B43D4842917` was already development-registered from
another checkout. The harness preserved its JSON/log diagnostics and did not
replace or unregister that package. No screenshot is claimed or committed from
that run; rerun the pilot with a clean self-hosted capture account.

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
validation, report/contact-sheet generation, and PNG checks:

```powershell
pwsh ./tools/screenshots/tests/Invoke-Tests.ps1
```
