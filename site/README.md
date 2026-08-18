# Showcase website

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

Before the first deployment, a repository administrator must select
**GitHub Actions** as the Pages source in repository settings. The workflow
intentionally uses the default `GITHUB_TOKEN` with read-only Pages access during
the build and does not attempt to change repository settings.

## Data boundary

`tools/catalog/generate.mjs` is the only source of site sample data. Its
deterministic JSON output is generated into `src/generated/` and ignored by Git.
`src/lib/catalog.ts` defines and checks the site-facing contract; pages import
the checked singleton from `src/lib/catalog-data.ts`.

`site:prepare` also validates the additive external-provider lock/cache/history
contract, but the site does not import its generated artifact yet. Consequently,
no external provider changes current routes or Browse payload, and no normal site
command calls GitHub.

Site components continue to support partial and empty generated catalogs for
local previews and future inventory transitions. Production verification and
deployment now require complete metadata because all 71 catalog records have
landed.

## Explorer architecture

- `AppShell.astro` owns document metadata, accessible skip navigation, primary
  navigation, responsive chrome, theme initialization, and the footer.
- `tokens.css` and `global.css` own shared Fluent-aligned color, type, spacing,
  focus, surface, and layout primitives.
- `ThemeSwitcher.tsx` and `SampleExplorer.tsx` are focused client islands. The
  explorer owns fast in-memory search, faceted counts, URL state, sorting, and
  the responsive Fluent v9 filter drawer; sample detail and code routes remain
  prerendered HTML.
- `SampleCard.astro`, `CoverageNotice.astro`, and `EmptyCatalogState.astro`
  define reusable catalog states.
- `GetStarted.astro` consumes a small verified-link model and uses Shiki only at
  build time for the quick-start command.
- `related-samples.ts` applies explicit relationships first, then deterministic
  weighted category, tag, and API matching.
- Hero media resolves `media/hero.webp` before `media/hero.png`. When neither is
  present, category-derived artwork is rendered without an image request.

## Featured-file safety boundary

Every authored `featuredFiles` entry gets a dedicated static code route. Detail
HTML embeds only the first file, so a sample does not inline its full curated
source set. Build-time reads require a case-valid path that remains inside the
sample folder after real-path resolution, reject symbolic links, generated
artifact folders, sensitive filename patterns, binary content, invalid UTF-8,
and files above 128 KiB.

The text-extension allowlist is `.appcontent-ms`, `.appxmanifest`, `.c`, `.cpp`,
`.cs`, `.csproj`, `.h`, `.idl`, `.ino`, `.json`, `.manifest`, `.md`, `.props`,
`.ps1`, `.resw`, `.targets`, `.txt`, `.xaml`, `.xml`, `.yaml`, and `.yml`.
Unsupported authored files keep their exact GitHub link and render a clear
preview-unavailable state; they are never copied into the site output.

Later layers can replace the landing-page art direction, add the Three.js
experience, and publish captured media. They should preserve the data boundary,
base-path helper, explorer URL contract, shell semantics, and intent-first title
hierarchy established here.
