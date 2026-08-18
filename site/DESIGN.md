# Developer portal design

## Production audit

The baseline production build was reviewed at 320 px and 1440 px in light and
dark themes. The audit covered the landing page, Browse, FileAccess, Bluetooth,
Camera, Sensors, and a FileAccess code route, plus anchored views of scenarios,
code, migration context, resources, related records, the Three.js stage,
featured content, pathways, and Get started.

The baseline was functionally sound but read like a repository dashboard:

- The landing page surfaced merged-pull-request mechanics, metadata coverage,
  and contribution workflow before developer outcomes.
- The hero and Three.js stage used anonymous windows and translucent rectangles.
  They looked polished in isolation but did not communicate what could be built.
- Featured and Browse cards relied on large generic gradients, repeated category
  labels, and gave summaries and source provenance too little visual weight.
- Browse opened with excessive empty space and implementation-facing helper
  copy. Its filters were capable but visually dense, and no source/provider
  affordance existed.
- Detail heroes exposed screenshot recipes, a topic wall, and four equally
  prominent actions. On mobile those actions occupied almost the entire first
  viewport before the preview.
- Long records such as Sensors rendered dozens of scenarios as one flat wall.
  Requirements were useful but fragmented across a dense sticky facts card.
- The migration section was one of the largest areas on every detail route even
  though it did not help someone run or understand the current code.
- Code routes duplicated navigation actions, used text-heavy copy controls, and
  let the mobile file strip obscure its horizontal navigation model.
- The 320 px header clipped trailing navigation. Dark-mode landing artwork lost
  most of its visual structure.

## Experience principles

1. **Lead with the outcome.** Titles and summaries answer what the code helps a
   developer build. Technical project names, provider labels, and source links
   stay available as supporting context.
2. **Show product value, not repository process.** Pull requests, merge dates,
   catalog pipelines, porting work, and metadata status are not navigation or
   discovery concepts.
3. **One clear next action.** A page may have one primary source action. Commands
   live beside the instructions they execute and use icon-sized copy controls.
4. **Read like documentation.** Detail order is Overview, Run, Scenarios, Key
   APIs, Code, Requirements, Limitations, Source and documentation, Related.
5. **Use progressive disclosure for volume.** A useful first set remains visible;
   large scenario, API, and source collections expand with native HTML controls.
6. **Make provenance quiet and durable.** Every record resolves a source
   descriptor with a human label and canonical URL. `WinUI samples` is the local
   default; the model can accept future WinUI Gallery and Windows App SDK records
   without changing card hierarchy.
7. **Let Windows character support comprehension.** Segoe UI Variable,
   disciplined geometry, Mica/acrylic surfaces, reveal lighting, familiar focus
   treatment, Fluent System Icons, and app-window depth form one shared system.
   Decorative effects never replace labels, previews, or links.
8. **Static HTML is the complete experience.** Theme switching and Browse are
   enhancements. No-JavaScript, reduced-motion, Save-Data, low-memory, WebGL
   failure, and forced-colors paths retain the same content and hierarchy.

## Information architecture

- **Home**: developer promise, interactive Windows workspace, outcome pathways,
  curated implementations, and a compact local-build start.
- **Browse**: search, source/category/requirement facets, selected-filter summary,
  intent-first result cards, and shareable URL state.
- **Detail**: outcome and preview first; source and requirements second; runnable
  commands and curated implementation content in documentation order.
- **Code**: sample context, compact file navigation, readable source, and small
  accessible copy/open controls.

Migration notes are never read, indexed, linked, or rendered. The README remains
source material in the repository, not a portal destination. A dedicated
limitations section may be read at build time; prose that is clearly only about
porting is removed while current runtime, API, hardware, or behavior constraints
remain.

## Visual and interaction system

The additive federated contract keeps provider/source labels quiet and preserves
pinned provenance for audit without making migration or PR details search content.
When a later UI layer consumes it, one provider source unit remains one result;
implementation variants stay nested. Upstream editorial badges remain distinct
from portal recency, which comes only from reviewed sync history rather than
upstream commit time.

The workspace composition uses real catalog titles and categories inside
recognizable navigation, preview, and source-code surfaces. Three.js adds
low-power depth, lighting, and pointer response behind the semantic DOM; it does
not draw essential copy. Shared cards use a restrained pointer reveal and gentle
tilt, with CSS view-timeline reveals where supported. There is no scroll locking,
cursor replacement, or transformed document flow.

At narrow widths navigation becomes a compact horizontal rail, content follows
document order, actions remain at least 44 px, and code/file regions scroll
independently with explicit labels. At 200% zoom the same single-column behavior
applies.

## Accessibility and fallback contract

- One `main`, visible skip navigation, semantic headings, native controls, and
  persistent keyboard focus on every route.
- Copy controls have stable accessible names and a polite status announcement.
- Native `details` handles long content; the Browse drawer uses native `dialog`.
- Reduced motion removes tilt, parallax, animated reveals, and smooth scrolling.
- Forced colors removes translucent decoration and restores system borders and
  backgrounds.
- Save-Data, low memory, narrow viewports, WebGL failure, and context loss keep
  the complete static workspace.

## Performance and route contract

Astro prerenders all routes under `/winui-samples/`; the browser makes no runtime
catalog or GitHub API requests. The 427-route baseline and safe curated-code
boundary remain intact. The redesign must not exceed the existing 669,000-byte
Browse ceiling, and should remain near or below the measured 115.5 KiB initial
landing and 125.8 KiB lazy Three.js gzip payloads.
