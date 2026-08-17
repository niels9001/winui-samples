# Sample metadata contract

Every `Samples/<Project>/` folder has two authored descriptions:

- `README.md` is the human-readable sample guide.
- `sample.yml` is the canonical structured source for discovery, filtering, capture,
  and the generated site catalog.

Never hand-edit generated catalog JSON. The catalog generator validates and normalizes
`sample.yml` files before writing deterministic JSON for the site.

## Schema and taxonomy

Metadata uses schema version 1 at
[`metadata/schema/v1/sample.schema.json`](../metadata/schema/v1/sample.schema.json).
Primary and secondary category ids come from
[`metadata/taxonomy.yml`](../metadata/taxonomy.yml). Categories describe what a
developer is trying to accomplish rather than mirroring individual API namespaces.
Use one primary category and only genuinely useful secondary categories.

Keep the exact folder and project names in `project.folder` and `project.name`. Put
original sample names, API names, abbreviations, and common search terms in
`aliases` and `tags`. Consolidated projects list every source UWP sample in
`originalSamples`.

`icon` values are Fluent System Icons export names. They must use the exact
PascalCase `*Regular` or `*Filled` convention, such as `DocumentRegular`. This layer
validates that strict naming contract without adding the large React icon package.
The site layer must verify that every name is an actual export of the exact
`@fluentui/react-icons` version it installs.

Do not add authored `lastUpdated`, commit, pull request, author, or contributor
fields. The site build derives that volatile history from Git and GitHub.

## Titles and summaries

Lead with developer intent or outcome, not the folder or API name.

Titles must be:

- active and concrete;
- sentence case;
- usually 4-12 words;
- free of a trailing period; and
- free of generic `X sample` wording.

Summaries explain in one concise sentence what a developer can accomplish. Preserve
the technical project name separately and keep it searchable through `project`,
`aliases`, APIs, and tags.

| Before | Intent-led title |
| --- | --- |
| FileAccess sample | Reading and writing files in a Windows app |
| XamlDragAndDrop sample | Adding drag-and-drop interactions |
| Bluetooth sample | Connecting to nearby Bluetooth devices |
| HttpClient sample | Calling HTTP services and handling responses |
| DeviceEnumerationAndPairing sample | Discovering and pairing connected devices |

## Facts and references

- Verify scenarios against `SampleConfiguration.cs` and the implementation.
- Record the APIs a developer needs to find, not every type used by the shell.
- Use only HTTPS links for original sources and documentation.
- Record the manifest's minimum Windows version and capabilities exactly.
- Name required hardware and account or service prerequisites explicitly. Use empty
  arrays when none are required.
- Keep featured file paths relative to the sample folder. Every path must exist with
  the exact spelling and casing in the repository.
- Use stable sample ids in `relatedSamples`. Unresolved ids warn in the regular
  validator and fail the required completeness gate.

## Screenshot and capture metadata

Each screenshot entry needs accessible alt text and a representative scenario id.
The capture block records `automatic` or `manual` mode, a selector that indicates
the UI is ready, optional structured UI actions, and any operator notes. Alt text
describes the meaningful UI state rather than saying only "screenshot" or repeating
the title.

Use `automatic` only when the scenario is deterministic and has selectors stable
enough for a capture runner. Use `manual` for hardware-, consent-, picker-, account-,
or environment-dependent states.

## Agent workflow

1. Copy [`templates/sample.yml`](../templates/sample.yml) into the project folder.
2. Read the project README, manifest, project file, scenario configuration, and
   featured implementation files.
3. Replace every placeholder with verified facts and remove unused optional fields.
4. Run `pnpm catalog:validate:complete`.
5. Generate a local preview with
   `pnpm catalog:generate -- --require-complete --output <path>`.

Catalog CI runs the completeness gate so every discovered project must have valid
metadata. The regular validator remains available when drafting an isolated fixture
or metadata record.
