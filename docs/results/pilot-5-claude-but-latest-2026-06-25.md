# Pilot 5 Claude `but+skill` 2026-06-25 Rerun

> Current results: this per-pilot rerun is historical context. The latest k=5 full-matrix test run is displayed in [full-k5-2026-06-27.md](full-k5-2026-06-27.md).

Date: 2026-06-25

Task: `pilot-5-squash-commits`

Scope: Claude via `claude -p`, `but+skill`, `k=3`, latest local GitButler binary and skill from `/Users/kiril/src/gitbutler`, clean Claude config.

Binary: `/Users/kiril/src/gitbutler/target/release/but` (`but dev`)

Skill: `/Users/kiril/src/gitbutler/crates/but/skill`

Batch: `tmp/pilot-runs/pilot5-claude-but-latest-k3-20260625`

## Headline

All three fresh Claude `but+skill` runs passed. Against the original 2026-06-22 full-matrix batch, this removes the old 131s over-verification outlier. Against the 2026-06-23 follow-up rerun, the latest skill/binary is slightly faster and keeps the same ideal command shape: compact status plus two squashes.

## Scorecard

Setup work is excluded from measured agent duration and command metrics: fixture creation, `but setup`, applying `squash-series`, skill installation, local agent instruction files, and dirty-state application.

| Batch | n | Pass | Mean Wall | Median Wall | Max Wall | Task VC Cmds | Inspect | Mutate | Failed Task VC | Warm Transcript |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 2026-06-22 full matrix | 3 | 3/3 | 62.6s | 31.7s | 131.0s | 6.3 | 4.0 | 2.0 | 0.0 | 1.6 KB |
| 2026-06-23 follow-up rerun | 3 | 3/3 | 30.7s | 33.1s | 33.7s | 3.0 | 1.0 | 2.0 | 0.0 | 1.5 KB |
| 2026-06-25 latest skill/binary | 3 | 3/3 | 29.3s | 27.9s | 33.1s | 3.0 | 1.0 | 2.0 | 0.0 | 1.4 KB |

## Delta

Compared with the 2026-06-23 follow-up rerun:

| Metric | Delta | Percent |
| --- | ---: | ---: |
| Mean wall | -1.3s | -4.4% |
| Median wall | -5.2s | -15.8% |
| Task VC commands | 0.0 | 0.0% |
| Failed task VC commands | 0.0 | n/a |
| Warm transcript | -0.1 KB | -7.2% |

## Command Shape

All three fresh runs used the expected direct squash shape:

```bash
but status
but squash <source> <source> <target> -m "add retry support"
but squash <source> <target> -m "add parser pipeline"
```

All three ended with the requested final order:

```text
add parser token model
add parser pipeline
add export endpoint
add retry support
```

Claude Code still emitted platform-level Git probes, but those were classified separately from task VC commands. The task-level `but` runtime stayed sub-second in every run.

## Included Runs

| Group | Run IDs |
| --- | --- |
| Claude `but+skill`, latest skill/binary | `pilot5-claude-but-latest-k3-1`, `pilot5-claude-but-latest-k3-2`, `pilot5-claude-but-latest-k3-3` |

Raw artifacts live under `tmp/pilot-runs/` and are intentionally not checked in.

Command used:

```bash
node scripts/run-pilot-agent.mjs --task pilot-5-squash-commits --agent claude --arm 'but+skill' --but-bin /Users/kiril/src/gitbutler/target/release/but --skill-dir /Users/kiril/src/gitbutler/crates/but/skill
```
