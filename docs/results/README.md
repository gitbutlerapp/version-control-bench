# Results Overview

Latest full matrix: [full-k7-2026-07-03.md](full-k7-2026-07-03.md).

Short answer: yes, GitButler is improving against plain `git`. In this k=7 run, `but+skill` passed every verifier check for both agents, cut mean wall time by 67.5% for Codex and 60.8% for Claude versus plain `git`, and used dramatically fewer task-relevant version-control commands.

The current view is one full 2026-07-03 batch: 210 planned runs across five scenarios, Codex and Claude, and three arms: `git`, `but+skill`, and `jj+skill`.

Models: Codex used `gpt-5.5`; Claude used `claude-opus-4-1-20250805` according to Claude Code session metadata. The raw aggregate predates model capture and records Claude as unknown.

## Current Scorecard

| Agent | Arm | Pass | Mean wall | Median wall | Max wall | Task VC commands | Failed task VC commands |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Codex | `git` | 35/35 | 89.4s | 72.3s | 221.5s | 23.1 | 0.5 |
| Codex | `but+skill` | 35/35 | 29.0s | 25.3s | 104.9s | 3.8 | 0.0 |
| Codex | `jj+skill` | 35/35 | 119.0s | 92.2s | 776.7s | 20.7 | 0.3 |
| Claude | `git` | 28/35 | 248.4s | 175.1s | 900.0s | 23.6 | 0.7 |
| Claude | `but+skill` | 35/35 | 97.5s | 88.1s | 208.6s | 9.8 | 2.2 |
| Claude | `jj+skill` | 25/35 | 282.2s | 177.6s | 900.0s | 25.7 | 2.7 |

## Scenario Scorecard

Each cell is pass rate, mean wall time, and mean task-relevant VC command count.

| Scenario | Codex `git` | Codex `but+skill` | Codex `jj+skill` | Claude `git` | Claude `but+skill` | Claude `jj+skill` | Winner read |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Selective commit | 7/7, 67.8s, 19.4 cmds | 7/7, 30.8s, 2.0 cmds | 7/7, 99.2s, 20.1 cmds | 6/7, 169.9s, 17.9 cmds | 7/7, 52.3s, 3.9 cmds | 5/7, 172.3s, 20.6 cmds | `but+skill` for both |
| Multi-amend | 7/7, 174.4s, 43.7 cmds | 7/7, 36.5s, 6.0 cmds | 7/7, 208.5s, 24.9 cmds | 6/7, 598.1s, 57.6 cmds | 7/7, 97.5s, 8.7 cmds | 6/7, 585.5s, 36.1 cmds | `but+skill` for both |
| Split commit | 7/7, 116.2s, 29.9 cmds | 7/7, 33.0s, 6.0 cmds | 7/7, 185.9s, 36.6 cmds | 2/7, 294.4s, 24.9 cmds | 7/7, 157.5s, 17.4 cmds | 1/7, 456.4s, 42.7 cmds | `but+skill`; Claude split is the separator |
| Reorder commits | 7/7, 54.4s, 11.0 cmds | 7/7, 20.6s, 2.0 cmds | 7/7, 58.4s, 11.1 cmds | 7/7, 68.0s, 6.0 cmds | 7/7, 97.6s, 9.0 cmds | 7/7, 91.3s, 14.1 cmds | Codex: `but+skill`; Claude: plain `git` fastest |
| Squash commits | 7/7, 34.1s, 11.4 cmds | 7/7, 24.3s, 3.0 cmds | 7/7, 43.3s, 11.0 cmds | 7/7, 111.6s, 11.7 cmds | 7/7, 82.5s, 9.9 cmds | 6/7, 105.8s, 15.0 cmds | `but+skill` for both |

## Current Read

Correctness first: `but+skill` is the only arm that went 70/70 across both agents in this run. Codex passed every arm, but GitButler is still the obvious practical winner for Codex: 29.0s mean wall time versus 89.4s for `git`, with 3.8 task VC commands instead of 23.1.

Claude is the real test. Plain `git` passed 28/35 and collapsed on split-commit, passing only 2/7. `but+skill` passed 35/35 and was 60.8% faster overall than Claude+`git`. `jj+skill` improved versus the previous run but still failed 10 verifier checks, mostly split-commit.

So the blunt read: GitButler with the skill is currently the best agent-facing workflow in this benchmark. It is not just faster than `git`; it is also more reliable on the high-friction history-editing tasks.

## Compared With Previous Current

Compared with [full-k5-2026-07-01.md](full-k5-2026-07-01.md), the headline moved from 137/150 verifier passes to 193/210. Pass rate was basically flat: 91.3% -> 91.9%.

| Agent | Arm | Pass Change | Mean Wall Change | Read |
| --- | --- | --- | --- | --- |
| Codex | `git` | 25/25 -> 35/35 | 87.7s -> 89.4s | Still clean, basically flat. |
| Codex | `but+skill` | 25/25 -> 35/35 | 26.6s -> 29.0s | Still clean and still by far the fastest Codex arm. |
| Codex | `jj+skill` | 25/25 -> 35/35 | 95.8s -> 119.0s | Still clean, but slower than both prior `jj` and current `git`. |
| Claude | `git` | 23/25 -> 28/35 | 252.0s -> 248.4s | Overall mean is flat, but split-commit regressed from 5/5 to 2/7. |
| Claude | `but+skill` | 24/25 -> 35/35 | 96.3s -> 97.5s | Correctness improved to perfect, time stayed flat. |
| Claude | `jj+skill` | 15/25 -> 25/35 | 241.0s -> 282.2s | Correctness improved, but split-commit is still only 1/7 and time got worse. |

## Failure Read

Seventeen of 210 runs failed the verifier; all were Claude. The generated report also lists one extra Claude `git` runtime hiccup: a multi-amend run hit the 900s timeout but still left the right final state.

- `git`: 7 verifier failures, all Claude. Split-commit failed 5/7, selective commit failed 1/7, and multi-amend failed 1/7.
- `but+skill`: 0 verifier failures. This is the new run’s best news.
- `jj+skill`: 10 verifier failures, all Claude. Split-commit failed 6/7, selective commit failed 2/7, multi-amend failed 1/7, and squash failed 1/7.

## Fair Shot Read

The JJ setup was fair for this benchmark shape:

- The `jj+skill` arm used `jj 0.42.0`.
- The fixture repo was prepared before timing with `jj git init --colocate`.
- The agent got an installed external JJ skill before timing.
- Raw Git writes and GitButler were blocked in the JJ arm.
- Setup, skill fetch/install, fixture creation, and dirty-state application were excluded from measured agent time.

The skill was `onevcat/skills@onevcat-jj`, selected because it was the top direct `jj` result from `npx skills find jj` on 2026-06-29.

## Provenance

Current full batch:

- Raw batch: `tmp/pilot-runs/full-k7-20260703-all-tools`
- Setup block SHA-256: `e68d505c5f060b89692c253e8dddb689fb42c5a61fc001bdce0a8dc383db76b2` for `but+skill`; `b440ab7d0e70159b81f573267df5c284bf387e006dbc7c8dee83cb897443c91f` for `jj+skill`
- GitButler binary SHA-256: `8ab241b0f64036c9ccb531f62d012f84c2fc7cf583723eab79229be8a9a99e7e`
- GitButler skill file SHA-256: `699b59804fe8beb35f6bc9c7f88a6b5fa9c6e90f900d27e08d2c81b72084898b`
- GitButler source head: `10d6ba2ee46b3de80aec29886a024e943caf2da4`, `f1ab53ee0f2964a72e0ea95424c759f1138a79eb`
- GitButler binary dirty: `true`; skill dirty: `false`
- `jj` binary SHA-256: `849c9ab4bbfd955b9d9fbe39c3a63b071e348e3978888b5289d3dccd99379680`
- `jj` version: `jj 0.42.0`
- JJ skill package: `onevcat/skills@onevcat-jj`
- JJ skill file SHA-256: `e0364004187a1769adc0b532befe346fd4b372bb1aab2768b9ebb694f2d13687`

## Evidence

- Consolidated full report: [full-k7-2026-07-03.md](full-k7-2026-07-03.md)
- Previous full report: [full-k5-2026-07-01.md](full-k5-2026-07-01.md)
- Results archive: [archive.md](archive.md)
- Plain-English scenarios: [../scenarios.md](../scenarios.md)
- Aggregate JSON: `tmp/pilot-runs/full-k7-20260703-all-tools/aggregate.json`
- Manifest: `tmp/pilot-runs/full-k7-20260703-all-tools/manifest.tsv`
