# Pilot 3: Split Broad Commit

## At a Glance

Plain English: one older commit is doing too much, so it needs to become several clean commits.

Real-world shape: a broad workflow commit mixes validation, scoring, docs, and stray debug work. The branch should read as three reviewable commits, with the stray work pushed back out to the worktree.

```text
before:
  main - [big mixed commit] - [later routing commit]

after:
  main - [validation] - [scoring] - [docs] - [later routing commit]

left over:
  debug/config/investigation work becomes uncommitted
```

This pilot starts from a tiny TypeScript repo with a checked-out `split-workflow` branch containing four existing commits ahead of `main`.

The non-top commit `add lead workflow` is intentionally too broad. It contains validation changes, scoring changes, workflow documentation, and unrelated leftover/debug changes. The existing top commit, `add handler routing metadata`, must stay above the replacement commits.

The agent must replace that broad commit with three more granular commits:

- `refactor validation helpers`
- `tune lead scoring`
- `document lead workflow`

The task gives the routing spec directly. It is not testing whether the agent can infer semantic targets. It is testing whether the version-control tool helps the agent split one existing non-top commit into ordered semantic commits while preserving unrelated leftovers as uncommitted work and keeping later history on top.

The broad commit mixes target and leftover work across multiple files:

- `src/lead.ts` has validation, scoring, and leftover debug hunks.
- `tests/lead.test.ts` has validation and scoring test hunks.
- `README.md` and `docs/lead-workflow.md` are documentation changes.
- `src/config.ts` and `notes/investigation.md` are leftovers.

The task is intentionally VC-only: all target and leftover changes already exist in the broad commit before the agent starts.

## Local QA

From the repo root:

```bash
npm run pilot3:check
```

This proves the no-op and known-wrong states fail while both reference solutions pass.

Run agent trials with:

```bash
npm run pilot:agent -- --task pilot-3-split-commit --agent codex --arm git
npm run pilot:agent -- --task pilot-3-split-commit --agent codex --arm 'but+skill'
```

For `but+skill`, harness setup checks out `main`, runs `but setup`, applies the existing `split-workflow` branch, installs the GitButler skill and local agent instructions, and starts the agent from the committed non-top broad-change state. This setup is not included in agent duration or command metrics.
