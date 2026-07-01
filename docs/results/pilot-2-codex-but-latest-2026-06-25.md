# Pilot 2 Codex `but+skill` 2026-06-25 Reruns

> Current results: this per-pilot rerun is historical context. The latest k=5 full-matrix test run is displayed in [full-k5-2026-07-01.md](full-k5-2026-07-01.md).

Date: 2026-06-25 and 2026-06-26

Task: `pilot-2-multi-amend`

Scope: Codex `gpt-5.5`, `but+skill`, `k=3`, latest local GitButler binary and skill from `/Users/kiril/src/gitbutler`.

Binary: `/Users/kiril/src/gitbutler/target/release/but` (`but dev`)

Skill: `/Users/kiril/src/gitbutler/crates/but/skill`

Batches:

- `tmp/pilot-runs/pilot2-codex-but-latest-k3-20260625-215616`
- `tmp/pilot-runs/pilot2-codex-but-after-steering-k3-20260626-003548`

## Headline

All three fresh Codex `but+skill` runs passed. Against the checked-in 2026-06-22 full-matrix baseline for this same scenario and arm, the latest skill/binary cut mean wall time by 52.6%, median wall time by 48.1%, task VC commands by 34.7%, and eliminated failed task VC commands.

The 2026-06-26 after-steering rerun also passed 3/3 and improved the command shape: every run used one `but status -fv`, one `but diff`, then three direct `but amend` calls. Mean wall time fell to 37.5s, task VC commands fell to 5.0, and warm transcript fell to 15.2 KB.

## Scorecard

Setup work is excluded from measured agent duration and command metrics: fixture creation, `but setup`, applying `amend-series`, skill installation, local agent instruction files, and dirty-state application.

| Batch | n | Pass | Mean Wall | Median Wall | Max Wall | Task VC Cmds | Inspect | Mutate | Failed Task VC | Cold Transcript | Warm Transcript |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 2026-06-22 full matrix | 3 | 3/3 | 84.9s | 76.2s | 125.8s | 9.7 | 6.0 | 3.3 | 0.3 | 29.5 KB | 24.5 KB |
| 2026-06-25 latest skill/binary | 3 | 3/3 | 40.2s | 39.5s | 42.6s | 6.3 | 3.3 | 3.0 | 0.0 | 24.0 KB | 18.9 KB |
| 2026-06-26 after steering | 3 | 3/3 | 37.5s | 34.2s | 47.8s | 5.0 | 2.0 | 3.0 | 0.0 | 30.9 KB | 15.2 KB |

## Latest Delta

| Metric | Delta | Percent |
| --- | ---: | ---: |
| Mean wall vs 2026-06-22 `but+skill` | -47.4s | -55.8% |
| Median wall vs 2026-06-22 `but+skill` | -42.0s | -55.1% |
| Task VC commands vs 2026-06-22 `but+skill` | -4.7 | -48.3% |
| Mean wall vs 2026-06-25 latest | -2.7s | -6.7% |
| Task VC commands vs 2026-06-25 latest | -1.3 | -21.1% |
| Failed task VC commands | -0.3 | n/a |
| Warm transcript vs 2026-06-22 `but+skill` | -9.3 KB | -38.0% |

## Command Shape

The fresh runs used the intended GitButler history-edit shape: inspect commit and hunk IDs, then amend each target commit directly.

The 2026-06-26 rerun used this shape in all three runs:

```bash
but status -fv
but diff
but amend <validation-commit> --changes <ids>
but amend <scoring-commit> --changes <ids>
but amend <docs-commit> --changes <ids>
```

The 2026-06-25 run sometimes refreshed `but diff` between amends. The 2026-06-26 run did not; all runs avoided failed task-level VC commands.

## Latest Individual Runs

| Run | Pass | Wall | Task VC Cmds | Inspect | Mutate | Failed Task VC | Platform VC | Warm Transcript |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `pilot2-codex-but-after-steering-k3-1` | yes | 30.5s | 5 | 2 | 3 | 0 | 12 | 15.1 KB |
| `pilot2-codex-but-after-steering-k3-2` | yes | 47.8s | 5 | 2 | 3 | 0 | 12 | 15.2 KB |
| `pilot2-codex-but-after-steering-k3-3` | yes | 34.2s | 5 | 2 | 3 | 0 | 12 | 15.3 KB |

## Latest Provenance

The 2026-06-26 rerun used the real GitButler setup output and clean source snapshots:

- Instruction source command: `but agent setup --print`
- Setup block SHA-256: `fbec593878727e872b248adfd0226b3555e5bd31273ac7506018d2679b68e897`
- Binary SHA-256: `27e7368d50857465c17c7d91591df972c9cfc28b67417bdc593e81eebb7d4d42`
- Skill file SHA-256: `e4856d3a6a09dc60bb76e4f18a715d82c4078791dc373086d01af32b35d2dbed`
- Skill tree SHA-256: `b39f059ca747afed33a1e7255d3cd7a427c9e28011debbf7a77e8fdfeabb9229`
- GitButler source head: `2e9a1b454b087d4047a3733afa52812c15805e0d`
- Skill source dirty: `false`
- Binary source dirty: `false`

## Included Runs

| Group | Run IDs |
| --- | --- |
| Codex `but+skill`, latest skill/binary | `pilot2-codex-but-latest-k3-1`, `pilot2-codex-but-latest-k3-2`, `pilot2-codex-but-latest-k3-3` |
| Codex `but+skill`, after steering | `pilot2-codex-but-after-steering-k3-1`, `pilot2-codex-but-after-steering-k3-2`, `pilot2-codex-but-after-steering-k3-3` |

Raw artifacts live under `tmp/pilot-runs/` and are intentionally not checked in.

Command used:

```bash
npm run pilot:agent -- --task pilot-2-multi-amend --agent codex --arm 'but+skill' --but-bin /Users/kiril/src/gitbutler/target/release/but --skill-dir /Users/kiril/src/gitbutler/crates/but/skill
```
