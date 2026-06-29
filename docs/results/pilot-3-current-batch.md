# Pilot 3 Historical Batch

> Current results: this early pilot batch is historical context. The latest k=5 full-matrix test run is displayed in [full-k5-2026-06-29.md](full-k5-2026-06-29.md).

Date: 2026-06-20
Updated: 2026-06-21

Task: `pilot-3-split-commit`

Scenario: a tiny TypeScript repo starts on an existing `split-workflow` branch. The agent must split the non-top commit `add lead workflow` into three specified commits, keep the existing top commit above them, and leave mixed leftover changes uncommitted.

## Headline

All included Codex runs passed. `but+skill` is now clearly faster and smaller than plain `git` on this scenario after adding two generic CLI affordances:

- `but commit batch`, which creates multiple selected commits from one inspected dirty diff.
- `but uncommit --diff`, which exposes the resulting hunk IDs immediately after uncommitting.

The current realistic setup keeps the scenario prompt user-like and uses only generic `but+skill` arm guidance. Five fresh runs all passed under 30s: mean 22.30s, max 26.76s.

Older rows below remain as historical ablations because they explain why the new primitives matter.

## Scorecard

Pre-run fixture setup, `but setup`, applying `split-workflow`, skill installation, and local agent instructions are excluded from measured duration and command metrics.

| Agent | Arm / Setup | n | Pass | Mean Wall | First Mutation | Task VC Cmds | Inspect | Mutate | Cold Transcript | Warm Transcript | Skill Output | Tokens |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Codex | `git` | 1 | 1/1 | 76.27s | 33.31s | 25.0 | 14.0 | 9.0 | 16.4 KB | 16.4 KB | 0.0 KB | 36.1k |
| Codex | `but+skill`, previous best single run | 1 | 1/1 | 58.32s | 18.44s | 10.0 | 3.0 | 5.0 | 36.2 KB | 24.5 KB | 11.7 KB | 45.7k |
| Codex | `but+skill`, stop-after-move full skill | 3 | 3/3 | 56.84s | 14.75s | 10.3 | 3.3 | 5.0 | 36.9 KB | 25.0 KB | 11.9 KB | 42.7k |
| Codex | `but+skill`, slim + stop | 3 | 3/3 | 51.83s | 14.17s | 11.0 | 4.0 | 5.0 | 36.1 KB | 25.8 KB | 10.2 KB | 39.2k |
| Codex | `but+skill`, generic scenario prompt | 1 | 1/1 | 84.30s | 16.62s | 11.0 | 4.0 | 5.0 | 53.2 KB | 27.1 KB | 26.1 KB | 51.2k |
| Codex | `but+skill`, Pilot 3 fast-path ablation | 1 | 1/1 | 27.01s | 7.97s | 10.0 | 3.0 | 5.0 | 21.2 KB | 21.2 KB | 0.0 KB | 23.4k |
| Codex | `but+skill`, empty-first ablation | 1 | 1/1 | 95.14s | 32.01s | 26.0 | 12.0 | 12.0 | 53.2 KB | 42.0 KB | 11.2 KB | 76.2k |
| Codex | `but+skill`, batch + uncommit diff | 5 | 5/5 | 22.30s | 8.22s | 5.0 | 1.0 | 2.0 | 15.1 KB | 15.1 KB | 0.0 KB | 24.8k |

## Read

Plain `git` passed, but needed a larger interactive-history workflow: 25 task-relevant VC commands, 14 inspections, and 9 mutations.

The old best safe `but+skill` shape was:

```bash
but status -fv --format agent
but uncommit <broad-commit>
but diff
but commit <branch> -m "refactor validation helpers" --changes <ids>
but diff
but commit <branch> -m "tune lead scoring" --changes <ids>
but diff
but commit <branch> -m "document lead workflow" --changes <ids>
but move <preserved-top-commit> <branch>
```

Some runs skip the third `but diff` and still pass because untouched hunk IDs remain usable. The skill should not teach that as a default. Refreshing before the final split commit is one extra command, but it is the safer general behavior.

The new preferred `but+skill` shape is:

```bash
but status -fv --format agent
but uncommit <broad-commit> --diff
but commit batch <branch> --before <rewritten-top-commit> \
  -m "refactor validation helpers" --changes <ids> \
  -m "tune lead scoring" --changes <ids> \
  -m "document lead workflow" --changes <ids>
```

This removes two correctness-sensitive loops:

- `but uncommit --diff` removes the separate post-uncommit `but diff` command while still printing hunk IDs.
- `but commit batch` lets the agent specify all replacement commits from one inspected diff; the CLI re-materializes selected hunks internally after earlier replacement commits change the working diff.

The 84.30s generic run read `.codex/skills/but/SKILL.md`, then later read `references/reference.md` to confirm `but move` ordering semantics. That added 26.1 KB of skill/reference output. Its warm estimated transcript was 27.1 KB, so this scenario should report cold and warm numbers separately.

The 27.01s fast-path run used prompt/harness optimizations rather than a different GitButler primitive: it prevented cold skill/reference reads, removed progress narration, gave an explicit Pilot 3 command recipe, and forced a terse final response. Treat it as an upper-bound ablation only.

An empty-first ablation was also tested after `but commit empty -m` became available:

```bash
but status -fv --format agent
but show <source>
but commit empty <source> -m "refactor validation helpers"
but commit empty <rewritten-source> -m "tune lead scoring"
but commit empty <rewritten-source> -m "document lead workflow"
but rub <source-readme-file> <docs-commit>
but rub <source-doc-file> <docs-commit>
but rub <source-leftover-or-mixed-file> zz
but diff
but amend <validation-commit> --changes <ids>
but diff
but amend <scoring-commit> --changes <ids>
but uncommit <empty-source>
```

It passed, but it was much heavier: 18 visible `but` commands, 12 mutations, 12 task inspections, 95.14s wall time, and 76.2k tokens. The extra cost comes from creating placeholders, moving whole-file committed changes one at a time, unassigning mixed files, then re-amending hunks. It is not the preferred recipe for this scenario.

## Low-Hanging Fruit

- The top-level skill size matters for Codex cold starts. Moving recovery/conflict detail out of `SKILL.md` saved about 1.7 KB of skill output without hurting pass rate.
- The explicit "stop after final split mutation" rule removed the redundant final `but status -fv --format agent` seen in the earlier agent-format run.
- The remaining extra `but diff` exists because agents need fresh hunk IDs after mutations. A future CLI output that returns compact remaining hunk IDs after `but commit` could remove that inspection safely.
- The generic run spent real time reading reference docs to confirm `but move` direction. A small, generic top-level skill note for "move commit to branch places it on top" may reduce that without overfitting to Pilot 3.
- `but commit empty -m` helps placeholder workflows, but it does not by itself make split commits cheaper. The missing primitive is committed hunk movement: without it, agents still have to move whole files out and re-amend dirty hunk IDs.
- `but commit batch` is the bigger low-hanging fruit than more prompt work. It removes multiple model/tool loops and avoids relying on stale hunk IDs after mutations.
- `but uncommit --diff` is useful, but only if the command still emits the rewritten top commit ID through status-after; otherwise agents may reuse the stale pre-uncommit top ID and fail the first batch commit.
- Wall time is noisy; command counts, first-mutation time, transcript bytes, and tokens are more stable signals for comparing these skill edits.

## Included Runs

| Group | Run IDs |
| --- | --- |
| Codex `git` | `pilot3-nontop-codex-git-1` |
| Codex `but+skill`, previous best | `pilot3-nontop-codex-but-skill-toprestore-skill-1` |
| Codex `but+skill`, stop-after-move full skill | `pilot3-nontop-codex-but-skill-stop-after-move-1`, `pilot3-nontop-codex-but-skill-stop-after-move-2`, `pilot3-nontop-codex-but-skill-stop-after-move-3` |
| Codex `but+skill`, slim + stop | `pilot3-nontop-codex-but-skill-slim-stop-1`, `pilot3-nontop-codex-but-skill-slim-stop-2`, `pilot3-nontop-codex-but-skill-slim-stop-3` |
| Codex `but+skill`, generic scenario prompt | `pilot3-generic-noskillread-1` |
| Codex `but+skill`, Pilot 3 fast-path ablation | `pilot3-fastpath-1` |
| Codex `but+skill`, empty-first ablation | `pilot3-empty-first-codex-but-skill-1` |
| Codex `but+skill`, batch + uncommit diff | `pilot3-batch-undiff-2`, `pilot3-batch-undiff-3`, `pilot3-batch-undiff-4`, `pilot3-batch-undiff-5`, `pilot3-batch-undiff-6` |

Raw artifacts live under `tmp/pilot-runs/` and are intentionally not checked in.
