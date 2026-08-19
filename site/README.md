# Windows App Samples Browser

This workspace is the static GitHub Pages foundation for
`https://niels9001.github.io/winui-samples/`. Astro prerenders every route; the
site makes no runtime GitHub API requests.

## Commands

Run these from the repository root:

```powershell
pnpm install --frozen-lockfile
pnpm site:test
pnpm site:check
pnpm site:build
pnpm site:smoke
```

Each root `site:*` command validates the complete metadata inventory and
regenerates `site/src/generated/sample-catalog.json` before invoking the site
workspace.
`pnpm site:verify` runs the catalog tests, site contract tests, type checks,
static build, and generated-output smoke checks in deployment order.

For local development:

```powershell
pnpm site:prepare
pnpm --filter @winui-samples/site dev
```

Astro serves the configured `/winui-samples/` base path in development too.
After a production build, `pnpm --filter @winui-samples/site preview` serves the
same base-prefixed HTML, immutable Browse JSON, and generated media routes.

Before the first deployment, a repository administrator must select
**GitHub Actions** as the Pages source in repository settings. The workflow
intentionally uses the default `GITHUB_TOKEN` with read-only Pages access during
the build and does not attempt to change repository settings.

## Data boundary

`site:prepare` deterministically builds four ignored artifacts:

1. `tools/catalog/generate.mjs` validates and generates the 71 local records.
2. `tools/external-catalog/generate.mjs` validates the exact provider locks,
   licenses, history, and content-addressed cache before generating 120 WinUI
   Gallery pages and 42 Windows App SDK families.
3. `tools/portal-catalog/generate.mjs` joins all 233 records while preserving local
   ids/routes and provider-namespaced external routes.
4. `tools/activity/generate.mjs --offline` emits the local activity artifact without
   consulting GitHub, even when a token is present in the Pages environment.

`src/lib/catalog.ts` checks the site-facing contract; pages import the singleton
from `src/lib/catalog-data.ts`. Generated JSON under `src/generated/` and
`external/generated/` is ignored and byte-reproducible. Missing cache bytes, pin or
hash mismatches, incomplete provider counts, unresolved licenses, and route
collisions fail preparation. Normal preparation and builds never call GitHub.

## Explorer architecture

- `AppShell.astro` owns document metadata, accessible skip navigation, primary
  navigation, responsive chrome, theme initialization, and the footer.
- `tokens.css` and `global.css` own shared Fluent-aligned color, type, spacing,
  focus, surface, and layout primitives.
- `SampleExplorer.tsx` is the only React client island. It verifies and loads a
  same-origin, content-addressed search projection, then owns in-memory search,
  faceted counts, URL state, sorting, and the responsive filter drawer. The full
  normalized provider payload is never serialized into Browse HTML. Facet labels
  are keyed by canonical values so canonical JSON ordering cannot separate a value
  from its authored display label.
- Browse retains a no-JavaScript directory containing all 233 detail links.
  Detail and code routes remain prerendered HTML. Reviewed provider redirects
  are emitted as static redirect documents so prior stable routes keep working.
- `SampleCard.astro`, `CoverageNotice.astro`, and `EmptyCatalogState.astro`
  define reusable catalog states.
- `GetStarted.astro` consumes a small verified-link model and uses Shiki only at
  build time for the quick-start command.
- `related-samples.ts` applies explicit relationships first, then deterministic
  weighted category, API, tag, and language matching. Provider diversity breaks
  equal scores but never imposes quotas.
- Approved local hero media resolves `media/hero.webp` before `media/hero.png`
  and requires a matching `media/hero.json` sidecar with authored alt text,
  dimensions, source path, and SHA-256. The current 48 approved 1440×900
  screenshots render uncropped in 16:10 containers; the other 23 local records
  use category-derived artwork without an image request. Provider media remains
  governed by its normalized image and license metadata.

## Featured-file safety boundary

Every safe local `featuredFiles` entry and every provider-selected cached text file
gets a dedicated static code route. Detail HTML embeds only the first file, so a
sample does not inline its full curated source set. Build-time reads require a
case-valid allowlisted path, reject symbolic links, generated artifact folders,
sensitive filename patterns, binary content, invalid UTF-8, and files above
128 KiB. Code route keys use a readable path prefix plus a path-derived digest,
so insertion and reordering do not move existing routes and slug collisions
remain distinct. External reads additionally verify the selected cache digest
and size.

The text-extension allowlist is `.appcontent-ms`, `.appxmanifest`, `.c`, `.cpp`,
`.cs`, `.csproj`, `.h`, `.idl`, `.ino`, `.json`, `.manifest`, `.md`, `.props`,
`.ps1`, `.py`, `.resw`, `.targets`, `.txt`, `.vcxproj`, `.xaml`, `.xml`, `.yaml`,
and `.yml`. Unsupported, oversized, denied, or uncached selections retain their
exact pinned source link and an explicit source-only state; no unsafe bytes are
copied into site output.

## Production output contract

The current build contains 233 detail routes and 992 safe code routes (1,227 HTML
routes total), 170 media routes (48 approved local screenshots and 122 provider
assets), and one immutable
Browse index. Browse HTML is 74.6 KiB; the index is 758.2 KiB raw / 94.6 KiB gzip;
initial Browse JavaScript is 67.1 KiB gzip. The static audit enforces a 650 KiB
Browse HTML ceiling and an 80 KiB-gzip initial Browse JavaScript ceiling, checks
every internal base-prefixed link, and rejects runtime external asset/API requests.
