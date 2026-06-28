# Results Overview

Latest full matrix: [full-k5-2026-06-28.md](full-k5-2026-06-28.md).

Short answer: yes, the latest `but+skill` setup is still improving strongly against plain `git`. In the refreshed k=5 full matrix, all 100 runs passed verifier checks. Both arms were clean on correctness; `but+skill` is winning on effort and wall time.

Compared with plain `git`, `but+skill` cut mean wall time by 64.2% for Codex and 50.0% for Claude, while cutting task-relevant version-control commands by 81.7% and 80.4%.

This is a comparison of plain `git` against GitButler CLI with the agent skill, reported as `but+skill`. It is not a claim about naked `but`, and it is definitely not a GitHub comparison.

## Current Scorecard

Scope: all five pilot scenarios, `k=5` per `(scenario, agent, arm)` group, Codex and Claude, 100 total runs. Setup work is excluded: fixture creation, `but setup`, skill installation, local agent instruction files, and dirty-state application are not counted as agent work.

| Agent | Arm | Pass | Mean wall | Median wall | Max wall | Task VC commands | Failed task VC commands |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Codex | `git` | 25/25 | 82.7s | 54.4s | 229.6s | 20.1 | 0.5 |
| Codex | `but+skill` | 25/25 | 29.6s | 27.5s | 48.4s | 3.7 | 0.0 |
| Claude | `git` | 25/25 | 92.4s | 60.4s | 211.5s | 21.6 | 0.3 |
| Claude | `but+skill` | 25/25 | 46.2s | 44.0s | 96.0s | 4.2 | 0.2 |

## Current Read

Correctness is clean this time: no verifier failures and no agent-runtime failures. That matters because the previous batch still had one Codex plain-git multi-amend content failure.

The shape is still what we want to see for average-user version-control requests: `but+skill` removes low-level history choreography and keeps the agent closer to the user intent. The strongest wins remain multi-amend and split-commit. Codex multi-amend went from 172.8s with plain `git` to 38.8s with `but+skill`; Claude split-commit went from 173.4s to 72.8s.

The caveat is squash, especially Claude. Claude `but+skill` still used fewer commands, but it was slower than plain `git` on wall time in this run: 65.7s versus 53.2s. That is the main thing to keep watching.

## Previous k=5 Comparison

Compared with [full-k5-2026-06-27.md](full-k5-2026-06-27.md), this refresh improved overall pass rate from 99/100 to 100/100. The `but+skill` pass rate stayed perfect at 50/50, and plain `git` recovered to 50/50.

| Agent | Arm | Pass Change | Mean Wall Change | Task VC Change | Read |
| --- | --- | --- | --- | --- | --- |
| Codex | `git` | 24/25 -> 25/25 | 88.8s -> 82.7s | 22.2 -> 20.1 | Better, mostly because the prior multi-amend content failure did not recur. |
| Codex | `but+skill` | 25/25 -> 25/25 | 31.9s -> 29.6s | 3.9 -> 3.7 | Slightly faster and slightly fewer commands. |
| Claude | `git` | 25/25 -> 25/25 | 101.2s -> 92.4s | 24.0 -> 21.6 | Faster, with fewer low-level commands. |
| Claude | `but+skill` | 25/25 -> 25/25 | 47.3s -> 46.2s | 4.4 -> 4.2 | Basically stable, with a small improvement. |

Scenario-level change versus the previous run is mostly stable-to-better. The biggest positive shift is Claude reorder: `but+skill` moved from 25.0% lower wall to 31.7% lower wall, and from 64.7% fewer task VC commands to 80.4% fewer. The clear negative shift is Claude squash: `but+skill` moved from 2.7% lower wall to 23.7% higher wall, while still using 49.2% fewer task VC commands.

## Scenario Results

Each scenario name links to the plain-English scenario guide.

| # | Scenario | What it exercises | Codex result | Claude result |
| ---: | --- | --- | --- | --- |
| 1 | [Selective Validation Commit](../scenarios.md#1-selective-validation-commit) | Commit one topic from a messy worktree and leave unrelated work alone. | 66.7% less wall, 87.7% fewer task VC commands | 59.0% less wall, 83.6% fewer task VC commands |
| 2 | [Selective Multi-Amend](../scenarios.md#2-selective-multi-amend) | Fold several dirty fixes into different older commits. | 77.5% less wall, 83.4% fewer task VC commands | 68.0% less wall, 86.2% fewer task VC commands |
| 3 | [Split Broad Commit](../scenarios.md#3-split-broad-commit) | Replace one broad non-top commit with several clean commits. | 56.3% less wall, 82.5% fewer task VC commands | 58.0% less wall, 84.6% fewer task VC commands |
| 4 | [Reorder Existing Commits](../scenarios.md#4-reorder-existing-commits) | Move correct commits into a better order without changing contents. | 59.3% less wall, 77.8% fewer task VC commands | 31.7% less wall, 80.4% fewer task VC commands |
| 5 | [Squash Commit Groups](../scenarios.md#5-squash-commit-groups) | Compress noisy adjacent commits into semantic commits. | 24.9% less wall, 64.3% fewer task VC commands | 23.7% more wall, 49.2% fewer task VC commands |

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

The 2026-06-28 k=5 matrix used the latest local GitButler binary and skill from `/Users/kiril/src/gitbutler`.

- Setup source command: `but agent setup --print`
- Setup block SHA-256: `e68d505c5f060b89692c253e8dddb689fb42c5a61fc001bdce0a8dc383db76b2`
- Binary SHA-256: `7c1f5ae7462f67bb9b75b9a5dd54b61c9cc247c35f6762e090d4b1ca2383cdf6`
- Skill file SHA-256: `220431b093e2ca05c0f7b00925093ed683d839dd8c3ece2e27255dbe53fdfb6c`
- Skill tree SHA-256: `6ce467c872ae122936eb8cb2f5326c7b86ef8a926e748aabf19d651d195b5ee5`
- GitButler source head: `0f4aced1b645695fc29ac8c70ea3e9b6ed576fac`
- Binary source dirty state: `false` for the first four `but+skill` runs, then `true` after unrelated local GitButler checkout edits appeared; the binary hash stayed constant.
- Skill dirty: `false`

## Evidence

- Full batch report: [full-k5-2026-06-28.md](full-k5-2026-06-28.md)
- Previous k=5 full batch report: [full-k5-2026-06-27.md](full-k5-2026-06-27.md)
- Results archive: [archive.md](archive.md)
- Plain-English scenarios: [../scenarios.md](../scenarios.md)
- Raw aggregate: `tmp/pilot-runs/full-k5-20260628-refresh/aggregate.json`
- Raw run manifest: `tmp/pilot-runs/full-k5-20260628-refresh/manifest.tsv`
