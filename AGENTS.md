# Agent Instructions

## Version control

- Use GitButler (`but`) for version-control inspection and write operations.
- This repo uses the skip-the-PR workflow: when changes are approved to publish, or when the user says `ship it`, land the session branch directly with `but land <branch>` instead of pushing/opening a PR.
- `but land` updates the configured target branch directly; only run it after clear user approval.
- If the user explicitly asks for a PR, use the PR workflow instead.
