# Pilot 1 `but+skill` Clean-Harness Reruns

> Current results: this per-pilot rerun is historical context. The latest k=5 full-matrix test run is displayed in [full-k5-2026-06-29.md](full-k5-2026-06-29.md).

Date: 2026-06-25 and 2026-06-26

Task: `pilot-1-selective-validation`

Scope: Codex and Claude, `but+skill`, `k=3`, latest local GitButler binary and skill from `/Users/kiril/src/gitbutler`, after removing benchmark-local GitButler recipes from generated `AGENTS.md`/`CLAUDE.md`.

Batches:

- `tmp/pilot-runs/pilot1-codex-but-clean-harness-k3-20260625-231306`
- `tmp/pilot-runs/pilot1-codex-but-after-steering-k3-20260626-002151`
- `tmp/pilot-runs/pilot1-claude-but-after-steering-k3-20260626-002354`

## Headline

All three clean-harness Codex `but+skill` runs passed. The result matches the older honest scenario-1 `but+skill` shape rather than the faster pre-fix skill-aligned rerun.

The earlier 16.5s skill-aligned result should be treated as polluted by benchmark-local cookbook instructions. With those removed, Codex returns to about 22s mean wall time while keeping the same strong command-count advantage over the old plain-`git` baseline.

The 2026-06-26 after-steering reruns keep that fixed shape. Codex is a little faster than the prior clean-harness sample; Claude is slower than its previous tuned sample, but still uses the right `but` commands and has zero task-level `but` failures.

## Latest After-Steering Scorecard

| Agent | Batch | n | Pass | Mean Wall | Median Wall | Max Wall | Task VC Cmds | Inspect | Mutate | Failed Task VC | Platform VC | Warm Transcript |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Codex | `pilot1-codex-but-after-steering-k3-20260626-002151` | 3 | 3/3 | 20.5s | 20.5s | 22.1s | 2.0 | 1.0 | 1.0 | 0.0 | 12.0 | 7.3 KB |
| Claude | `pilot1-claude-but-after-steering-k3-20260626-002354` | 3 | 3/3 | 43.0s | 52.0s | 53.7s | 2.3 | 1.3 | 1.0 | 0.0 | 24.0 | 1.0 KB |

Claude comparison:

- Previous tuned Claude run, `pilot1-claude-but-stop-explicit-k3-20260626-001237`: 3/3 pass, 28.1s mean wall, 2.3 task VC commands, 0.0 failed task VC commands.
- Earlier bad clean-harness Claude run, `pilot1-claude-but-clean-harness-k3-20260625-231801`: 3/3 pass, 76.4s mean wall, 10.7 task VC commands, 2.0 failed task VC commands.
- Current Claude is slower than the tuned sample, but the command behavior is still fixed; the remaining slowdown looks like agent/platform overhead rather than `but` syntax flailing.

## Latest Individual Runs

| Run | Agent | Pass | Wall | Task VC Cmds | Inspect | Mutate | Failed Task VC | Platform VC | Warm Transcript |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `pilot1-codex-but-after-steering-k3-1` | Codex | yes | 22.1s | 2 | 1 | 1 | 0 | 12 | 7.3 KB |
| `pilot1-codex-but-after-steering-k3-2` | Codex | yes | 18.8s | 2 | 1 | 1 | 0 | 12 | 7.3 KB |
| `pilot1-codex-but-after-steering-k3-3` | Codex | yes | 20.5s | 2 | 1 | 1 | 0 | 12 | 7.3 KB |
| `pilot1-claude-but-after-steering-k3-1` | Claude | yes | 52.0s | 2 | 1 | 1 | 0 | 27 | 1.1 KB |
| `pilot1-claude-but-after-steering-k3-2` | Claude | yes | 53.7s | 3 | 2 | 1 | 0 | 29 | 0.9 KB |
| `pilot1-claude-but-after-steering-k3-3` | Claude | yes | 23.3s | 2 | 1 | 1 | 0 | 16 | 0.9 KB |

Latest command shapes:

```bash
# Codex, all 3 runs
but diff
but commit input-validation -c -m "Add lead input validation" --changes rl:9,qt:e,qp:e

# Claude, 2 of 3 runs
but diff
but commit input-validation -c -m "Add input validation for lead creation" --changes rl:9,qt:e,qp:e

# Claude, 1 of 3 runs
but diff
but commit input-validation -c -m "Add input validation for lead creation" --changes rl:9,qt:e,qp:e
but diff
```

## Latest Provenance

Both 2026-06-26 reruns used the real GitButler setup output and clean source snapshots:

- Instruction source command: `but agent setup --print`
- Setup block SHA-256: `fbec593878727e872b248adfd0226b3555e5bd31273ac7506018d2679b68e897`
- Binary SHA-256: `27e7368d50857465c17c7d91591df972c9cfc28b67417bdc593e81eebb7d4d42`
- Skill file SHA-256: `e4856d3a6a09dc60bb76e4f18a715d82c4078791dc373086d01af32b35d2dbed`
- Skill tree SHA-256: `b39f059ca747afed33a1e7255d3cd7a427c9e28011debbf7a77e8fdfeabb9229`
- GitButler source head: `2e9a1b454b087d4047a3733afa52812c15805e0d`
- Skill source dirty: `false`
- Binary source dirty: `false`

## Original Codex Clean-Harness Scorecard

Setup work is excluded from measured agent duration and command metrics: fixture creation, `but setup`, skill installation, local agent instruction files, and dirty-state application.

| Batch | n | Pass | Mean Wall | Median Wall | Max Wall | Task VC Cmds | Inspect | Mutate | Failed Task VC | Warm Transcript |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 2026-06-22 full matrix | 3 | 3/3 | 22.2s | 22.4s | 22.5s | 2.7 | 1.3 | 1.3 | 0.0 | 6.9 KB |
| 2026-06-25 initial latest | 3 | 3/3 | 22.4s | 22.8s | 23.4s | 2.7 | 1.3 | 1.3 | 0.0 | 7.0 KB |
| 2026-06-25 skill-aligned, pre-fix | 3 | 3/3 | 16.5s | 15.0s | 19.8s | 2.0 | 1.0 | 1.0 | 0.0 | 6.4 KB |
| 2026-06-25 clean harness | 3 | 3/3 | 22.1s | 19.2s | 29.0s | 2.3 | 1.3 | 1.0 | 0.0 | 7.3 KB |

Old plain-`git` Codex baseline for this scenario: 3/3 pass, 56.0s mean wall, 16.7 task VC commands, 11.1 KB warm transcript.

## Original Codex Individual Runs

| Run | Pass | Wall | Task VC Cmds | Inspect | Mutate | Failed Task VC | Platform VC | Warm Transcript |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `pilot1-codex-but-clean-harness-k3-1` | yes | 29.0s | 3 | 2 | 1 | 0 | 12 | 7.3 KB |
| `pilot1-codex-but-clean-harness-k3-2` | yes | 19.2s | 2 | 1 | 1 | 0 | 12 | 7.3 KB |
| `pilot1-codex-but-clean-harness-k3-3` | yes | 18.1s | 2 | 1 | 1 | 0 | 12 | 7.3 KB |

## Original Codex Command Shape

Two runs used the ideal task-level shape:

```bash
but diff
but commit input-validation -c -m "Add lead input validation" --changes <ids>
```

One run added one extra task inspection:

```bash
but status
but diff
but commit input-validation -c -m "Add lead input validation" --changes <ids>
```

The platform VC count is from Codex runtime Git probes, not task-level version-control work.

## Original Codex Clean-Harness Provenance

The generated agent instructions used the real GitButler setup output, not a benchmark-local cookbook:

- Instruction source command: `but agent setup --print`
- Setup block SHA-256: `6ec46d6c222afb3fa9a90a0a48f4c52e87880dd1ee8ce1a6517c5f435ecb829a`
- Binary SHA-256: `0ff96fa9fb4680738ba2a4910bf9e36bb8cf8eeda06908a9a5864b7f5a525b3d`
- Skill file SHA-256: `88a96b0c2dcdbe43cd691db7700c59455d5e2e5caf9d505a8b312a21161c672c`
- Skill tree SHA-256: `bfc6681367a559f39132d875318ab98e0b227f87635b30349a3de34d95d7aa0d`
- Skill source dirty: `false`
- Binary source dirty: `false`

Raw artifacts live under `tmp/pilot-runs/` and are intentionally not checked in.

Command used:

```bash
npm run pilot:agent -- --task pilot-1-selective-validation --agent codex --arm 'but+skill' --but-bin /Users/kiril/src/gitbutler/target/release/but --skill-dir /Users/kiril/src/gitbutler/crates/but/skill
```
