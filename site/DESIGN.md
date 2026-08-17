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
4. Ship progressively. Core navigation, detail pages, and curated code routes
   are static HTML. The theme menu and browse explorer are isolated React
   islands; both respect light, dark, and system modes.
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

Later layers own the final landing composition, Three.js art direction,
captured screenshots, and activity/recency data. They should compose the
explorer libraries and catalog types rather than duplicating indexing, media,
URL, or relationship logic.
