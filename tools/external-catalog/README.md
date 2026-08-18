# External catalog tooling

The offline pipeline is `loadExternalState` -> `validateEnabledCache` -> provider
`generate(context)` -> `validateProviderOutput` -> `mergeProviderOutputs` ->
atomic canonical JSON.

Canonical output sorts object keys while preserving array order. Producers must
sort set-like inventories explicitly; authored sequences remain ordered data.

Provider `generate` functions receive the exact registry entry, lock, and reviewed
history, an offline-only `readArtifact(path)` function, and `createRouteSlug`.
Lifecycle fields and `new`/`updated` portal badges must derive from that committed
history rather than adapter constants. Adapters must return the strict
`ProviderOutput` shape from `types.ts` and must not import `lib/network.mjs`.

Provider refresh modules are separate and run only through `external:refresh`.
They receive the shared GitHub client and should stage auditable lock, cache,
curation, license, and reviewed-history changes rather than modifying generated
output. Refreshes merge prior sync/record state, retain reviewed tombstones, and
fail when an active record disappears without an explicit reviewed decision.
Gallery refreshes compare persisted normalized content hashes per record instead
of marking the full provider updated when only its lock changes. Adapters emit
persisted reviewed tombstones and route redirects from provider-owned curation.

The enabled providers enforce their reviewed inventory sizes (Gallery 120;
Windows App SDK 42). Windows App SDK source is restricted to `Samples` plus the
single curated `DynamicDependenciesSample` root. Normalized images use an explicit
accessibility contract: `decorative: true` requires `alt: ""`; informative images
require non-whitespace alt text. Provider adapters may not weaken either boundary.
