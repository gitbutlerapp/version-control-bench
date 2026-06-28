# Pilot 2 Claude `but+skill` 2026-06-25 Rerun

> Current results: this per-pilot rerun is historical context. The latest k=5 full-matrix test run is displayed in [full-k5-2026-06-28.md](full-k5-2026-06-28.md).

Date: 2026-06-25

Task: `pilot-2-multi-amend`

Scope: Claude via `claude -p`, `but+skill`, `k=3`, latest local GitButler binary and skill from `/Users/kiril/src/gitbutler`.

Binary: `/Users/kiril/src/gitbutler/target/release/but` (`but dev`)

Skill: `/Users/kiril/src/gitbutler/crates/but/skill`

Batch: `tmp/pilot-runs/pilot2-claude-but-latest-k3-20260625-220022`

## Headline

All three fresh Claude `but+skill` runs passed. Against the checked-in 2026-06-22 full-matrix baseline for this same scenario and arm, the latest skill/binary was modestly faster: mean wall time fell 11.2%, median wall time fell 3.3%, task VC commands fell 9.6%, and failed task VC commands stayed at zero. Transcript size stayed effectively flat.

## Scorecard

Setup work is excluded from measured agent duration and command metrics: fixture creation, `but setup`, applying `amend-series`, skill installation, local agent instruction files, and dirty-state application.

| Batch | n | Pass | Mean Wall | Median Wall | Max Wall | Task VC Cmds | Inspect | Mutate | Failed Task VC | Cold Transcript | Warm Transcript |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 2026-06-22 full matrix | 3 | 3/3 | 54.5s | 53.0s | 58.4s | 7.0 | 4.0 | 3.0 | 0.0 | 1.5 KB | 1.5 KB |
| 2026-06-25 latest skill/binary | 3 | 3/3 | 48.4s | 51.2s | 54.6s | 6.3 | 3.3 | 3.0 | 0.0 | 1.5 KB | 1.5 KB |

## Delta

| Metric | Delta | Percent |
| --- | ---: | ---: |
| Mean wall | -6.1s | -11.2% |
| Median wall | -1.8s | -3.3% |
| Task VC commands | -0.7 | -9.6% |
| Failed task VC commands | 0.0 | n/a |
| Warm transcript | +0.1 KB | +3.7% |

## Command Shape

The fresh runs preserved the expected direct history-edit shape: inspect commit and hunk IDs, then amend each target commit directly.

Typical trace:

```bash
but status -fv
but diff
but amend <validation-commit> --changes <ids>
but amend <scoring-commit> --changes <ids>
but amend <docs-commit> --changes <ids>
```

One run used compact `but status` instead of `but status -fv`, and two runs refreshed `but diff` between amends. Claude Code also emitted many platform-level Git probes; the runner classified those separately from task VC commands.

## Included Runs

| Group | Run IDs |
| --- | --- |
| Claude `but+skill`, latest skill/binary | `pilot2-claude-but-latest-k3-1`, `pilot2-claude-but-latest-k3-2`, `pilot2-claude-but-latest-k3-3` |

Raw artifacts live under `tmp/pilot-runs/` and are intentionally not checked in.

Command used:

```bash
npm run pilot:agent -- --task pilot-2-multi-amend --agent claude --arm 'but+skill' --but-bin /Users/kiril/src/gitbutler/target/release/but --skill-dir /Users/kiril/src/gitbutler/crates/but/skill
```
