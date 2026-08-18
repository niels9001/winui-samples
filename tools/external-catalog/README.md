# External catalog tooling

The offline pipeline is `loadExternalState` -> `validateEnabledCache` -> provider
`generate(context)` -> `validateProviderOutput` -> `mergeProviderOutputs` ->
atomic canonical JSON.

Provider `generate` functions receive the exact registry entry and lock, an
offline-only `readArtifact(path)` function, and `createRouteSlug`. They must return
the strict `ProviderOutput` shape from `types.ts`. They must not import
`lib/network.mjs`.

Provider refresh modules are separate and run only through `external:refresh`.
They receive the shared GitHub client and should stage auditable lock, cache,
curation, license, and reviewed-history changes rather than modifying generated
output.
