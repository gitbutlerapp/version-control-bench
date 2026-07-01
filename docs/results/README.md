# Results Overview

Latest full matrix: [full-k5-2026-07-01.md](full-k5-2026-07-01.md).

Short answer: `but+skill` is still the strongest arm. It is the fastest tool for both agents and keeps command count low. `jj+skill` is clean with Codex, but much weaker with Claude. Plain `git` is slower and command-heavy, and this batch picked up two Claude failures.

The current view is one full 2026-07-01 batch: 150 planned runs across five scenarios, Codex and Claude, and three arms: `git`, `but+skill`, and `jj+skill`.

## Current Scorecard

| Agent | Arm | Pass | Mean wall | Median wall | Max wall | Task VC commands | Failed task VC commands |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Codex | `git` | 25/25 | 87.7s | 65.7s | 233.9s | 20.2 | 0.4 |
| Codex | `but+skill` | 25/25 | 26.6s | 25.7s | 41.9s | 3.6 | 0.0 |
| Codex | `jj+skill` | 25/25 | 95.8s | 87.5s | 216.8s | 19.8 | 0.1 |
| Claude | `git` | 23/25 | 252.0s | 192.3s | 858.7s | 23.2 | 0.9 |
| Claude | `but+skill` | 24/25 | 96.3s | 72.7s | 221.8s | 9.3 | 1.9 |
| Claude | `jj+skill` | 15/25 | 241.0s | 194.0s | 638.3s | 26.2 | 2.3 |

## Scenario Scorecard

Each cell is pass rate, mean wall time, and mean task-relevant VC command count.

| Scenario | Codex `git` | Codex `but+skill` | Codex `jj+skill` | Claude `git` | Claude `but+skill` | Claude `jj+skill` | Winner read |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Selective commit | 5/5, 59.3s, 19.2 cmds | 5/5, 18.1s, 2.0 cmds | 5/5, 94.9s, 19.2 cmds | 4/5, 217.7s, 18.6 cmds | 4/5, 48.0s, 3.2 cmds | 5/5, 195.6s, 16.4 cmds | Codex: `but+skill`; Claude: correctness split, `but+skill` much faster |
| Multi-amend | 5/5, 159.9s, 34.0 cmds | 5/5, 34.4s, 5.0 cmds | 5/5, 117.8s, 20.2 cmds | 4/5, 541.2s, 47.0 cmds | 5/5, 72.7s, 6.8 cmds | 2/5, 458.5s, 45.6 cmds | `but+skill` for both |
| Split commit | 5/5, 116.0s, 31.4 cmds | 5/5, 31.9s, 6.0 cmds | 5/5, 168.7s, 38.6 cmds | 5/5, 309.9s, 27.4 cmds | 5/5, 186.9s, 18.8 cmds | 0/5, 354.6s, 36.4 cmds | `but+skill` for both passing arms |
| Reorder commits | 5/5, 42.7s, 8.8 cmds | 5/5, 20.8s, 2.0 cmds | 5/5, 53.1s, 10.8 cmds | 5/5, 83.2s, 8.0 cmds | 5/5, 80.4s, 8.6 cmds | 3/5, 92.1s, 14.6 cmds | Codex: `but+skill`; Claude: `git` and `but+skill` close |
| Squash commits | 5/5, 60.8s, 7.4 cmds | 5/5, 27.7s, 3.0 cmds | 5/5, 44.7s, 10.2 cmds | 5/5, 107.7s, 15.2 cmds | 5/5, 93.5s, 9.0 cmds | 5/5, 104.1s, 18.2 cmds | `but+skill` for both |

## Current Read

If correctness is the first gate, `but+skill` wins most of the benchmark. It is clean for Codex, nearly clean for Claude, and has the best wall time and command count overall.

Codex is clean everywhere: all three arms passed 25/25. For Codex, `but+skill` is the obvious practical winner: 69.7% lower mean wall time than plain `git` and 82.1% fewer task-relevant version-control commands.

Claude is where tools separate. `but+skill` passed 24/25 and cut mean wall time by 61.8% versus plain `git`. Plain `git` passed 23/25 but was slow, with one multi-amend run taking 858.7s. `jj+skill` passed only 15/25, including 0/5 on split-commit and 2/5 on multi-amend.

So the practical answer is still blunt: GitButler with the skill is currently the best agent-facing workflow in this benchmark. JJ remains worth watching, but this skill/setup does not beat GitButler here.

## Compared With Previous Current

Compared with [full-k5-2026-06-29.md](full-k5-2026-06-29.md), the headline moved from 142/150 to 137/150.

| Agent | Arm | Pass Change | Mean Wall Change | Read |
| --- | --- | --- | --- | --- |
| Codex | `git` | 25/25 -> 25/25 | 75.1s -> 87.7s | Still clean, slower this time. |
| Codex | `but+skill` | 25/25 -> 25/25 | 29.3s -> 26.6s | Still clean, slightly faster. |
| Codex | `jj+skill` | 25/25 -> 25/25 | 110.1s -> 95.8s | Still clean, faster, but still slower than `but+skill`. |
| Claude | `git` | 25/25 -> 23/25 | 106.7s -> 252.0s | Correctness and time both regressed. |
| Claude | `but+skill` | 23/25 -> 24/25 | 40.0s -> 96.3s | Correctness improved, but slower. |
| Claude | `jj+skill` | 19/25 -> 15/25 | 210.3s -> 241.0s | Correctness and time both regressed. |

## Failure Read

The current batch has 13 failing runs out of 150:

- `jj+skill`: 10 failures, all Claude. Split-commit failed 5/5, multi-amend failed 3/5, and reorder failed 2/5.
- `git`: 2 failures, both Claude: selective commit `DIRTY_STATE_WRONG` and multi-amend `GRAPH_WRONG`.
- `but+skill`: 1 failure, Claude selective commit `PARTITION_WRONG`.

The failures are not setup failures. They are final-state misses from the verifier: wrong contents, wrong commit graph, wrong dirty state, or the wrong partition of changes.

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

- Raw batch: `tmp/pilot-runs/full-k5-20260701-all-tools`
- Setup block SHA-256: `e68d505c5f060b89692c253e8dddb689fb42c5a61fc001bdce0a8dc383db76b2` for `but+skill`; `b440ab7d0e70159b81f573267df5c284bf387e006dbc7c8dee83cb897443c91f` for `jj+skill`
- GitButler binary SHA-256: `772f7963b757da9141d3b1a270bc94ef0623d3f3b2255e65107c2c32f0dde38e`
- GitButler skill file SHA-256: `f01fa617eb216ad783474d4b8775b25574bb941ea123dbf4e09f881cd49665dc`
- GitButler source head: `3f92f26cdc04d4ff079e1c4f79e2a72f1ff32e8f`
- `jj` binary SHA-256: `849c9ab4bbfd955b9d9fbe39c3a63b071e348e3978888b5289d3dccd99379680`
- `jj` version: `jj 0.42.0`
- JJ skill package: `onevcat/skills@onevcat-jj`
- JJ skill file SHA-256: `e0364004187a1769adc0b532befe346fd4b372bb1aab2768b9ebb694f2d13687`

## Evidence

- Consolidated full report: [full-k5-2026-07-01.md](full-k5-2026-07-01.md)
- Previous full report: [full-k5-2026-06-29.md](full-k5-2026-06-29.md)
- Results archive: [archive.md](archive.md)
- Plain-English scenarios: [../scenarios.md](../scenarios.md)
- Aggregate JSON: `tmp/pilot-runs/full-k5-20260701-all-tools/aggregate.json`
- Manifest: `tmp/pilot-runs/full-k5-20260701-all-tools/manifest.tsv`
