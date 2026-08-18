# Showcase design foundation

## Experience principles

1. Lead with the task a developer can accomplish. The authored intent title is
   always the primary heading; the technical project name is secondary.
2. Keep the catalog honest. Coverage and empty states remain valid UI contracts
   for previews and inventory transitions, while production currently enforces
   complete metadata.
3. Preserve a Windows character without imitating product chrome. Fluent color,
   Segoe typography, restrained surfaces, System Icons, and clear focus states
   provide the shared language.
4. Ship progressively. Core navigation, the landing experience, detail pages,
   and curated code routes are meaningful static HTML. The theme menu and
   browse explorer are isolated React islands; the landing's Three.js stage is
   a separately lazy-loaded enhancement.
5. Treat `/winui-samples/` as part of the URL contract. Internal routes and
   public assets go through `sitePath`, while external links remain absolute.
6. Describe manifest capabilities as **Declared package capabilities** and show
   their authored descriptions. Keep them separate from hardware and
   account/service prerequisites; a declared-but-unused capability must not
   become a feature badge, requirement claim, or intent category.

## Reusable primitives

The global `.site-container`, `.reading-width`, `.stack`, `.cluster`,
`.responsive-grid`, `.surface`, `.badge`, and `.button-link` classes are the
layout vocabulary for later experiences. Components may add scoped layout but
should consume shared tokens rather than introduce parallel color or spacing
systems.

## Explorer boundaries

The explorer owns authored-field search, detailed facets, shareable URL state,
intent-first cards, rich detail pages, deterministic related samples, and
curated build-time source previews. It never calls GitHub at runtime, fabricates
recency, treats package capabilities as functional requirements, or mirrors an
entire project tree. Unsupported or oversized featured files keep a GitHub link
and an explicit preview fallback.

The additive federated contract keeps provider/source labels quiet and preserves
pinned provenance for audit without making migration or PR details search content.
When a later UI layer consumes it, one provider source unit remains one result;
implementation variants stay nested. Upstream editorial badges remain distinct
from portal recency, which comes only from reviewed sync history rather than
upstream commit time.

## Landing art direction

The landing page is an unmistakably Windows composition: Segoe Variable,
Windows blue, translucent app surfaces, compact title bars, aligned content
planes, and practical Fluent spacing. It avoids imitating operating-system
chrome literally and does not use particle fields, generic gradients as the
main idea, or product-marketing claims. The hero begins with developer intent,
backs it with the generated 71-project/105-source-sample proof, and hands the
platform composition into real sample cards.

Featured samples are an authored cross-category set with deterministic catalog
fallbacks. `resolveHeroMedia` remains the only source of future `hero.webp` or
`hero.png` media; absent captures render the existing category-aware visual, so
the mosaic never depends on screenshots being present.

## Activity semantics

`tools/activity` generates a bounded feed at build time. CI reads the same
repository through GitHub REST with only `contents: read` and
`pull-requests: read`; the browser never calls GitHub. The generator paginates
closed pull requests and changed files, honors `previous_filename` for renamed
files, rejects malformed or rate-limited responses explicitly, and maps paths
to generated catalog projects.

- **New** requires an added project file under the project folder.
- **Implementation updated** requires code, XAML, project, manifest, or asset
  changes.
- **Docs and media refreshed** is reserved for `sample.yml`, README, and media
  changes. It is never presented as functional work.

Samples are deduplicated by latest merge while all contributing pull requests
remain in provenance. Without CI credentials, generation emits a deterministic
empty state; the optional local git probe recognizes only real merge subjects
with PR numbers and does not fabricate changed-file provenance.

## Motion and fallback tiers

The complete stage exists first as static HTML and CSS. Capable clients only
request the raw Three.js module when the section nears the viewport. Reduced
motion, Save-Data, less than 4 GB reported device memory, constrained mobile
width, import/WebGL failure, and context loss retain the static composition.
The renderer caps device pixel ratio at 1.5, pauses while hidden or offscreen,
and disposes observers, geometries, materials, the renderer, and its canvas.
The decorative canvas is unfocusable and `aria-hidden`; every destination and
piece of essential copy remains DOM content.

CSS transitions are enabled only under `prefers-reduced-motion: no-preference`.
There is no scroll locking, pinned section, transformed document flow, or
JavaScript scroll-position animation. Forced-colors styles preserve structural
borders and semantic content.

## Performance budgets

Production smoke tests gzip emitted assets and enforce:

- initial landing JavaScript below 180 KiB compressed, excluding Browse and the
  separately requested Three.js chunk;
- the lazy Three.js chunk below 180 KiB compressed;
- Browse HTML at or below 669,000 bytes (the existing 653.3 KiB payload);
- every generated route keeps one `main`, base-prefixed internal URLs, image
  alternatives, and no serialized token-shaped value.

The current production build emits 427 HTML pages. Measured values are recorded
in the dependent pull request rather than hard-coded here because hashed chunks
can shift with dependency updates.
