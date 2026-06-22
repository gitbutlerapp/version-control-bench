Squash commit groups on the existing `squash-series` branch. Do not change any file contents and do not create functional changes.

Keep these commits as separate commits:

- `add parser token model`
- `add export endpoint`

Squash these adjacent commit groups:

- Squash `extract parser helpers` and `wire parser helpers` into one commit named `add parser pipeline`.
- Squash `add retry option`, `test retry option`, and `document retry option` into one commit named `add retry support`.

The final branch order, oldest to newest, should be:

1. `add parser token model`
2. `add parser pipeline`
3. `add export endpoint`
4. `add retry support`

Leave the worktree clean.
