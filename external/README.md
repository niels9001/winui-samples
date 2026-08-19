# Federated catalog inputs

This directory contains reviewed build inputs for external sample providers. See
[`docs/FEDERATED_CATALOG.md`](../docs/FEDERATED_CATALOG.md) for identity,
provenance, lifecycle, security, and provider-adapter rules.

- `providers.json` registers stable provider ids and source-unit granularity.
- `locks.json` pins exact repository commit, tree, and selected blob identities.
- `cache/manifest.json` indexes content-addressed reviewed bytes.
- `history.json` is the source of lifecycle state and deletion decisions.
- `generated/catalog.json` is ignored and recreated offline.

Both registered providers are enabled with enforced completeness: 120 WinUI
Gallery pages and 42 Windows App SDK conceptual families. Gallery examples and
sample definitions, and Windows App SDK variants/scenarios, remain nested rather
than becoming independent portal records.

Normal site and catalog commands never resolve upstream `main`. Only the explicit
`external:refresh` command may use the GitHub network client.

`pnpm site:prepare` validates these inputs, generates the external catalog, and
joins it with the 71 local records. A provider can never disappear or fall back to
zero records when cache, count, license, or hash validation fails.
