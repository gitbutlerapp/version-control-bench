# Results Overview

Latest batches: [full-k10-2026-07-06.md](full-k10-2026-07-06.md) (three arms) plus [full-k10-jj-but-2026-07-09.md](full-k10-jj-but-2026-07-09.md) (the `jj-but+skill` arm added at the same k).

Short answer on these frontier models: 394 of 400 runs passed, so speed and efficiency remain the main separators, but the new arm reopened the reliability axis. GitButler is the fastest arm for both agents (roughly 60% below plain `git` on the mean) with far fewer version-control commands; `jj-but` — GitButler's agent-facing companion CLI for Jujutsu repositories — runs at about half of plain `git`'s time; Jujutsu itself is slower than plain `git` for both agents. Claude failed split-commit with `jj-but` in 5 of 10 runs (same near-miss every time: right contents, reversed commit order), the first repeated cell failure in this model generation.

The current view is the full 2026-07-06 batch (300 planned runs, `git` / `but+skill` / `jj+skill`) plus the 2026-07-09 `jj-but+skill` batch (100 planned runs) — five scenarios, Codex and Claude, four arms, k=10 throughout. Cross-arm deltas involving `jj-but` are cross-batch (same fixtures, graders, and configured models, three days and one Claude Code patch release apart).

Models: Codex used `gpt-5.5` (codex-cli 0.141.0); Claude used `claude-opus-4-8` (Claude Code 2.1.198 on 2026-07-06, 2.1.205 on 2026-07-09). Both configured and observed models are captured in the aggregates.

## Current Scorecard

Pass is over k=10 runs per cell; "tasks all-k" is the count of scenarios where every run passed (per-scenario pass^k).

| Agent | Arm | Pass | Mean wall | Median wall | P90 wall | Task VC commands | Tasks all-k |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Codex | `git` | 50/50 | 105.9s | 64.0s | 179.4s | 22.7 | 5/5 |
| Codex | `but+skill` | 50/50 | 28.7s | 26.9s | 42.9s | 3.9 | 5/5 |
| Codex | `jj+skill` | 49/50 | 115.9s | 87.8s | 190.9s | 20.3 | 4/5 |
| Codex | `jj-but+skill` | 50/50 | 50.1s | 32.2s | 56.6s | 4.7 | 5/5 |
| Claude | `git` | 50/50 | 118.0s | 67.2s | 257.1s | 22.3 | 5/5 |
| Claude | `but+skill` | 50/50 | 44.5s | 42.1s | 69.3s | 4.9 | 5/5 |
| Claude | `jj+skill` | 50/50 | 167.8s | 166.3s | 320.1s | 17.4 | 5/5 |
| Claude | `jj-but+skill` | 45/50 | 54.0s | 44.3s | 103.7s | 10.0 | 4/5 |

Read the mean alongside the median: `git` and `jj+skill` carry heavy right tails (a Codex `git` run hit 889.6s and a Codex `jj+skill` run 839.2s — genuine agent floundering that still passed), so their means sit above their medians, while GitButler's slowest run was ~86s. On typical (median) runs GitButler is ~37–58% faster than `git`; on the mean, which carries the tail, ~62–73%.

Per-scenario breakdowns, paired deltas, and confidence intervals are in the full writeups: [full-k10-2026-07-06.md](full-k10-2026-07-06.md) and [full-k10-jj-but-2026-07-09.md](full-k10-jj-but-2026-07-09.md).

## Current Read

On these frontier models reliability no longer separates the tools: 299 of 300 runs passed, and every arm cleared every scenario except one Codex `jj+skill` split-commit run. So the comparison is now about speed and efficiency.

GitButler is the fastest arm for both agents — 28.7s vs 105.9s for Codex, 44.5s vs 118.0s for Claude versus plain `git` — and uses a fraction of the version-control commands (Codex 3.9 vs 22.7). Jujutsu is slower than plain `git` for both agents. Plain `git` sits in the middle: reliable here, but slower and far more command-heavy than GitButler, and prone to the occasional very slow run that GitButler avoids.

The blunt read: GitButler with the skill is the most efficient agent-facing workflow in this benchmark. It is no longer *more reliable* than the others on these five operations — the frontier models close that gap — so the honest current claim is about speed and command count, not correctness.

## Compared With Previous Current

Same models as the previous batch ([full-k8-2026-07-05.md](full-k8-2026-07-05.md), `claude-opus-4-8` / `gpt-5.5`), so this is a stability check, not a model change. Reliability held (239/240 → 299/300, the same single Codex `jj+skill` split-commit miss). The extra reps mainly tightened the efficiency intervals: at k=8 Claude `but+skill` task-VC and Codex `but+skill` wall-time CIs crossed zero; at k=10 both exclude zero. The `git` and `jj+skill` means ticked up (Codex `git` 77.6s → 105.9s, Claude `git` 108.6s → 118.0s) on a couple of long-tail runs, while their medians barely moved (Codex `git` 60.7s → 64.0s); GitButler's means stayed flat (Codex 27.7s → 28.7s).

## Failure Read

Six of 400 runs failed the verifier. One Codex `jj+skill` split-commit run (`CONTENT_WRONG`) in the 2026-07-06 batch, and five Claude `jj-but+skill` split-commit runs (`GRAPH_WRONG`) in the 2026-07-09 batch — all five the identical near-miss: correct contents in the three replacement commits, but in reverse order on the branch. Every other agent–tool cell passed all ten runs of all five scenarios. No agent-runtime errors or timeouts.

## Fair Shot Read

The JJ setup was fair for this benchmark shape:

- The `jj+skill` arm used `jj 0.42.0`.
- The fixture repo was prepared before timing with `jj git init --colocate`.
- The agent got an installed external JJ skill before timing.
- Raw Git writes and GitButler were blocked in the JJ arm.
- Setup, skill fetch/install, fixture creation, and dirty-state application were excluded from measured agent time.

The skill was `onevcat/skills@onevcat-jj`, pinned to upstream commit `4955f542` and verified by SHA-256; it was the top direct `jj` result from `npx skills find jj` on 2026-06-29.

## Provenance

Current full batch:

- Raw batch: `tmp/pilot-runs/full-k10-20260705`
- Models: Codex `gpt-5.5` (codex-cli 0.141.0); Claude `claude-opus-4-8` (Claude Code 2.1.198)
- Setup block SHA-256: `e68d505c5f060b89692c253e8dddb689fb42c5a61fc001bdce0a8dc383db76b2` for `but+skill`; `b440ab7d0e70159b81f573267df5c284bf387e006dbc7c8dee83cb897443c91f` for `jj+skill`
- GitButler binary SHA-256: `ec8a389c11422a675e2d3aa7f6f8840fc78243ce728565c4dda33c2eeb30a6c7`
- GitButler skill file SHA-256: `a5e5ac057b64819a22471b9a31751943e6183a8d475047fa8667de21541a04de`
- GitButler source head: `a70b9720466d7935921adaf5233e61350cb34251`
- `jj` binary SHA-256: `849c9ab4bbfd955b9d9fbe39c3a63b071e348e3978888b5289d3dccd99379680`
- `jj` version: `jj 0.42.0`
- JJ skill package: `onevcat/skills@onevcat-jj` (commit `4955f542`)
- JJ skill file SHA-256: `e0364004187a1769adc0b532befe346fd4b372bb1aab2768b9ebb694f2d13687`

`jj-but+skill` batch (2026-07-09):

- Raw batch: `tmp/pilot-runs/full-k10-20260709-103337`
- Models: Codex `gpt-5.5` (codex-cli 0.141.0); Claude `claude-opus-4-8` (Claude Code 2.1.205)
- `jj-but` binary SHA-256: `9ec7446ab99c4603bfd8468eced8df0a0c2d494c6ed2e6aa9b9f82d6f688f0b7` (`jj-but 0.2.0`, source head `31f77afd`)
- Colocated `jj` version: `jj 0.39.0`
- Skill: installed per run via `jj-but skill install`; skill file SHA-256 `4ad34bcc779063a5d8226cd248b383809c3e5acdb61cfd98e2bdccf82aa166be`

## Evidence

- Consolidated full report: [full-k10-2026-07-06.md](full-k10-2026-07-06.md)
- `jj-but` arm report: [full-k10-jj-but-2026-07-09.md](full-k10-jj-but-2026-07-09.md)
- Previous full report: [full-k8-2026-07-05.md](full-k8-2026-07-05.md)
- Results archive: [archive.md](archive.md)
- Plain-English scenarios: [../scenarios.md](../scenarios.md)
- Per-run artifact bundle: `npm run runs:export -- --batch full-k10-20260705`
- Aggregate JSON: `tmp/pilot-runs/full-k10-20260705/aggregate.json`
- Manifest: `tmp/pilot-runs/full-k10-20260705/manifest.tsv`
