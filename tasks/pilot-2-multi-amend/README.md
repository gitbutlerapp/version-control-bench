# Pilot 2: Selective Multi-Amend

## At a Glance

Plain English: several uncommitted fixes already exist, and each one belongs inside a different older commit.

Real-world shape: review feedback produced validation, scoring, and docs fixups. Instead of adding a vague "fix review comments" commit, the agent must fold each fixup into the commit that introduced that topic.

```text
dirty fixes
  validation fix  -> old commit: refactor validation helpers
  scoring fix     -> old commit: add lead scoring
  docs fix        -> old commit: document response behavior

left over: debug/config/investigation work stays uncommitted
```

This pilot starts from a tiny TypeScript repo with a checked-out `amend-series` branch containing five existing commits ahead of `main`.

The agent must amend selected dirty hunks into three different pre-existing commits:

- bottom commit: `refactor validation helpers`
- middle commit: `add lead scoring`
- top commit: `document response behavior`

The task gives the routing spec directly. It is not testing whether the agent can infer semantic targets. It is testing whether the version-control tool helps the agent route multiple dirty files and hunks into existing commits while preserving unrelated leftovers.

The dirty state mixes target and leftover work across multiple files:

- `README.md` has one hunk for the bottom commit and one hunk for the top commit.
- `src/lead.ts` has validation, scoring, and leftover debug hunks.
- `tests/lead.test.ts` has validation and scoring test hunks.
- `src/config.ts` and `notes/investigation.md` are leftovers.

The task is intentionally VC-only: all file changes exist before the agent starts.

## Local QA

From the repo root:

```bash
npm run pilot2:check
```

This proves the no-op and known-wrong states fail while both reference solutions pass.

Run agent trials with:

```bash
npm run pilot:agent -- --task pilot-2-multi-amend --agent codex --arm git
npm run pilot:agent -- --task pilot-2-multi-amend --agent codex --arm 'but+skill'
```

For `but+skill`, harness setup checks out `main`, runs `but setup`, applies the existing `amend-series` branch, installs the GitButler skill and local agent instructions, then applies the dirty task state. This setup is not included in agent duration or command metrics.
