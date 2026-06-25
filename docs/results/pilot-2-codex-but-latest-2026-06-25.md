# Pilot 2 Codex `but+skill` Latest Rerun

Date: 2026-06-25

Task: `pilot-2-multi-amend`

Scope: Codex `gpt-5.5`, `but+skill`, `k=3`, latest local GitButler binary and skill from `/Users/kiril/src/gitbutler`.

Binary: `/Users/kiril/src/gitbutler/target/release/but` (`but dev`)

Skill: `/Users/kiril/src/gitbutler/crates/but/skill`

Batch: `tmp/pilot-runs/pilot2-codex-but-latest-k3-20260625-215616`

## Headline

All three fresh Codex `but+skill` runs passed. Against the checked-in 2026-06-22 full-matrix baseline for this same scenario and arm, the latest skill/binary cut mean wall time by 52.6%, median wall time by 48.1%, task VC commands by 34.7%, and eliminated failed task VC commands.

## Scorecard

Setup work is excluded from measured agent duration and command metrics: fixture creation, `but setup`, applying `amend-series`, skill installation, local agent instruction files, and dirty-state application.

| Batch | n | Pass | Mean Wall | Median Wall | Max Wall | Task VC Cmds | Inspect | Mutate | Failed Task VC | Cold Transcript | Warm Transcript |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 2026-06-22 full matrix | 3 | 3/3 | 84.9s | 76.2s | 125.8s | 9.7 | 6.0 | 3.3 | 0.3 | 29.5 KB | 24.5 KB |
| 2026-06-25 latest skill/binary | 3 | 3/3 | 40.2s | 39.5s | 42.6s | 6.3 | 3.3 | 3.0 | 0.0 | 24.0 KB | 18.9 KB |

## Delta

| Metric | Delta | Percent |
| --- | ---: | ---: |
| Mean wall | -44.7s | -52.6% |
| Median wall | -36.7s | -48.1% |
| Task VC commands | -3.4 | -34.7% |
| Failed task VC commands | -0.3 | n/a |
| Warm transcript | -5.6 KB | -22.9% |

## Command Shape

The fresh runs used the intended GitButler history-edit shape: inspect commit and hunk IDs, then amend each target commit directly.

Typical trace:

```bash
but status -fv
but diff
but amend <validation-commit> --changes <ids>
but amend <scoring-commit> --changes <ids>
but amend <docs-commit> --changes <ids>
```

Two runs refreshed `but diff` between amends, but all runs avoided failed task-level VC commands.

## Included Runs

| Group | Run IDs |
| --- | --- |
| Codex `but+skill`, latest skill/binary | `pilot2-codex-but-latest-k3-1`, `pilot2-codex-but-latest-k3-2`, `pilot2-codex-but-latest-k3-3` |

Raw artifacts live under `tmp/pilot-runs/` and are intentionally not checked in.

Command used:

```bash
npm run pilot:agent -- --task pilot-2-multi-amend --agent codex --arm 'but+skill' --but-bin /Users/kiril/src/gitbutler/target/release/but --skill-dir /Users/kiril/src/gitbutler/crates/but/skill
```
