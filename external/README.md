# Federated catalog inputs

This directory contains reviewed build inputs for external sample providers. See
[`docs/FEDERATED_CATALOG.md`](../docs/FEDERATED_CATALOG.md) for identity,
provenance, lifecycle, security, and provider-adapter rules.

- `providers.json` registers stable provider ids and source-unit granularity.
- `locks.json` pins exact repository commit, tree, and selected blob identities.
- `cache/manifest.json` indexes content-addressed reviewed bytes.
- `history.json` is the source of lifecycle state and deletion decisions.
- `generated/catalog.json` is ignored and recreated offline.

Normal site and catalog commands never resolve upstream `main`. Only the explicit
`external:refresh` command may use the GitHub network client.
