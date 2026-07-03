# Pilot 4 Reorder Guidance Fix

> Current results: this per-pilot rerun is historical context. The latest full-matrix test run is displayed in [full-k7-2026-07-03.md](full-k7-2026-07-03.md).

Date: 2026-06-25

Task: `pilot-4-reorder-commits`

Scope: `but+skill`, latest local GitButler binary and skill from `/Users/kiril/src/gitbutler`, clean agent config.

Binary: `/Users/kiril/src/gitbutler/target/release/but`

Skill: `/Users/kiril/src/gitbutler/crates/but/skill`

## Headline

The Claude regression was a planning failure around `but move`, not a GitButler CLI runtime failure. The failing run preserved file contents and had no command errors, but made an unnecessary second move after the correct block move and ended with the wrong commit graph.

Fix: make adjacent-block reorders a first-class recipe in both the benchmark arm instructions and the GitButler skill. When a task names an adjacent commit block, the agent should preserve the block's internal order, anchor on the commit that should follow the block, run one comma-separated `but move`, then stop if the returned status shows the requested order.

## Scorecard

Setup work is excluded from measured agent duration and command metrics.

| Batch | Agent | n | Pass | Mean Wall | Median Wall | Max Wall | Task VC Cmds | Inspect | Mutate | Failed Task VC |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 2026-06-22 full matrix | Claude | 3 | 3/3 | 23.9s | 22.9s | 26.5s | 2.0 | 1.0 | 1.0 | 0.0 |
| 2026-06-25 latest before fix | Claude | 3 | 2/3 | 27.0s | 28.5s | 29.9s | 2.3 | 1.0 | 1.3 | 0.0 |
| 2026-06-25 after guidance fix | Claude | 3 | 3/3 | 30.2s | 25.9s | 41.4s | 2.0 | 1.0 | 1.0 | 0.0 |
| 2026-06-25 after guidance fix | Codex | 3 | 3/3 | 19.4s | 17.9s | 24.5s | 2.0 | 1.0 | 1.0 | 0.0 |

The fixed Claude mean is noisy because run 1 spent extra wall time before/around the same two task commands. Task-level shape is restored.

## Failure Shape

The bad Claude run used:

```bash
but status
but move 4ef9396,e7b2cd8 bfc9b22
but move 95ef59c a58db8a
```

It ended with:

```text
add notification sender
add retry policy
add app configuration
add customer model
add email formatter
document notification flow
```

Expected:

```text
add app configuration
add retry policy
add notification sender
add customer model
add email formatter
document notification flow
```

The first move was the right kind of operation. The second move broke the adjacent block.

## Fixed Command Shape

All fixed reruns used the intended one-move recipe:

```bash
but status
but move <retry-policy-id>,<notification-sender-id> <customer-model-id>
```

## Included Runs

| Group | Run IDs |
| --- | --- |
| Claude latest before fix | `pilot4-claude-but-latest-k3-1`, `pilot4-claude-but-latest-k3-2`, `pilot4-claude-but-latest-k3-3` |
| Claude after guidance fix | `pilot4-claude-but-fixed2-k3-1`, `pilot4-claude-but-fixed2-k3-2`, `pilot4-claude-but-fixed2-k3-3` |
| Codex after guidance fix | `pilot4-codex-but-fixed-k3-1`, `pilot4-codex-but-fixed-k3-2`, `pilot4-codex-but-fixed-k3-3` |

Raw artifacts live under `tmp/pilot-runs/` and are intentionally not checked in.
