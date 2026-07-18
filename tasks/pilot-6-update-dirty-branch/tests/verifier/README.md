# Verifier

The deterministic verifier lives at `scripts/verify-pilot6.mjs` in the repo root; `tests/verify.sh` is the stable entrypoint. It inspects final Git state only:

- `main` untouched at the upstream tip (protected ref)
- `notify-retry` linear on top of `main`, two commits, subjects preserved
- committed conflict combined (either channel ordering is accepted)
- uncommitted README edit preserved verbatim and still uncommitted
- untracked note preserved; no markers, unmerged entries, in-progress operations, or leftover stash entries
