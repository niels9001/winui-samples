# Federated sample catalog contract

The federated catalog is an additive build-time contract for samples that remain in
their upstream repositories. It does not vendor or migrate those applications. The
existing 71 local records remain canonical, unchanged schema-v1 documents under
`Samples/*/sample.yml`; the build joins them with 162 external records into the
233-record developer portal.

The site imports only deterministic generated output. Normal builds use committed
locks and content-addressed cache bytes, and browser requests never depend on
GitHub or mutable upstream refs.

## Source-unit granularity

One normalized record is one developer-facing search result. Provider adapters must
not promote implementation variants to independent records.

| Provider | Immutable record key | One portal record | Nested content |
| --- | --- | --- | --- |
| Local | Existing `sample.yml` `id` | One current `Samples/<Project>` record | Existing scenarios |
| WinUI Gallery | `ControlInfoData.json` page `UniqueId` | One of 120 enforced Gallery pages | 330 `ControlExample` entries and 316 `SampleDefinition` code units |
| Windows App SDK samples | Reviewed curated `recordKey` | One of 42 enforced conceptual sample families | 216 language/framework/packaging/project/solution variants, 72 scenarios, and 20 Windows AI examples |

Both external providers are enabled with `completenessPolicy: enforced` and exact
record counts. Generation fails rather than accepting a partial or empty provider.

## Identity and routes

`recordKey` is provider-local and immutable. The global id is always
`<provider-id>:<recordKey>`, for example:

- `local:file-access`
- `winui-gallery:ButtonPage`
- `windows-app-sdk-samples:app-lifecycle`

`createRouteSlug(providerId, recordKey)` creates a provider-prefixed slug containing
a normalized hint and the first 12 hex digits of a SHA-256 identity digest. Title,
category, and upstream path edits therefore cannot move the route. Global ids,
route slugs, and route paths are checked for collisions during merge.

Do not change a record key to model an upstream rename. Add an explicit reviewed
rename declaration, redirect, previous path, or tombstone. The lifecycle diff can
report possible matches, but it never converts them into renames automatically.
All existing local ids and `/samples/<id>/` routes remain unchanged. External
routes use the provider-prefixed digest form described above.

## Normalized record v1

The strict schema is
[`metadata/schema/federated/v1/normalized-record.schema.json`](../metadata/schema/federated/v1/normalized-record.schema.json);
the matching TypeScript model and adapter interface are
[`tools/external-catalog/types.ts`](../tools/external-catalog/types.ts).
Unknown fields fail validation.

The model keeps these concerns separate:

- quiet provider identity and a canonical provider link;
- exact source repository, requested ref, locked commit SHA, tree SHA, upstream
  commit time, source path, and pinned GitHub links;
- developer-facing display title and the upstream title;
- nullable summary and description;
- field-level `authored`, `curated`, `derived`, or `technical` provenance with an
  exact source path;
- technical aliases, provider taxonomy, portal taxonomy, tags, languages, project
  types, and packaging;
- APIs, documentation, requirements, limitations, nested variants/scenarios/
  examples, featured source, images, and provider-aware relations;
- metadata completeness, missing fields, and actionable warnings;
- license and attribution references;
- upstream editorial badges, kept structurally distinct from portal lifecycle
  badges; and
- lifecycle values tied to reviewed sync ids, never inferred from commit time.

Raw HTML is not a record field. Text is plain and must be escaped by a renderer.
Migration notes and PR-centric details are intentionally absent from normalized
rendered/search content. Repository provenance remains available for audit, while
developer-facing limitations and real prerequisites remain available for display.
PR numbers and merge dates are not required presentation fields.

### Capabilities and prerequisites

`requirements.declaredPackageCapabilities` records what a package manifest
declares. `requirements.prerequisites` separately records actual hardware,
account/service, software, and operator prerequisites. A declared capability must
not be presented as evidence that hardware or a service is required.

## Committed inputs and ignored output

The repository convention is:

| Path | Committed | Purpose |
| --- | --- | --- |
| `external/providers.json` | Yes | Stable provider registry and source-unit rules |
| `external/locks.json` | Yes | Exact provider commit/tree/blob source locks |
| `external/cache/manifest.json` | Yes | Content-addressed cache index |
| `external/cache/blobs/sha256/<2>/<sha256>` | Selected files | Reviewed upstream bytes required offline |
| `external/history.json` | Yes | Reviewed sync and record lifecycle state |
| `external/generated/catalog.json` | No | Deterministic merged artifact |
| `site/src/generated/sample-catalog.json` | No | Deterministic 233-record portal artifact |

The generated artifact embeds exact enabled-provider locks plus SHA-256 hashes of
the registry, lock file, cache manifest, and reviewed history. It contains no wall
clock generation timestamp. Reversing provider or record input order produces
byte-identical canonical JSON.

Normal generation:

1. validates every strict schema and cross-file identity;
2. requires a lock and reviewed history for every enabled provider;
3. requires every locked artifact to have an exact manifest entry;
4. reads only committed cache bytes;
5. verifies byte length, SHA-256, Git blob SHA, MIME/signature, and safety limits;
6. runs the provider adapter;
7. validates provider identity, exact lock embedding, record routes, provenance,
   reviewed lifecycle, licenses, and global collisions; and
8. atomically replaces the ignored merged artifact.

It makes zero network calls. An enabled provider with a missing or mismatched cache
entry fails the build; it can never silently become an empty provider.
Provider adapter source is also checked to reject direct filesystem/network/process
imports and `fetch`; adapters receive upstream bytes only through `readArtifact`.

## Refresh boundary

`pnpm external:refresh -- --provider <id>` is the only generic network entry point.
It loads a provider-owned refresh module and supplies `createGitHubClient`.
Provider adapters used by `external:generate` must not import the network module.

The client enforces:

- `X-GitHub-Api-Version: 2022-11-28`, a stable User-Agent, and GitHub JSON media
  headers;
- pagination and ETag-backed 304 reuse;
- recursive fallback when the Git Trees API reports `truncated: true`;
- same-repository API and response URLs, with redirects disabled;
- actionable status/request-id errors; and
- token closure, redaction, and no token serialization or logging.

A refresh should stage lock/cache/history changes for review. Scheduled automation
can open a PR later; it must not push mutable upstream data directly into Pages.

## Path, text, and media boundary

All upstream paths are POSIX, repository-relative, exact-case values. The shared
guards reject absolute paths, drive paths, backslashes, empty/dot/traversal
segments, NUL, encoded octets, out-of-allowlist roots, case mismatches, Git
symlinks, and submodules.

Text imports require an allowlisted extension, valid UTF-8, no NUL, a size cap, and
no secret-like filename or content. Images are limited to PNG, JPEG, or WebP with
matching extension, MIME, signature, and byte cap. Aggregate selected assets for
one record are capped as well. SVG and arbitrary binary output are not allowed.
An image with `decorative: true` must have `alt: ""`; a nondecorative image must
have meaningful non-whitespace alt text.

## License inheritance

A provider license manifest pins the same repository and commit as its source
lock. The root entry uses an empty `scopePath`; subtree entries use exact POSIX
paths. `resolveLicenseForPath` chooses the longest segment-boundary match, allowing
a subtree license to override the repository license without guesswork. Record
license/attribution refs must resolve to manifest entry ids.

## Reviewed lifecycle

Upstream `commitTime` is provenance, not portal recency. `external/history.json`
records reviewed sync ids and the accepted state for each immutable id:
`firstSeenSync`, `lastReviewedSync`, `lastChangedSync`, status, and
`removedAtSync`. Gallery history also persists each normalized record's
content hash so a new provider lock advances `lastChangedSync` only for records
whose developer-facing content changed. Each provider history names
`latestSyncId` explicitly; array ordering never determines lifecycle behavior.

Provider adapters receive immutable copies of the committed history and derive
record lifecycle plus `new`/`updated` portal badges from it. Provider output must
match that state exactly, including any persisted normalized `contentHash`.
Active history records cannot disappear, and tombstoned
records must remain represented with persistent reviewed rename/removal
declarations. Providers emit those tombstones plus any reviewed route redirects
from committed curation. Refreshes merge prior syncs and first-seen/change state
instead of recreating history. The lifecycle diff primitives classify
additions, content changes, removals, explicit renames, tombstones, and ambiguous
rename candidates. A reviewer must resolve every deletion or ambiguity before
updating history.

Canonical JSON sorts object keys but preserves array order. Adapters and merge
code explicitly sort set-like inventories; authored sequences such as scenarios,
capture actions, variants, and featured source selections retain their reviewed
order.

## Commands

Run from the repository root:

```powershell
pnpm external:test
pnpm external:check
pnpm external:validate
pnpm external:generate
pnpm external:verify
```

`site:prepare` validates local metadata and external state, generates both catalogs
offline, joins exactly 233 unique records, and emits an explicitly offline activity
artifact. The offline activity command ignores `GITHUB_TOKEN` and
`GITHUB_REPOSITORY`, so Pages preparation cannot become network-dependent. Pages
fails early if an enabled provider's committed cache is cold or any expected count,
pin, hash, or license is wrong. The current site build contains 233 detail and 992
code routes (1,227 HTML routes total).

## Provider adapter ownership

The shared contract owner owns these paths; provider work should not redefine them:

- `metadata/schema/federated/v1/**`
- `tools/external-catalog/lib/**`
- `tools/external-catalog/types.ts`
- `external/providers.json`

### WinUI Gallery adapter

Own:

- `tools/external-catalog/providers/winui-gallery/**`
- `tools/external-catalog/refresh/winui-gallery.mjs`
- `tools/external-catalog/test/winui-gallery*.test.mjs`
- `external/curation/winui-gallery/**`
- `external/licenses/winui-gallery.json`
- Gallery-addressed cache blobs

Use `UniqueId` verbatim as `recordKey`; emit one record per page and keep every
`ControlExample`/`SampleDefinition` nested. Do not copy the Gallery application.

### Windows App SDK samples adapter

Own:

- `tools/external-catalog/providers/windows-app-sdk-samples/**`
- `tools/external-catalog/refresh/windows-app-sdk-samples.mjs`
- `tools/external-catalog/test/windows-app-sdk-samples*.test.mjs`
- `external/curation/windows-app-sdk-samples/**`
- `external/licenses/windows-app-sdk-samples.json`
- Windows-App-SDK-addressed cache blobs

Use the reviewed curated family key as `recordKey`; emit one record per conceptual
family and keep language/framework/packaging/solution/project/scenario variants
nested. Do not copy the upstream sample applications.

Provider refreshes may prepare keyed updates to `external/locks.json`,
`external/cache/manifest.json`, and `external/history.json`. They must preserve the
other provider's objects, enforced record counts, source-root boundaries, and
reviewed lifecycle state.

The three committed JSON records under
`tools/external-catalog/fixtures/records/` are synthetic compact contract fixtures,
not snapshots of upstream content.
