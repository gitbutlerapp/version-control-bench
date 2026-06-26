# Pilot 1 `but+skill` 2026-06-25 Reruns

> Current results: this per-pilot rerun is historical context. The latest k=5 full-matrix test run is displayed in [full-k5-2026-06-26.md](full-k5-2026-06-26.md).

Date: 2026-06-25

Task: `pilot-1-selective-validation`

Scope: Codex `gpt-5.5` and Claude via `claude -p`, `but+skill`, `k=3`, latest local GitButler binary and skill from `/Users/kiril/src/gitbutler`.

Binary: `/Users/kiril/src/gitbutler/target/release/but` (`but dev`)

Skill: `/Users/kiril/src/gitbutler/crates/but/skill`

Final batches:

- Codex: `tmp/pilot-runs/pilot1-codex-but-skillaligned2-k3-20260625-215148`
- Claude: `tmp/pilot-runs/pilot1-claude-but-skillaligned2-k3-20260625-215016`

## Headline

The final skill-aligned reruns passed 3/3 for both Codex and Claude. Codex improved materially against the 2026-06-22 full-matrix baseline. Claude restored the ideal task command shape after the initial latest rerun looked noisy, but current Claude wall time stayed slower than the old baseline because of platform-side overhead.

The important correction was generic and not task-cheating: align the generated benchmark arm instructions with the GitButler skill's selected-change recipe. For selected dirty hunks on a new branch, start with `but diff`, then use one `but commit <branch> -c ... --changes <ids>` command. Do not pre-create the branch with `but branch new`.

## Scorecard

Setup work is excluded from measured agent duration and command metrics: fixture creation, `but setup`, skill installation, local agent instruction files, and dirty-state application.

| Batch | Agent | n | Pass | Mean Wall | Median Wall | Max Wall | Task VC Cmds | Inspect | Mutate | Failed Task VC | Warm Transcript |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 2026-06-22 full matrix | Codex | 3 | 3/3 | 22.2s | 22.4s | 22.5s | 2.7 | 1.3 | 1.3 | 0.0 | 6.9 KB |
| 2026-06-25 initial latest | Codex | 3 | 3/3 | 22.4s | 22.8s | 23.4s | 2.7 | 1.3 | 1.3 | 0.0 | 7.0 KB |
| 2026-06-25 skill-aligned | Codex | 3 | 3/3 | 16.5s | 15.0s | 19.8s | 2.0 | 1.0 | 1.0 | 0.0 | 6.4 KB |
| 2026-06-22 full matrix | Claude | 3 | 3/3 | 20.7s | 19.5s | 23.7s | 2.3 | 1.0 | 1.3 | 0.3 | 0.9 KB |
| 2026-06-25 initial latest | Claude | 3 | 3/3 | 55.1s | 57.7s | 69.6s | 31.7 | 28.7 | 2.0 | 2.0 | 0.9 KB |
| 2026-06-25 skill-aligned | Claude | 3 | 3/3 | 27.0s | 24.5s | 34.9s | 2.0 | 1.0 | 1.0 | 0.0 | 0.9 KB |

## Read

The initial Claude rerun passed, but it was not a fair read of the new skill/binary. It used extra branch setup and produced lots of noisy version-control probes:

```bash
but status
but diff
but branch new input-validation
but commit input-validation -c -m "Add input validation for lead creation" --changes <ids>
```

The final skill-aligned Claude rerun used the intended one-inspection, one-mutation shape in all three runs:

```bash
but diff
but commit <branch> -c -m "Add input validation ..." --changes <ids>
```

Codex also converged on that same final shape in all three skill-aligned runs.

## Included Runs

| Group | Run IDs |
| --- | --- |
| Codex initial latest | `pilot1-codex-but-latest-k3-1`, `pilot1-codex-but-latest-k3-2`, `pilot1-codex-but-latest-k3-3` |
| Codex skill-aligned | `pilot1-codex-but-skillaligned2-k3-1`, `pilot1-codex-but-skillaligned2-k3-2`, `pilot1-codex-but-skillaligned2-k3-3` |
| Claude initial latest | `pilot1-claude-but-latest-k3-1`, `pilot1-claude-but-latest-k3-2`, `pilot1-claude-but-latest-k3-3` |
| Claude skill-aligned | `pilot1-claude-but-skillaligned2-k3-1`, `pilot1-claude-but-skillaligned2-k3-2`, `pilot1-claude-but-skillaligned2-k3-3` |

Raw artifacts live under `tmp/pilot-runs/` and are intentionally not checked in.
