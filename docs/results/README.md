# Results Overview

Latest full matrix: [full-k5-2026-06-27.md](full-k5-2026-06-27.md).

Short answer: yes, the latest clean `but+skill` setup is still improving strongly against plain `git`. In the refreshed k=5 full matrix, `but+skill` passed all 50 runs. Plain `git` passed 49/50, with one Codex multi-amend content failure.

Compared with plain `git`, `but+skill` cut mean wall time by 64.1% for Codex and 53.2% for Claude, while cutting task-relevant version-control commands by 82.4% and 81.7%.

This is a comparison of plain `git` against GitButler CLI with the agent skill, reported as `but+skill`. It is not a claim about naked `but`, and it is definitely not a GitHub comparison.

## Current Scorecard

Scope: all five pilot scenarios, `k=5` per `(scenario, agent, arm)` group, Codex and Claude, 100 total runs. Setup work is excluded: fixture creation, `but setup`, skill installation, local agent instruction files, and dirty-state application are not counted as agent work.

| Agent | Arm | Pass | Mean wall | Median wall | Max wall | Task VC commands | Failed task VC commands |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Codex | `git` | 24/25 | 88.8s | 71.1s | 223.0s | 22.2 | 0.8 |
| Codex | `but+skill` | 25/25 | 31.9s | 27.1s | 60.7s | 3.9 | 0.0 |
| Claude | `git` | 25/25 | 101.2s | 51.5s | 316.2s | 24.0 | 0.4 |
| Claude | `but+skill` | 25/25 | 47.3s | 43.4s | 110.2s | 4.4 | 0.2 |

## Current Read

The biggest result is still correctness: all `but+skill` runs passed again. The only failure was Codex using plain `git`:

| Scenario | Plain `git` pass | Failure classes |
| --- | ---: | --- |
| Multi-amend, Codex | 4/5 | `CONTENT_WRONG` |

For average-user version-control requests, the shape is pretty clear: `but+skill` removes a lot of low-level choreography. The clearest win is selective multi-amend, where Codex plain `git` took 187.6s on average and passed 4/5, while Codex `but+skill` took 41.3s and passed 5/5. Claude showed the same pattern without a correctness miss: 198.0s with `git` versus 47.6s with `but+skill`.

The previous weak spot, Claude reorder commits, looks fixed in this refresh: `but+skill` was 25.0% faster than plain `git` and used 64.7% fewer task VC commands. The remaining soft spot is squash: `but+skill` still uses far fewer commands, but mean wall time is close to plain `git`, especially for Claude.

## Previous k=5 Comparison

Compared with [full-k5-2026-06-26.md](full-k5-2026-06-26.md), this refresh improved overall pass rate from 95/100 to 99/100. The `but+skill` pass rate stayed perfect at 50/50.

| Agent | Arm | Pass Change | Mean Wall Change | Task VC Change | Read |
| --- | --- | --- | --- | --- | --- |
| Codex | `git` | 25/25 -> 24/25 | 83.6s -> 88.8s | 21.4 -> 22.2 | Slightly worse, with one real multi-amend content failure. |
| Codex | `but+skill` | 25/25 -> 25/25 | 31.2s -> 31.9s | 3.6 -> 3.9 | Basically flat; still clean. |
| Claude | `git` | 20/25 -> 25/25 | 231.7s -> 101.2s | 23.3 -> 24.0 | Much cleaner, mostly from losing the huge failure/outlier tail. |
| Claude | `but+skill` | 25/25 -> 25/25 | 82.6s -> 47.3s | 8.5 -> 4.4 | Much better; prior command flailing is mostly gone. |

## Scenario Results

Each scenario name links to the plain-English scenario guide.

| # | Scenario | What it exercises | Codex result | Claude result |
| ---: | --- | --- | --- | --- |
| 1 | [Selective Validation Commit](../scenarios.md#1-selective-validation-commit) | Commit one topic from a messy worktree and leave unrelated work alone. | 74.5% less wall, 90.7% fewer task VC commands | 41.0% less wall, 79.2% fewer task VC commands |
| 2 | [Selective Multi-Amend](../scenarios.md#2-selective-multi-amend) | Fold several dirty fixes into different older commits. | 78.0% less wall, 82.9% fewer task VC commands; `but+skill` passed 5/5 vs `git` 4/5 | 76.0% less wall, 89.6% fewer task VC commands |
| 3 | [Split Broad Commit](../scenarios.md#3-split-broad-commit) | Replace one broad non-top commit with several clean commits. | 50.5% less wall, 81.3% fewer task VC commands | 50.3% less wall, 83.1% fewer task VC commands |
| 4 | [Reorder Existing Commits](../scenarios.md#4-reorder-existing-commits) | Move correct commits into a better order without changing contents. | 56.1% less wall, 76.7% fewer task VC commands | 25.0% less wall, 64.7% fewer task VC commands |
| 5 | [Squash Commit Groups](../scenarios.md#5-squash-commit-groups) | Compress noisy adjacent commits into semantic commits. | 16.1% less wall, 71.2% fewer task VC commands | 2.7% less wall, 63.2% fewer task VC commands |

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

The 2026-06-27 k=5 matrix used the latest local GitButler binary and skill from `/Users/kiril/src/gitbutler`, with clean source snapshots.

- Setup source command: `but agent setup --print`
- Setup block SHA-256: `e68d505c5f060b89692c253e8dddb689fb42c5a61fc001bdce0a8dc383db76b2`
- Binary SHA-256: `2de4303dd47fa81c7e078b1772188c32ad59b8eb3b4f7d99ab079cc87ab7d880`
- Skill file SHA-256: `220431b093e2ca05c0f7b00925093ed683d839dd8c3ece2e27255dbe53fdfb6c`
- Skill tree SHA-256: `6ce467c872ae122936eb8cb2f5326c7b86ef8a926e748aabf19d651d195b5ee5`
- GitButler source head: `3422ca7e1e45f9abcabc2da33eaf91c91c525b2e`
- Binary dirty: `false`
- Skill dirty: `false`

## Evidence

- Full batch report: [full-k5-2026-06-27.md](full-k5-2026-06-27.md)
- Previous k=5 full batch report: [full-k5-2026-06-26.md](full-k5-2026-06-26.md)
- Results archive: [archive.md](archive.md)
- Plain-English scenarios: [../scenarios.md](../scenarios.md)
- Raw aggregate: `tmp/pilot-runs/full-k5-20260627-refresh/aggregate.json`
- Raw run manifest: `tmp/pilot-runs/full-k5-20260627-refresh/manifest.tsv`
