# Pilot 1 Historical Batch

> Current results: this early pilot batch is historical context. The latest k=5 full-matrix test run is displayed in [full-k5-2026-06-27.md](full-k5-2026-06-27.md).

Date: 2026-06-17

Task: `pilot-1-selective-validation`

Scenario: a tiny TypeScript repo starts on `main` with mixed dirty changes across the same file and different files; the agent must create a new branch and commit only the input-validation work while leaving logging, config, and untracked debug leftovers uncommitted.

## Headline

All four groups passed 3/3. On this pilot, `but+skill` was materially faster and used far fewer task-relevant VC commands for both Codex and Claude.

## Scorecard

Pre-run fixture setup, `but setup`, skill installation, local agent instructions, and dirty-state application are excluded from measured duration and command metrics.

| Agent | Arm | n | Pass | Mean Wall | Median Wall | First Mutation | Task VC Cmds | Inspect | Mutate | Failed Task VC | Parser Cmds | Cold Transcript | Warm Transcript |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Codex | `git` | 3 | 3/3 | 43.96s | 47.24s | 25.17s | 14.0 | 10.0 | 4.0 | 0.0 | 0.0 | 10.8 KB | 10.8 KB |
| Codex | `but+skill` | 3 | 3/3 | 21.53s | 21.62s | 17.75s | 3.0 | 2.0 | 1.0 | 0.0 | 0.0 | 16.7 KB | 7.0 KB |
| Claude | `git` | 3 | 3/3 | 52.15s | 53.10s | 25.14s | 13.3 | 8.7 | 4.7 | 0.7 | 0.0 | 1.1 KB | 1.1 KB |
| Claude | `but+skill` | 3 | 3/3 | 23.04s | 22.53s | 17.29s | 2.0 | 1.0 | 1.0 | 0.0 | 0.0 | 1.0 KB | 1.0 KB |

## Pairwise Deltas

| Agent | `but+skill` Mean Wall Delta | Wall Delta | Task VC Cmd Delta | Task VC Delta | Warm Transcript Delta |
| --- | ---: | ---: | ---: | ---: | ---: |
| Codex | -22.43s | -51.0% | -11.0 | -78.6% | -3.8 KB |
| Claude | -29.11s | -55.8% | -11.3 | -85.0% | -0.1 KB |

## Read

For this scenario, both tools got the job done. The interesting difference is effort: `but+skill` solved the task in one inspection plus one commit for Claude, and two inspections plus one commit for Codex. The plain `git` runs needed many more task-level VC operations because partial selection and branch creation required more manual sequencing.

Codex cold transcript is larger for `but+skill` because visible skill/reference reads are counted. The warm estimate reverses that, but it is still only a transcript-byte proxy, not real token accounting. Claude transcript bytes are text-mode output only and should not be compared directly with Codex.

## Included Runs

| Group | Run IDs |
| --- | --- |
| Codex `git` | `repeated-20260617-git-1`, `repeated-20260617-git-2`, `repeated-20260617-git-3` |
| Codex `but+skill` | `updated-skill-20260617-but-1`, `updated-skill-20260617-but-2`, `updated-skill-20260617-but-3` |
| Claude `git` | `claude-20260617-git-1`, `claude-20260617-git-2`, `claude-20260617-git-3` |
| Claude `but+skill` | `claude-20260617-but-fixed-1`, `claude-20260617-but-fixed-2`, `claude-20260617-but-fixed-3` |

Raw artifacts live under `tmp/pilot-runs/` and are intentionally not checked in.
