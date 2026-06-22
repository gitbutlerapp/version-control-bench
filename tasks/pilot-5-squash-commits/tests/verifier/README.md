# Pilot 5 Verifier

Delegates to `scripts/verify-pilot5.mjs`.

The verifier checks:

- `squash-series` has exactly the requested final subject order
- the old source commit subjects are no longer reachable
- the final branch tree matches the original seven-commit branch tree
- each resulting commit contains the expected path/snippet group
- the current worktree matches the expected final tree
- the worktree is clean and there are no unresolved conflicts
