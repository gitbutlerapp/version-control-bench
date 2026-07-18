The `main` branch has moved ahead while work on `notify-retry` was in progress. Bring `notify-retry` up to date: rebuild it on top of the current `main` with linear history, keeping its two commits and their messages intact. Do not modify `main` itself.

Two incoming changes clash with this branch's work:

- `src/notify.ts`: keep both notification channels — the `sms` channel added on this branch and the `push` channel added on `main`.
- `src/config.ts`: this branch deliberately tuned the retry limit to 4; keep that over the value `main` bumped it to.

The worktree also has uncommitted work in progress: a README edit and an untracked rollout checklist. Both must survive the update exactly as they are and stay uncommitted. Leave no conflict markers, unmerged files, or half-finished operations behind.
