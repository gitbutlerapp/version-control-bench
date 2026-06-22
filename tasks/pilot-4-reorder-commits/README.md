# Pilot 4: Reorder Existing Commits

This pilot starts from a tiny TypeScript repo with a checked-out `reorder-series` branch containing six existing commits ahead of `main`.

The agent must move an adjacent delivery-related commit block earlier in the branch while preserving every commit's content and message. No file contents should change, no new functional commits should be introduced, and the final worktree should be clean.

Initial order, oldest to newest:

1. `add app configuration`
2. `add customer model`
3. `add email formatter`
4. `add retry policy`
5. `add notification sender`
6. `document notification flow`

Requested final order, oldest to newest:

1. `add app configuration`
2. `add retry policy`
3. `add notification sender`
4. `add customer model`
5. `add email formatter`
6. `document notification flow`

This is intentionally VC-only: all commits already exist before the agent starts. It tests moving a related commit block without dirty hunk routing or conflict resolution.

## Local QA

From the repo root:

```bash
npm run pilot4:check
```

Run agent trials with:

```bash
npm run pilot:agent -- --task pilot-4-reorder-commits --agent codex --arm git
npm run pilot:agent -- --task pilot-4-reorder-commits --agent codex --arm 'but+skill'
```

For `but+skill`, harness setup checks out `main`, runs `but setup`, applies the existing `reorder-series` branch, installs the GitButler skill and local agent instructions, and starts the agent from the existing six-commit branch state. This setup is not included in agent duration or command metrics.
