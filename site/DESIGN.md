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
4. Ship progressively. Core navigation and content are static HTML; the theme
   menu is an isolated React island and respects light, dark, and system modes.
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

## Follow-up boundaries

This layer proves the shell, generated data, and three route shapes. It does not
set the final landing composition, introduce Three.js, implement advanced
filters, render full source files, rank related samples, or design screenshot
galleries. Those features should compose the existing primitives and catalog
types instead of moving data access into page components.
