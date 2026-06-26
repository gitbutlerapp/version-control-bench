# Pilot 5 Codex `but+skill` Latest Rerun

Date: 2026-06-25

Task: `pilot-5-squash-commits`

Scope: Codex `gpt-5.5`, `but+skill`, `k=3`, latest local GitButler binary and skill from `/Users/kiril/src/gitbutler`.

Binary: `/Users/kiril/src/gitbutler/target/release/but` (`but dev`)

Skill: `/Users/kiril/src/gitbutler/crates/but/skill`

Batch: `tmp/pilot-runs/pilot5-codex-but-latest-k3-20260625`

## Headline

All three fresh Codex `but+skill` runs passed. Against the checked-in 2026-06-22 full-matrix baseline for this same scenario and arm, the latest skill/binary was slightly faster while preserving the same command shape: compact status plus two squashes.

## Scorecard

Setup work is excluded from measured agent duration and command metrics: fixture creation, `but setup`, applying `squash-series`, skill installation, local agent instruction files, and dirty-state application.

| Batch | n | Pass | Mean Wall | Median Wall | Max Wall | Task VC Cmds | Inspect | Mutate | Failed Task VC | Warm Transcript |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 2026-06-22 full matrix | 3 | 3/3 | 21.5s | 22.1s | 22.4s | 3.0 | 1.0 | 2.0 | 0.0 | 7.1 KB |
| 2026-06-25 latest skill/binary | 3 | 3/3 | 19.7s | 20.2s | 21.1s | 3.0 | 1.0 | 2.0 | 0.0 | 6.8 KB |

## Delta

| Metric | Delta | Percent |
| --- | ---: | ---: |
| Mean wall | -1.8s | -8.5% |
| Median wall | -1.9s | -8.6% |
| Task VC commands | 0.0 | 0.0% |
| Failed task VC commands | 0.0 | n/a |
| Warm transcript | -0.3 KB | -4.9% |

## Command Shape

The fresh runs used the expected direct squash shape:

```bash
but status
but squash <source> <target> -m "add parser pipeline"
but squash <source> <source> <target> -m "add retry support"
```

Two runs squashed the retry-support group first, and one run squashed the parser-pipeline group first. All three ended with the requested final order:

```text
add parser token model
add parser pipeline
add export endpoint
add retry support
```

## Included Runs

| Group | Run IDs |
| --- | --- |
| Codex `but+skill`, latest skill/binary | `pilot5-codex-but-latest-k3-1`, `pilot5-codex-but-latest-k3-2`, `pilot5-codex-but-latest-k3-3` |

Raw artifacts live under `tmp/pilot-runs/` and are intentionally not checked in.

Command used:

```bash
node scripts/run-pilot-agent.mjs --task pilot-5-squash-commits --agent codex --arm 'but+skill' --but-bin /Users/kiril/src/gitbutler/target/release/but --skill-dir /Users/kiril/src/gitbutler/crates/but/skill
```
