# Results Overview

Latest full matrix: [full-k5-2026-06-29.md](full-k5-2026-06-29.md).

Short answer: `but+skill` is still the strongest arm. The new `jj+skill` arm got a fair k=5 run with an external JJ skill, but it did not outperform `but+skill` or plain `git`.

The current view consolidates two 2026-06-29 batches: the original `git` vs `but+skill` k=5 matrix and the follow-up `jj+skill` k=5 expansion. That is 150 planned runs across five scenarios, Codex and Claude, and three arms. The same scenarios and verifiers were used; only the tool arm changed.

## Current Scorecard

| Agent | Arm | Pass | Mean wall | Median wall | Max wall | Task VC commands | Failed task VC commands |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Codex | `git` | 25/25 | 75.1s | 55.4s | 178.2s | 21.0 | 0.3 |
| Codex | `but+skill` | 25/25 | 29.3s | 29.1s | 57.5s | 3.6 | 0.0 |
| Codex | `jj+skill` | 25/25 | 110.1s | 109.3s | 207.8s | 20.3 | 0.2 |
| Claude | `git` | 25/25 | 106.7s | 56.2s | 275.8s | 22.8 | 0.8 |
| Claude | `but+skill` | 23/25 | 40.0s | 37.6s | 114.5s | 3.6 | 0.1 |
| Claude | `jj+skill` | 19/25 | 210.3s | 173.6s | 545.3s | 23.7 | 2.8 |

## Scenario Scorecard

Each cell is pass rate, mean wall time, and mean task-relevant VC command count.

| Scenario | Codex `git` | Codex `but+skill` | Codex `jj+skill` | Claude `git` | Claude `but+skill` | Claude `jj+skill` | Winner read |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Selective commit | 5/5, 54.7s, 17.0 cmds | 5/5, 16.8s, 2.0 cmds | 5/5, 105.6s, 19.2 cmds | 5/5, 50.2s, 11.4 cmds | 5/5, 19.1s, 2.0 cmds | 5/5, 179.4s, 20.8 cmds | `but+skill` for both |
| Multi-amend | 5/5, 130.6s, 38.8 cmds | 5/5, 40.1s, 5.6 cmds | 5/5, 132.6s, 20.6 cmds | 5/5, 196.5s, 48.6 cmds | 5/5, 43.6s, 5.0 cmds | 4/5, 404.0s, 33.4 cmds | `but+skill` for both |
| Split commit | 5/5, 116.8s, 30.6 cmds | 5/5, 43.9s, 5.4 cmds | 5/5, 181.5s, 39.6 cmds | 5/5, 201.5s, 33.2 cmds | 3/5, 75.8s, 5.2 cmds | 0/5, 281.5s, 31.0 cmds | Codex: `but+skill`; Claude: `git` |
| Reorder commits | 5/5, 35.6s, 7.8 cmds | 5/5, 17.8s, 2.0 cmds | 5/5, 74.0s, 10.6 cmds | 5/5, 38.2s, 10.0 cmds | 5/5, 25.7s, 2.4 cmds | 5/5, 85.6s, 14.8 cmds | `but+skill` for both |
| Squash commits | 5/5, 37.8s, 11.0 cmds | 5/5, 27.9s, 3.0 cmds | 5/5, 56.6s, 11.4 cmds | 5/5, 47.1s, 10.6 cmds | 5/5, 35.6s, 3.2 cmds | 5/5, 100.9s, 18.4 cmds | `but+skill` for both |

## Current Read

If correctness is the first gate, `but+skill` wins 9 of 10 agent/scenario cells. The only exception is Claude split-commit, where plain `git` is the only clean 5/5 arm. `but+skill` is still much faster there, but it failed two ordering checks, so it should not get the win.

`jj+skill` has one decent result: Codex completed all 25 JJ runs correctly. But it was slower than plain `git` for Codex overall and slower than both other arms in every scenario. Claude with JJ was worse: 19/25 overall, with split-commit failing 0/5.

So the practical answer is blunt: JJ was worth testing, but this setup does not currently give agents a better version-control workflow than GitButler with the skill.

## Fair Shot Read

The JJ setup was fair for this benchmark shape:

- The `jj+skill` arm used `jj 0.42.0`.
- The fixture repo was prepared before timing with `jj git init --colocate`.
- The agent got an installed external JJ skill before timing.
- Raw Git writes and GitButler were blocked in the JJ arm.
- Setup, skill fetch/install, fixture creation, and dirty-state application were excluded from measured agent time.

The skill was `onevcat/skills@onevcat-jj`, selected because it was the top direct `jj` result from `npx skills find jj` on 2026-06-29. The raw report records the fetched skill hash.

## Previous k=5 Comparison

Compared with [full-k5-2026-06-28.md](full-k5-2026-06-28.md), the `git` vs `but+skill` baseline got faster overall but less clean: pass rate moved from 100/100 to 98/100. The two baseline failures are both Claude `but+skill` split-commit `GRAPH_WRONG` results.

| Agent | Arm | Pass Change | Mean Wall Change | Task VC Change | Read |
| --- | --- | --- | --- | --- | --- |
| Codex | `git` | 25/25 -> 25/25 | 82.7s -> 75.1s (-9.2%) | 20.1 -> 21.0 (+4.6%) | Faster, but slightly more task VC commands; still clean. |
| Codex | `but+skill` | 25/25 -> 25/25 | 29.6s -> 29.3s (-1.1%) | 3.7 -> 3.6 (-2.2%) | Basically stable, still clean, slightly fewer commands. |
| Claude | `git` | 25/25 -> 25/25 | 92.4s -> 106.7s (+15.4%) | 21.6 -> 22.8 (+5.4%) | Still clean, but slower with more commands this time. |
| Claude | `but+skill` | 25/25 -> 23/25 | 46.2s -> 40.0s (-13.5%) | 4.2 -> 3.6 (-16.0%) | Faster and leaner, but correctness regressed on split-commit ordering. |

## Failure Read

The consolidated view has 8 failing runs out of 150:

- `but+skill`: 2 failures, both Claude split-commit `GRAPH_WRONG`. The final content was correct, but the stack order was wrong.
- `jj+skill`: 6 failures. Claude split-commit failed 5/5, mostly `CONTENT_WRONG`, and Claude multi-amend failed 1/5 with `CONTENT_WRONG`.

The JJ failures look like real final-state misses, not setup failures. Representative split failures left wrong files in the final branch tree or committed leftovers that should have remained uncommitted.

## Provenance

Baseline `git`/`but+skill` batch:

- Raw batch: `tmp/pilot-runs/full-k5-20260629-refresh`
- Setup block SHA-256: `e68d505c5f060b89692c253e8dddb689fb42c5a61fc001bdce0a8dc383db76b2`
- GitButler binary SHA-256: `04f82151982c1fcb011f5e521e93da0faea60556b92e771f5028d278608ffe83`
- GitButler skill file SHA-256: `220431b093e2ca05c0f7b00925093ed683d839dd8c3ece2e27255dbe53fdfb6c`
- GitButler source head: `c09584368640851edb79d1742ae12927381ca001`

JJ expansion batch:

- Raw batch: `tmp/pilot-runs/jj-k5-codex-claude-20260629`
- Setup block SHA-256: `b440ab7d0e70159b81f573267df5c284bf387e006dbc7c8dee83cb897443c91f`
- `jj` binary SHA-256: `849c9ab4bbfd955b9d9fbe39c3a63b071e348e3978888b5289d3dccd99379680`
- `jj` version: `jj 0.42.0`
- Skill package: `onevcat/skills@onevcat-jj`
- Skill source URL: `https://raw.githubusercontent.com/onevcat/skills/master/skills/onevcat-jj/SKILL.md`
- Skill file SHA-256: `e0364004187a1769adc0b532befe346fd4b372bb1aab2768b9ebb694f2d13687`

## Evidence

- Consolidated full report: [full-k5-2026-06-29.md](full-k5-2026-06-29.md)
- Previous k=5 full batch report: [full-k5-2026-06-28.md](full-k5-2026-06-28.md)
- Results archive: [archive.md](archive.md)
- Plain-English scenarios: [../scenarios.md](../scenarios.md)
- Baseline aggregate: `tmp/pilot-runs/full-k5-20260629-refresh/aggregate.json`
- JJ aggregate: `tmp/pilot-runs/jj-k5-codex-claude-20260629/aggregate.json`
