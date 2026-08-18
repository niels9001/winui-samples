# External catalog cache

This directory stores only reviewed, selected upstream artifacts. The manifest is
committed; payloads use `blobs/sha256/<first-two-hex>/<sha256>` and may be committed
when an enabled provider needs them for an offline build. Generated provider output
and the merged catalog are never committed.

Every entry is bound to a provider, repository, commit, tree, Git blob, byte length,
media type, and SHA-256 digest. Normal generation reads only these files and never
uses the network.
