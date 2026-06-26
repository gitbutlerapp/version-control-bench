# Results Overview

Latest full matrix: [full-k5-2026-06-26.md](full-k5-2026-06-26.md).

Short answer: yes, the latest clean `but+skill` setup is improving strongly against plain `git`. In the k=5 full matrix, `but+skill` passed all 50 runs. Plain `git` passed all 25 Codex runs but only 20/25 Claude runs.

Compared with plain `git`, `but+skill` cut mean wall time by 62.6% for Codex and 64.3% for Claude, while cutting task-relevant version-control commands by 83.0% and 63.6%.

This is a comparison of plain `git` against GitButler CLI with the agent skill, reported as `but+skill`. It is not a claim about naked `but`, and it is definitely not a GitHub comparison.

## Current Scorecard

Scope: all five pilot scenarios, `k=5` per `(scenario, agent, arm)` group, Codex and Claude, 100 total runs. Setup work is excluded: fixture creation, `but setup`, skill installation, local agent instruction files, and dirty-state application are not counted as agent work.

| Agent | Arm | Pass | Mean wall | Median wall | Max wall | Task VC commands | Failed task VC commands |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Codex | `git` | 25/25 | 83.6s | 73.2s | 176.6s | 21.4 | 0.6 |
| Codex | `but+skill` | 25/25 | 31.2s | 25.0s | 60.1s | 3.6 | 0.0 |
| Claude | `git` | 20/25 | 231.7s | 161.9s | 754.9s | 23.3 | 1.0 |
| Claude | `but+skill` | 25/25 | 82.6s | 75.8s | 175.2s | 8.5 | 1.8 |

## Current Read

The biggest result is correctness, not just speed: all `but+skill` runs passed. The only failures were Claude using plain `git`:

| Scenario | Claude `git` pass | Failure classes |
| --- | ---: | --- |
| Selective commit | 4/5 | `DIRTY_STATE_WRONG` |
| Multi-amend | 2/5 | `CONTENT_WRONG`, `DIRTY_STATE_WRONG`, `GRAPH_WRONG` |
| Split commit | 4/5 | `CONTENT_WRONG` |

For average-user version-control requests, the shape is pretty clear: `but+skill` removes a lot of low-level choreography. The clearest win is selective multi-amend, where Claude plain `git` took 525.1s on average and only passed 2/5, while Claude `but+skill` took 77.7s and passed 5/5.

The one weak spot is Claude reorder commits: `but+skill` was 9.2% slower on mean wall time, though it still used fewer task VC commands and passed all runs. That looks more like agent/tool-command flailing than a correctness issue.

## Scenario Results

Each scenario name links to the plain-English scenario guide.

| # | Scenario | What it exercises | Codex result | Claude result |
| ---: | --- | --- | --- | --- |
| 1 | [Selective Validation Commit](../scenarios.md#1-selective-validation-commit) | Commit one topic from a messy worktree and leave unrelated work alone. | 64.7% less wall, 88.8% fewer task VC commands | 79.6% less wall, 88.1% fewer task VC commands; `but+skill` passed 5/5 vs `git` 4/5 |
| 2 | [Selective Multi-Amend](../scenarios.md#2-selective-multi-amend) | Fold several dirty fixes into different older commits. | 74.3% less wall, 86.3% fewer task VC commands | 85.2% less wall, 81.3% fewer task VC commands; `but+skill` passed 5/5 vs `git` 2/5 |
| 3 | [Split Broad Commit](../scenarios.md#3-split-broad-commit) | Replace one broad non-top commit with several clean commits. | 52.1% less wall, 81.4% fewer task VC commands | 49.1% less wall, 43.2% fewer task VC commands; `but+skill` passed 5/5 vs `git` 4/5 |
| 4 | [Reorder Existing Commits](../scenarios.md#4-reorder-existing-commits) | Move correct commits into a better order without changing contents. | 64.2% less wall, 81.8% fewer task VC commands | 9.2% more wall, but 15.8% fewer task VC commands; both arms passed 5/5 |
| 5 | [Squash Commit Groups](../scenarios.md#5-squash-commit-groups) | Compress noisy adjacent commits into semantic commits. | 40.8% less wall, 61.9% fewer task VC commands | 26.5% less wall, 28.8% fewer task VC commands |

## What Is Actually Different

The speedup mostly comes from replacing low-level history choreography with one purpose-built operation per intent. The command runtime itself is tiny; the real savings are fewer inspect-plan-mutate loops for the agent.

| Scenario | Plain `git` shape | `but+skill` shape | Why it matters |
| --- | --- | --- | --- |
| Selective Validation Commit | Create a branch, inspect/stage the right files or hunks, commit, then verify leftovers. | `but diff`, then `but commit --changes`. | The agent selects semantic change IDs instead of manually staging a dirty worktree. |
| Selective Multi-Amend | Use fixups, autosquash, interactive rebase stops, patch files, stash/reapply, or equivalent manual surgery. | `but amend <commit> --changes <ids>` once per target commit. | The intended operation is "put these hunks into that old commit"; GitButler exposes that directly. |
| Split Broad Commit | Rewrite history with reset/rebase/add/commit loops while preserving the later commit on top. | `but uncommit --diff`, then replacement `but commit` calls. | The agent does one split plan from one inspected diff instead of repeatedly refreshing stale patch state. |
| Reorder Existing Commits | Edit an interactive rebase todo and avoid accidentally changing commit contents. | `but move <commit block> <target commit>`. | The operation is movement, not patch replay. Fewer places to get clever and break the DAG. |
| Squash Commit Groups | Run an interactive rebase, mark squash/fixup lines, edit messages, and verify the final stack. | `but squash <commits> -m <message>`. | The agent names the group and result directly, without driving an editor-shaped workflow. |

## Provenance

The 2026-06-26 k=5 matrix used the latest local GitButler binary and skill from `/Users/kiril/src/gitbutler`, with clean source snapshots.

- Setup source command: `but agent setup --print`
- Setup block SHA-256: `fbec593878727e872b248adfd0226b3555e5bd31273ac7506018d2679b68e897`
- Binary SHA-256: `27e7368d50857465c17c7d91591df972c9cfc28b67417bdc593e81eebb7d4d42`
- Skill file SHA-256: `e4856d3a6a09dc60bb76e4f18a715d82c4078791dc373086d01af32b35d2dbed`
- Skill tree SHA-256: `b39f059ca747afed33a1e7255d3cd7a427c9e28011debbf7a77e8fdfeabb9229`
- GitButler source head: `2e9a1b454b087d4047a3733afa52812c15805e0d`
- Binary dirty: `false`
- Skill dirty: `false`

## Evidence

- Full batch report: [full-k5-2026-06-26.md](full-k5-2026-06-26.md)
- Previous full batch report: [full-k3-2026-06-22.md](full-k3-2026-06-22.md)
- Historical Codex/Claude `but+skill` pilot 1 reruns: [pilot-1-but-latest-2026-06-25.md](pilot-1-but-latest-2026-06-25.md)
- Historical clean-harness Codex/Claude `but+skill` pilot 1 reruns: [pilot-1-codex-but-clean-harness-2026-06-25.md](pilot-1-codex-but-clean-harness-2026-06-25.md)
- Historical Codex `but+skill` pilot 2 reruns: [pilot-2-codex-but-latest-2026-06-25.md](pilot-2-codex-but-latest-2026-06-25.md)
- Historical Claude `but+skill` pilot 2 rerun: [pilot-2-claude-but-latest-2026-06-25.md](pilot-2-claude-but-latest-2026-06-25.md)
- Historical Claude `but+skill` pilot 3 config-isolation rerun: [pilot-3-claude-but-clean-config-2026-06-25.md](pilot-3-claude-but-clean-config-2026-06-25.md)
- Historical scenario 4 reorder guidance fix: [pilot-4-reorder-guidance-fix-2026-06-25.md](pilot-4-reorder-guidance-fix-2026-06-25.md)
- Historical Codex `but+skill` pilot 5 rerun: [pilot-5-codex-but-latest-2026-06-25.md](pilot-5-codex-but-latest-2026-06-25.md)
- Historical Claude `but+skill` pilot 5 rerun: [pilot-5-claude-but-latest-2026-06-25.md](pilot-5-claude-but-latest-2026-06-25.md)
- Plain-English scenarios: [../scenarios.md](../scenarios.md)
- Raw aggregate: `tmp/pilot-runs/full-k5-20260626-013621/aggregate.json`
- Raw run manifest: `tmp/pilot-runs/full-k5-20260626-013621/manifest.tsv`
