# Pilot 2 Current Batch

Date: 2026-06-20

Task: `pilot-2-multi-amend`

Scenario: a tiny TypeScript repo starts on an existing five-commit `amend-series` branch with mixed dirty changes across the same files and different files; the agent must amend selected hunks into three specified existing commits while leaving config logging, a debug helper, and an untracked investigation note uncommitted.

## Headline

All included Codex runs passed. On this pilot, `but+skill` was much more efficient than plain `git`: roughly 4-5x faster wall time, about 5x fewer task-relevant VC commands, and exactly 3 history-edit mutations per run.

## Scorecard

Pre-run fixture setup, `but setup`, applying `amend-series`, skill installation, local agent instructions, and dirty-state application are excluded from measured duration and command metrics.

This batch is Codex-only. The `git` comparison uses the two available pilot 2 Codex runs; the `but+skill` group uses five fresh repeats after adding batched `but amend <commit> --changes <ids>` support and updating the skill/instructions.

| Agent | Arm | n | Pass | Mean Wall | Median Wall | First Mutation | Task VC Cmds | Inspect | Mutate | Failed Task VC | Parser Cmds | Cold Transcript | Warm Transcript | Tokens |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Codex | `git` | 2 | 2/2 | 190.24s | 190.24s | 54.07s | 45.5 | 27.0 | 16.5 | 3.5 | 0.0 | 118.8 KB | 118.8 KB | 72.9k |
| Codex | `but+skill` | 5 | 5/5 | 43.71s | 43.26s | 20.53s | 10.0 | 4.8 | 3.0 | 2.0 | 0.0 | 28.8 KB | 21.0 KB | 46.0k |

## Pairwise Deltas

| Agent | `but+skill` Mean Wall Delta | Wall Delta | Task VC Cmd Delta | Task VC Delta | Mutation Delta | Warm Transcript Delta | Token Delta |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Codex | -146.53s | -77.0% | -35.5 | -78.0% | -13.5 | -97.8 KB | -26.9k |

Against the latest single `git` run, the `but+skill` median was 5.0x faster by wall time, used 5.4x fewer task VC commands, and used 6.0x fewer mutations. Against the earlier faster `git` smoke run, `but+skill` was still 3.8x faster, with 3.7x fewer task VC commands and 5.0x fewer mutations.

## Read

Both tools completed the task, but they exposed very different work shapes.

Plain `git` had multiple viable strategies: fixup commits plus autosquash, manual interactive rebase stops, temporary patch files, stash/reapply flows, and repeated validation. That flexibility created visible variance. The two included `git` runs both passed, but one took 164.7s and the other took 215.8s.

`but+skill` compressed the task into the obvious operation: one batched amend per target commit. All five fresh runs used exactly three `but amend` mutations.

Typical `but+skill` trace:

```bash
but status -fv
but diff
but amend <validation-commit> --changes <three-hunk-ids>
but diff
but amend <scoring-commit> --changes <two-hunk-ids>
but diff
but amend <docs-commit> --changes <two-hunk-ids>
```

The remaining `but+skill` time is mostly agent reading/thinking/output, not CLI runtime. Mean observed task VC command runtime was about 0.63s total.

## Low-Hanging Fruit

- `but amend` returns useful rewritten commit/status context, but agents still rerun `but diff` to recover fresh hunk-level IDs. Returning compact remaining hunk IDs after amend could remove 2-3 diff calls.
- Most runs did a final `but diff` just to verify leftovers. Better post-amend leftover output could remove that too.
- The two failed task VC commands in each `but+skill` run are Codex `git config --null --get core.fsmonitor` probes, not GitButler failures. The runner should classify these as platform noise.
- One run probed `but --version`. Tiny, but generated instructions can say version probes are unnecessary.
- Cold transcript varies because Codex sometimes prints the installed skill text. Warm transcript is more stable around 21 KB.

## Included Runs

| Group | Run IDs |
| --- | --- |
| Codex `git` | `pilot2-codex-git-smoke`, `pilot2-rerun-git-20260620` |
| Codex `but+skill` | `pilot2-but-batched-5x-1`, `pilot2-but-batched-5x-2`, `pilot2-but-batched-5x-3`, `pilot2-but-batched-5x-4`, `pilot2-but-batched-5x-5` |

Raw artifacts live under `tmp/pilot-runs/` and are intentionally not checked in.
