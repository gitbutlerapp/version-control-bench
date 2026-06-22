# Pilot 4 Verifier

The verifier checks that:

- `reorder-series` has exactly the requested final subject order
- each commit subject still owns its expected changed paths and snippets
- the final branch tree matches the original full branch tree
- there are no merge commits, dirty changes, or unresolved conflicts

The no-op state intentionally has the correct final tree but the wrong graph, so subject order is a hard requirement.
