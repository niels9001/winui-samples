# Contributing

## Adding a migrated sample

1. Copy the original UWP sample name as the folder name under `Samples/`.
2. Follow [docs/MIGRATION_VERIFICATION.md](docs/MIGRATION_VERIFICATION.md) end to end.
3. Use the `winui-uwp-migration` skill (win-dev-skills) to drive the port.
4. Start each sample README from `templates/SAMPLE_README_TEMPLATE.md`.
5. Copy `templates/sample.yml` into the sample folder and follow
   [the metadata editorial contract](docs/SAMPLE_METADATA.md).
6. A sample is only mergeable once the manual verification checklist passes and the
   per-sample README links the Learn doc(s) it serves.

## Scope

- In scope: samples with verdict **Migrate** from the analysis.
- Out of scope (for now): **Rewrite**, **Superseded** verdicts. **Conditional** samples
  need a decision before porting.

## Conventions

- One sample per folder; standard WinUI 3 (Windows App SDK) project shape.
- `<RootNamespace>` matches the original UWP namespace where practical.
- Launch with `winapp run`, never the raw `.exe`.

## Sample metadata

Install the lightweight catalog tooling with `pnpm install`, then run:

```powershell
pnpm catalog:test
pnpm catalog:validate:complete
pnpm catalog:generate -- --require-complete --output site/src/generated/sample-catalog.json
```

Catalog CI requires every sample project to have a valid `sample.yml`. The regular
`pnpm catalog:validate` command remains available for isolated metadata drafting,
but run the completeness command before opening a pull request.
