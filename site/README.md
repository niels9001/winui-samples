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
```

Each root `site:*` command validates the staged metadata and regenerates
`site/src/generated/sample-catalog.json` before invoking the site workspace.
`pnpm site:verify` runs the catalog tests, site contract tests, type checks, and
static build in deployment order.

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

The regular catalog validator intentionally supports partial metadata. The site
uses the generated coverage object to explain staged rollout and renders an
empty state when no samples are available. The 71/71 completeness command
remains opt-in until every metadata pull request has landed.

## Foundation boundaries

- `AppShell.astro` owns document metadata, accessible skip navigation, primary
  navigation, responsive chrome, theme initialization, and the footer.
- `tokens.css` and `global.css` own shared Fluent-aligned color, type, spacing,
  focus, surface, and layout primitives.
- `ThemeSwitcher.tsx` is the only required client island. Everything else is
  static HTML, including Fluent System Icons rendered through React.
- `SampleCard.astro`, `CoverageNotice.astro`, and `EmptyCatalogState.astro`
  define reusable catalog states.
- `GetStarted.astro` consumes a small verified-link model and uses Shiki only at
  build time for the quick-start command.

Later layers can replace the landing-page art direction and add filtering,
full code browsing, related samples, screenshots, and a Three.js experience.
They should preserve the data boundary, base-path helper, shell semantics,
theme contract, and intent-first title hierarchy established here.
