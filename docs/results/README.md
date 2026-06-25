# Results Overview

Latest full matrix: [full-k3-2026-06-22.md](full-k3-2026-06-22.md).

Short answer: on the current checked-in full batch, `but+skill` wins clearly. All 60 runs passed. Compared with plain `git`, `but+skill` cut mean wall time by 52% for Codex and 72% for Claude, while cutting task-relevant version-control commands by 79% and 85%.

This is a comparison of plain `git` against GitButler CLI with the agent skill, reported as `but+skill`. It is not a claim about naked `but`, and it is definitely not a GitHub comparison.

## Current Scorecard

Scope: all five pilot scenarios, `k=3` per `(scenario, agent, arm)` group, Codex and Claude, 60 total runs. Setup work is excluded: fixture creation, `but setup`, skill installation, local agent instruction files, and dirty-state application are not counted as agent work.

| Agent | Pass | Mean wall with `git` | Mean wall with `but+skill` | Wall reduction | Task VC commands with `git` | Task VC commands with `but+skill` | Command reduction |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Codex | 15/15 each arm | 75.5s | 35.9s | 52.4% | 19.9 | 4.1 | 79.3% |
| Claude | 15/15 each arm | 138.7s | 39.2s | 71.7% | 28.3 | 4.1 | 85.4% |

Median wall time was lower for `but+skill` in all 10 scenario/agent pairs. Mean wall time was lower in 9 of 10 pairs; the exception was one Claude squash outlier, and the documented follow-up rerun restored the expected shape.

## Warm Output Burden

The current batch does not expose a strict VC-output-only byte counter from command stdout/stderr. The closest checked-in proxy is warm-estimated transcript bytes: prompt plus agent stdout/stderr after subtracting visible skill/reference reads. Treat this as a within-agent output-burden metric, not as comparable token accounting across Codex and Claude.

| Agent | Warm output with `git` | Warm output with `but+skill` | Delta | Reduction |
| --- | ---: | ---: | ---: | ---: |
| Codex | 21.5 KB | 11.3 KB | -10.2 KB | 47.3% |
| Claude | 1.7 KB | 1.4 KB | -0.3 KB | 17.0% |

By scenario, `but+skill` had lower warm output in 8 of 10 scenario/agent pairs. The two exceptions were squash runs, where `but+skill` still used far fewer task VC commands but printed slightly more warm transcript.

| # | Scenario | Codex warm output | Claude warm output |
| ---: | --- | ---: | ---: |
| 1 | [Selective Validation Commit](../scenarios.md#1-selective-validation-commit) | 11.1 -> 6.9 KB (-37.6%) | 1.2 -> 0.9 KB (-26.3%) |
| 2 | [Selective Multi-Amend](../scenarios.md#2-selective-multi-amend) | 58.8 -> 24.5 KB (-58.4%) | 2.1 -> 1.5 KB (-30.0%) |
| 3 | [Split Broad Commit](../scenarios.md#3-split-broad-commit) | 24.9 -> 13.1 KB (-47.5%) | 2.2 -> 1.7 KB (-19.1%) |
| 4 | [Reorder Existing Commits](../scenarios.md#4-reorder-existing-commits) | 7.1 -> 5.0 KB (-29.6%) | 1.5 -> 1.3 KB (-11.2%) |
| 5 | [Squash Commit Groups](../scenarios.md#5-squash-commit-groups) | 5.5 -> 7.1 KB (+30.2%) | 1.5 -> 1.6 KB (+6.0%) |

## Scenario Results

Each scenario name links to the plain-English scenario guide.

| # | Scenario | What it exercises | Codex result | Claude result |
| ---: | --- | --- | --- | --- |
| 1 | [Selective Validation Commit](../scenarios.md#1-selective-validation-commit) | Commit one topic from a messy worktree and leave unrelated work alone. | 60.3% less wall, 84.0% fewer task VC commands | 71.1% less wall, 81.1% fewer task VC commands |
| 2 | [Selective Multi-Amend](../scenarios.md#2-selective-multi-amend) | Fold several dirty fixes into different older commits. | 37.5% less wall, 69.1% fewer task VC commands | 80.8% less wall, 89.3% fewer task VC commands |
| 3 | [Split Broad Commit](../scenarios.md#3-split-broad-commit) | Replace one broad non-top commit with several clean commits. | 71.7% less wall, 89.6% fewer task VC commands | 85.7% less wall, 91.1% fewer task VC commands |
| 4 | [Reorder Existing Commits](../scenarios.md#4-reorder-existing-commits) | Move correct commits into a better order without changing contents. | 51.0% less wall, 76.0% fewer task VC commands | 39.5% less wall, 82.9% fewer task VC commands |
| 5 | [Squash Commit Groups](../scenarios.md#5-squash-commit-groups) | Compress noisy adjacent commits into semantic commits. | 38.8% less wall, 73.5% fewer task VC commands | Full batch: 8.2% more mean wall because of one outlier, but 66.1% fewer task VC commands. Follow-up rerun: 64.3% less wall and 85.2% fewer task VC commands. |

## What Is Actually Different

The speedup mostly comes from replacing low-level history choreography with one purpose-built operation per intent. The command runtime itself is tiny; the real savings are fewer inspect-plan-mutate loops for the agent.

| Scenario | Plain `git` shape | `but+skill` shape | Why it matters |
| --- | --- | --- | --- |
| Selective Validation Commit | Create a branch, inspect/stage the right files or hunks, commit, then verify leftovers. | `but branch new`, inspect change IDs, `but commit --changes`. | The agent selects semantic change IDs instead of manually staging a dirty worktree. |
| Selective Multi-Amend | Use fixups, autosquash, interactive rebase stops, patch files, stash/reapply, or equivalent manual surgery. | `but amend <commit> --changes <ids>` once per target commit. | The intended operation is "put these hunks into that old commit"; GitButler exposes that directly. |
| Split Broad Commit | Rewrite history with reset/rebase/add/commit loops while preserving the later commit on top. | `but uncommit --diff`, then `but commit batch` for the replacement commits. | The agent does one split plan from one inspected diff instead of repeatedly refreshing stale patch state. |
| Reorder Existing Commits | Edit an interactive rebase todo and avoid accidentally changing commit contents. | `but move <commit block> <target commit>`. | The operation is movement, not patch replay. Fewer places to get clever and break the DAG. |
| Squash Commit Groups | Run an interactive rebase, mark squash/fixup lines, edit messages, and verify the final stack. | `but squash <commits> -m <message>`. | The agent names the group and result directly, without driving an editor-shaped workflow. |

## Evidence

- Full batch report: [full-k3-2026-06-22.md](full-k3-2026-06-22.md)
- Latest Codex/Claude `but+skill` pilot 1 reruns: [pilot-1-but-latest-2026-06-25.md](pilot-1-but-latest-2026-06-25.md)
- Latest Codex `but+skill` pilot 2 rerun: [pilot-2-codex-but-latest-2026-06-25.md](pilot-2-codex-but-latest-2026-06-25.md)
- Latest Claude `but+skill` pilot 2 rerun: [pilot-2-claude-but-latest-2026-06-25.md](pilot-2-claude-but-latest-2026-06-25.md)
- Claude `but+skill` pilot 3 config-isolation rerun: [pilot-3-claude-but-clean-config-2026-06-25.md](pilot-3-claude-but-clean-config-2026-06-25.md)
- Scenario 4 reorder guidance fix: [pilot-4-reorder-guidance-fix-2026-06-25.md](pilot-4-reorder-guidance-fix-2026-06-25.md)
- Latest Codex `but+skill` pilot 5 rerun: [pilot-5-codex-but-latest-2026-06-25.md](pilot-5-codex-but-latest-2026-06-25.md)
- Latest Claude `but+skill` pilot 5 rerun: [pilot-5-claude-but-latest-2026-06-25.md](pilot-5-claude-but-latest-2026-06-25.md)
- Plain-English scenarios: [../scenarios.md](../scenarios.md)
- Raw aggregate: `tmp/pilot-runs/full-k3-20260622-224850/aggregate.json`
- Raw run manifest: `tmp/pilot-runs/full-k3-20260622-224850/manifest.tsv`
