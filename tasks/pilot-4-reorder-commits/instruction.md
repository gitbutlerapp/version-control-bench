Reorder the existing commits on the `reorder-series` branch. Move the adjacent delivery-related block (`add retry policy` and `add notification sender`) earlier in the branch. Do not change any file contents and do not create functional changes.

Final commit order must be exactly this, oldest to newest:

1. `add app configuration`
2. `add retry policy`
3. `add notification sender`
4. `add customer model`
5. `add email formatter`
6. `document notification flow`

The commit messages and each commit's content should stay attached to the same subject. Leave the worktree clean.
