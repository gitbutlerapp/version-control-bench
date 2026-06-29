# Results Overview

Latest full matrix: [full-k5-2026-06-29.md](full-k5-2026-06-29.md).

Short answer: yes, `but+skill` is still improving strongly against plain `git` on wall time and command count. But this run is not correctness-clean: 98/100 passed because Claude `but+skill` missed the split-commit stack order twice.

Compared with plain `git`, `but+skill` cut mean wall time by 61% for Codex and 62.5% for Claude, while cutting task-relevant version-control commands by 82.9% and 84.4%. The correctness caveat is narrow but real: Claude split-commit was 3/5 with `but+skill`; every other `but+skill` group was 5/5.

This is a comparison of plain `git` against GitButler CLI with the agent skill, reported as `but+skill`. It is not a claim about naked `but`, and it is definitely not a GitHub comparison.

## Current Scorecard

Scope: all five pilot scenarios, `k=5` per `(scenario, agent, arm)` group, Codex and Claude, 100 total runs. Setup work is excluded: fixture creation, `but setup`, skill installation, local agent instruction files, and dirty-state application are not counted as agent work.

| Agent | Arm | Pass | Mean wall | Median wall | Max wall | Task VC commands | Failed task VC commands |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Codex | `git` | 25/25 | 75.1s | 55.4s | 178.2s | 21 | 0.3 |
| Codex | `but+skill` | 25/25 | 29.3s | 29.1s | 57.5s | 3.6 | 0 |
| Claude | `git` | 25/25 | 106.7s | 56.2s | 275.8s | 22.8 | 0.8 |
| Claude | `but+skill` | 23/25 | 40s | 37.6s | 114.5s | 3.6 | 0.1 |

## Scenario Scorecard

Each cell is pass rate, mean wall time, and mean task-relevant VC command count.

| Scenario | Codex `git` | Codex `but+skill` | Claude `git` | Claude `but+skill` |
| --- | --- | --- | --- | --- |
| Selective commit | 5/5, 54.7s, 17.0 cmds | 5/5, 16.8s, 2.0 cmds | 5/5, 50.2s, 11.4 cmds | 5/5, 19.1s, 2.0 cmds |
| Multi-amend | 5/5, 130.6s, 38.8 cmds | 5/5, 40.1s, 5.6 cmds | 5/5, 196.5s, 48.6 cmds | 5/5, 43.6s, 5.0 cmds |
| Split commit | 5/5, 116.8s, 30.6 cmds | 5/5, 43.9s, 5.4 cmds | 5/5, 201.5s, 33.2 cmds | 3/5, 75.8s, 5.2 cmds |
| Reorder commits | 5/5, 35.6s, 7.8 cmds | 5/5, 17.8s, 2.0 cmds | 5/5, 38.2s, 10.0 cmds | 5/5, 25.7s, 2.4 cmds |
| Squash commits | 5/5, 37.8s, 11.0 cmds | 5/5, 27.9s, 3.0 cmds | 5/5, 47.1s, 10.6 cmds | 5/5, 35.6s, 3.2 cmds |

## Current Read

The shape is still what we want for average-user version-control requests: `but+skill` removes low-level history choreography and keeps the agent closer to the requested intent. The strongest speed wins are still multi-amend and split-commit. Claude multi-amend went from 196.5s with plain `git` to 43.6s with `but+skill`; Codex split-commit went from 116.8s to 43.9s.

The caveat moved. Claude squash is no longer the sore spot in this batch: `but+skill` beat plain `git` on wall time, 35.6s vs 47.1s, while still using far fewer commands. The new sore spot is Claude split-commit correctness: two `but+skill` runs created the right content but the wrong commit order.

## Previous k=5 Comparison

Compared with [full-k5-2026-06-28.md](full-k5-2026-06-28.md), this refresh got faster overall but less clean: pass rate moved from 100/100 to 98/100. The two new failures are both Claude `but+skill` split-commit `GRAPH_WRONG` results.

| Agent | Arm | Pass Change | Mean Wall Change | Task VC Change | Read |
| --- | --- | --- | --- | --- | --- |
| Codex | `git` | 25/25 -> 25/25 | 82.7s -> 75.1s (-9.2%) | 20.1 -> 21 (+4.6%) | Faster, but slightly more task VC commands; still clean. |
| Codex | `but+skill` | 25/25 -> 25/25 | 29.6s -> 29.3s (-1.1%) | 3.7 -> 3.6 (-2.2%) | Basically stable, still clean, slightly fewer commands. |
| Claude | `git` | 25/25 -> 25/25 | 92.4s -> 106.7s (+15.4%) | 21.6 -> 22.8 (+5.4%) | Still clean, but slower with more commands this time. |
| Claude | `but+skill` | 25/25 -> 23/25 | 46.2s -> 40s (-13.5%) | 4.2 -> 3.6 (-16%) | Faster and leaner, but correctness regressed on split-commit ordering. |

Scenario-level movement is mostly stable-to-better on speed. The meaningful negative shift is correctness in scenario 3 for Claude `but+skill`: last run was 5/5, this run is 3/5.

## Scenario Results

Each scenario name links to the plain-English scenario guide.

| # | Scenario | What it exercises | Codex result | Claude result |
| ---: | --- | --- | --- | --- |
| 1 | [Selective commit](../scenarios.md#1-selective-validation-commit) | Commit one topic from a messy worktree and leave unrelated work alone. | 69.3% less wall, 88.2% fewer task VC commands | 61.9% less wall, 82.5% fewer task VC commands |
| 2 | [Multi-amend](../scenarios.md#2-selective-multi-amend) | Fold several dirty fixes into different older commits. | 69.3% less wall, 85.6% fewer task VC commands | 77.8% less wall, 89.7% fewer task VC commands |
| 3 | [Split commit](../scenarios.md#3-split-broad-commit) | Replace one broad non-top commit with several clean commits. | 62.4% less wall, 82.4% fewer task VC commands | 62.4% less wall, 84.3% fewer task VC commands; pass 3/5 vs 5/5 |
| 4 | [Reorder commits](../scenarios.md#4-reorder-existing-commits) | Move correct commits into a better order without changing contents. | 49.9% less wall, 74.4% fewer task VC commands | 32.8% less wall, 76% fewer task VC commands |
| 5 | [Squash commits](../scenarios.md#5-squash-commit-groups) | Compress noisy adjacent commits into semantic commits. | 26.2% less wall, 72.7% fewer task VC commands | 24.3% less wall, 69.8% fewer task VC commands |

## What Is Actually Different

The speedup mostly comes from replacing low-level history choreography with one purpose-built operation per intent. The command runtime itself is tiny; the real savings are fewer inspect-plan-mutate loops for the agent.

| Scenario | Plain `git` shape | `but+skill` shape | Why it matters |
| --- | --- | --- | --- |
| Selective Validation Commit | Create a branch, inspect/stage the right files or hunks, commit, then verify leftovers. | `but diff`, then `but commit --changes`. | The agent selects semantic change IDs instead of manually staging a dirty worktree. |
| Selective Multi-Amend | Use fixups, autosquash, interactive rebase stops, patch files, stash/reapply, or equivalent manual surgery. | `but amend <commit> --changes <ids>` once per target commit. | The intended operation is "put these hunks into that old commit"; GitButler exposes that directly. |
| Split Broad Commit | Rewrite history with reset/rebase/add/commit loops while preserving the later commit on top. | `but uncommit --diff`, then replacement `but commit` calls. | The agent does one split plan from one inspected diff instead of repeatedly refreshing stale patch state; anchor semantics still need careful guidance. |
| Reorder Existing Commits | Edit an interactive rebase todo and avoid accidentally changing commit contents. | `but move <commit block> <target commit>`. | The operation is movement, not patch replay. Fewer places to get clever and break the DAG. |
| Squash Commit Groups | Run an interactive rebase, mark squash/fixup lines, edit messages, and verify the final stack. | `but squash <commits> -m <message>`. | The agent names the group and result directly, without driving an editor-shaped workflow. |

## Failure Read

The two failed runs are `full-k5-20260629-refresh-052-pilot-3-split-commit-claude-butplusskill-r3` and `full-k5-20260629-refresh-092-pilot-3-split-commit-claude-butplusskill-r5`. Both failed `commit_subjects_preserved` only: the final tree, content partition, leftovers, and conflict state were correct. The command traces show wrong stack anchoring rather than bad content selection.

## Provenance

The 2026-06-29 k=5 matrix used the latest local GitButler binary and skill from `/Users/kiril/src/gitbutler` at run start.

- Setup source command: `but agent setup --print`
- Setup block SHA-256: `e68d505c5f060b89692c253e8dddb689fb42c5a61fc001bdce0a8dc383db76b2`
- Binary SHA-256: `04f82151982c1fcb011f5e521e93da0faea60556b92e771f5028d278608ffe83`
- Skill file SHA-256: `220431b093e2ca05c0f7b00925093ed683d839dd8c3ece2e27255dbe53fdfb6c`
- Skill tree SHA-256: `adbf43f84fd3a38b816a3ab6ae2b3f5afe406b7b7f0f9e5e560fc837633250d0`
- GitButler source head: `c09584368640851edb79d1742ae12927381ca001`
- Binary dirty: `false`
- Skill dirty: `false`

## Evidence

- Full batch report: [full-k5-2026-06-29.md](full-k5-2026-06-29.md)
- Previous k=5 full batch report: [full-k5-2026-06-28.md](full-k5-2026-06-28.md)
- Results archive: [archive.md](archive.md)
- Plain-English scenarios: [../scenarios.md](../scenarios.md)
- Raw aggregate: `tmp/pilot-runs/full-k5-20260629-refresh/aggregate.json`
- Raw run manifest: `tmp/pilot-runs/full-k5-20260629-refresh/manifest.tsv`
