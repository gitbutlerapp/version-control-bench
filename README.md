# version-control-bench

**Which version-control tool should you give your coding agent?** Live results: [vcbench.dev](https://vcbench.dev/)

This benchmark holds the agents fixed — Claude Code and Codex — and varies the toolset: plain `git`, Jujutsu (`jj+skill`), and GitButler (`but+skill`), each scored on reliability, speed, and efficiency across five common version-control operations. This fork adds an unmeasured `jj-axi+skill` arm using the same setup and deterministic grader; it must not be compared with the published three-tool results until it has completed an equivalent matrix. Most benchmarks in this space fix the tool and compare models; this one fixes the agents and compares the tools — a measurement of agent–tool fit (what the industry has started calling agent experience) rather than a model leaderboard.

This is not a coding benchmark. The file changes already exist before the agent starts; the agent's job is to produce the right Git-visible state — commit boundaries, branch topology, what stays uncommitted, protected history. A deterministic grader judges the resulting Git history, never the commands used to produce it. And it is not a Claude-versus-Codex comparison: both agents run so the tool effect can be checked across them.

The benchmark is maintained by GitButler, one of the three tools measured. Read everything here with that in mind, and check rather than trust: the grader is deterministic, and the tasks, harness, per-run evidence, and data are public in this repo.

## Latest results

Full matrix from 2026-07-06 (Codex on `gpt-5.5`, Claude Code on `claude-opus-4-8`): 5 scenarios x 3 tools x 2 agents, ten runs per cell (k=10), 300 graded runs, 299 passed.

**On the current frontier models all three tools are reliable on these operations — 299 of 300 runs passed — so speed and efficiency are the separator, not reliability.** GitButler finished roughly 60% faster than plain `git` with about 80% fewer version-control commands (Claude 44.5s vs 118.0s, Codex 28.7s vs 105.9s); Jujutsu ran slower than plain `git` for both agents (Claude 167.8s, Codex 115.9s). The one failure in the whole matrix was a single Codex run splitting a commit with Jujutsu.

Read the mean wall time alongside the median: `git` and Jujutsu both have heavy right tails (a Codex `git` run took 890s and a Codex Jujutsu run 839s — genuine agent floundering that still passed), so their means sit above their medians, while GitButler's slowest run was ~86s. On typical (median) runs GitButler is ~37-58% faster than `git`; on the mean it is ~62-73%. Either way GitButler has no comparable tail.

The reliability tie is a change from an earlier generation: on `claude-opus-4-1-20250805` (k=7, 2026-07-03), Claude failed split-commit in 5 of 7 runs with `git` and 6 of 7 with Jujutsu while GitButler passed every run — that gap closed as the model improved, which is the kind of shift this benchmark exists to track. With both agents now near the ceiling, harder scenarios are the priority before the reliability comparison says anything about frontier agents.

With five scenarios the task-clustered 95% intervals on the wall-time deltas are wide (the direction is consistent across scenarios, but the effect size is measured on these operations only); the command-count reduction for GitButler is the tightest effect, and at k=10 the paired command-count and Codex wall-time intervals for GitButler exclude zero. Confidence intervals and paired per-scenario deltas are in the [full writeup](docs/results/full-k10-2026-07-06.md).

Each cell shows pass rate, mean wall time, and mean version-control commands per run. **Bold** marks the fastest tool that passed every run of that scenario.

### Codex (gpt-5.5)

| Scenario | git | Jujutsu | GitButler |
| --- | --- | --- | --- |
| Selective commit | 7/7 · 67.8s · 19 cmds | 7/7 · 99.2s · 20 cmds | **7/7 · 30.8s · 2 cmds** |
| Multi-amend | 7/7 · 174.4s · 44 cmds | 7/7 · 208.5s · 25 cmds | **7/7 · 36.5s · 6 cmds** |
| Split commit | 7/7 · 116.2s · 30 cmds | 7/7 · 185.9s · 37 cmds | **7/7 · 33.0s · 6 cmds** |
| Reorder commits | 7/7 · 54.4s · 11 cmds | 7/7 · 58.4s · 11 cmds | **7/7 · 20.6s · 2 cmds** |
| Squash commits | 7/7 · 34.1s · 11 cmds | 7/7 · 43.3s · 11 cmds | **7/7 · 24.3s · 3 cmds** |
| **All scenarios** | 35/35 · 89.4s · 23 cmds | 35/35 · 119.0s · 21 cmds | **35/35 · 29.0s · 4 cmds** |

### Claude Code (claude-opus-4-1-20250805)

| Scenario | git | Jujutsu | GitButler |
| --- | --- | --- | --- |
| Selective commit | 6/7 · 169.9s · 18 cmds | 5/7 · 172.3s · 21 cmds | **7/7 · 52.3s · 4 cmds** |
| Multi-amend | 6/7 · 598.1s · 58 cmds | 6/7 · 585.5s · 36 cmds | **7/7 · 97.5s · 9 cmds** |
| Split commit | 2/7 · 294.4s · 25 cmds | 1/7 · 456.4s · 43 cmds | **7/7 · 157.5s · 17 cmds** |
| Reorder commits | **7/7 · 68.0s · 6 cmds** | 7/7 · 91.3s · 14 cmds | 7/7 · 97.6s · 9 cmds |
| Squash commits | 7/7 · 111.6s · 12 cmds | 6/7 · 105.8s · 15 cmds | **7/7 · 82.5s · 10 cmds** |
| **All scenarios** | 28/35 · 248.4s · 24 cmds | 25/35 · 282.2s · 26 cmds | **35/35 · 97.5s · 10 cmds** |

Both agents are run to check whether the tool effect holds across them; this is not a Claude-versus-Codex comparison.

More detail:

- Interactive results with per-scenario breakdowns and the failure ledger: [vcbench.dev](https://vcbench.dev/) (source in [web/](web/)).
- Checked-in results overview: [docs/results/README.md](docs/results/README.md).
- Latest full-matrix writeup: [docs/results/full-k7-2026-07-03.md](docs/results/full-k7-2026-07-03.md).

## Scenarios

Each scenario is a pre-built Git repository (a commit history plus uncommitted changes) and a plain-English instruction describing the intended result. No code is generated during a run; only the version-control operation is measured. For a friendlier walk-through with sketches, see [docs/scenarios.md](docs/scenarios.md).

```text
1. selective commit:   messy worktree -> [one clean validation commit] + leftovers
2. multi-amend:        dirty fixes -> old commit A, old commit C, old commit E
3. split commit:       [big mixed commit] -> [validation] [scoring] [docs]
4. reorder commits:    A B C D E F -> A D E B C F
5. squash commits:     A B C D E F G -> A [B+C] D [E+F+G]
```

| Task | What it tests | QA |
| --- | --- | --- |
| [`pilot-1-selective-validation`](tasks/pilot-1-selective-validation) | Create a new branch and commit only input-validation changes while leaving mixed same-file and cross-file leftovers uncommitted. | `npm run pilot:check` |
| [`pilot-2-multi-amend`](tasks/pilot-2-multi-amend) | Route dirty hunks into three different existing commits while preserving unrelated leftovers. | `npm run pilot2:check` |
| [`pilot-3-split-commit`](tasks/pilot-3-split-commit) | Replace one broad non-top commit with three semantic commits, keep later history above it, and expose leftovers as uncommitted. | `npm run pilot3:check` |
| [`pilot-4-reorder-commits`](tasks/pilot-4-reorder-commits) | Move an adjacent commit block earlier in a six-commit branch without changing commit contents. | `npm run pilot4:check` |
| [`pilot-5-squash-commits`](tasks/pilot-5-squash-commits) | Squash two adjacent commit groups in a seven-commit branch into two semantic commits while preserving final contents. | `npm run pilot5:check` |

## How it's scored

- **Identical instruction across tools.** Each task ships as one prepared fixture repo with one plain-English instruction. The tool's name does not appear in the prompt; the agent decides how to carry it out.
- **Deterministic grader.** Correctness is checked by a hidden, scripted verifier that inspects the final Git state: commit boundaries, branch topology, and what stayed uncommitted. It is not an LLM judge and does not compare commands against a reference — two different command sequences pass if they produce the same history.
- **Timing boundary.** Fixture build, workspace prep, skill installation, and dirty-state application all happen before timing begins; the measured figures cover only the agent's work on the task.
- **Git write restriction.** In GitButler and Jujutsu runs, raw git write commands are blocked so the agent must use the tool under test. Git calls a tool makes internally count as tool-internal work, not agent commands.
- **k=7.** Every agent-tool-task cell ran seven times; reported numbers are means over those runs. Checked-in reports also carry Wilson 95% intervals on pass rates, paired per-scenario deltas with task-clustered CIs, and per-scenario pass^k ("passed all 7 runs").

Full method docs: [benchmark design](docs/benchmark-design.md), [scoring and validation](docs/scoring-and-validation.md), [fairness and anti-cheat](docs/fairness-and-anti-cheat.md), [results presentation](docs/results-presentation.md).

## What's here

- Five VC-only pilot tasks under [tasks/](tasks/), with a quick index at [tasks/README.md](tasks/README.md).
- Synthetic TypeScript fixtures generated by `scripts/create-pilot*-fixture.mjs`.
- Hidden oracle verifiers under `scripts/verify-pilot*.mjs`.
- Reference `git` and `but` solutions in each task directory.
- An agent runner for Codex and Claude: `scripts/run-pilot-agent.mjs`.
- Tool-policy wrappers that block the wrong write tool per arm and split measurements into task, platform, and tool-internal commands.
- Checked-in result summaries under [docs/results/](docs/results/).
- The [vcbench.dev](https://vcbench.dev/) results site under [web/](web/).

Design notes live in [docs/README.md](docs/README.md); this root README doubles as the operator runbook below.

## Running the benchmark

### Verifier QA

```bash
npm run pilot:check
npm run pilot2:check
npm run pilot3:check
npm run pilot4:check
npm run pilot5:check
```

Each check proves no-op and known-wrong states fail, then verifies the reference solutions.

### Agent trials

Run one task with Codex:

```bash
npm run pilot:agent -- --task pilot-3-split-commit --agent codex --arm git
npm run pilot:agent -- --task pilot-3-split-commit --agent codex --arm 'but+skill'
npm run pilot:agent -- --task pilot-3-split-commit --agent codex --arm 'jj+skill'
npm run pilot:agent -- --task pilot-3-split-commit --agent codex --arm 'jj-axi+skill' --jj-axi-bin /absolute/path/to/jj-axi --jj-axi-skill-dir /absolute/path/to/jj-axi/skills/jj-axi
```

Run one task with Claude:

```bash
npm run pilot:agent -- --task pilot-5-squash-commits --agent claude --arm git
npm run pilot:agent -- --task pilot-5-squash-commits --agent claude --arm 'but+skill'
npm run pilot:agent -- --task pilot-5-squash-commits --agent claude --arm 'jj+skill'
npm run pilot:agent -- --task pilot-5-squash-commits --agent claude --arm 'jj-axi+skill' --jj-axi-bin /absolute/path/to/jj-axi --jj-axi-skill-dir /absolute/path/to/jj-axi/skills/jj-axi
```

Defaults are `--task pilot-1-selective-validation`, `--agent codex`, `--arm git`, Codex model `gpt-5.5`, and Claude model `claude-opus-4-8` (a versioned model ID, so reruns hit the same model; the runner warns if you pass a floating alias like `opus`). Use `--model <name>` to override, or `--codex-model` / `--claude-model` on the matrix runner. The published k=7 results predate this default and used `claude-opus-4-1-20250805`.

The supported arms are:

- `git`: plain Git is allowed for version-control writes; `but` and `jj` are blocked.
- `but+skill`: GitButler is prepared before the measured run, the GitButler skill is installed into `.codex/skills/but` and `.claude/skills/but`, local `AGENTS.md` / `CLAUDE.md` files are written, and raw Git write commands are blocked.
- `jj+skill`: the fixture repo is prepared with `jj git init --colocate`, the external `onevcat/skills@onevcat-jj` skill is fetched into the run directory and installed into the agent skill folders, local `AGENTS.md` / `CLAUDE.md` files are written, and raw Git writes plus GitButler are blocked.
- `jj-axi+skill`: the fixture receives the same colocated JJ preparation as `jj+skill`; the supplied jj-axi skill is installed into `.codex/skills/jj-axi` and `.claude/skills/jj-axi`; and a PATH wrapper allows direct `jj-axi` operations while classifying its child `jj` processes as tool-internal. Direct raw Git writes, `but`, and direct `jj` are blocked.

Pre-run fixture setup, tool setup, applying task branches, skill installation, and dirty-state application are excluded from measured agent duration and command metrics.

### Local GitButler build

Build `but` from the local GitButler checkout and pass it to the runner:

```bash
npm run but:build
npm run pilot:check -- --but-bin /Users/kiril/src/gitbutler/target/release/but
npm run pilot:agent -- --agent codex --arm 'but+skill' --but-bin /Users/kiril/src/gitbutler/target/release/but
```

Use `--skill-dir <path>` to test a different GitButler skill directory.

### Local Jujutsu setup

The `jj+skill` arm uses the `jj` binary found on `PATH` by default. Override it with `--jj-bin <path>`.

By default, the runner fetches the external `onevcat/skills@onevcat-jj` skill pinned to upstream commit `4955f542` and verifies the fetched bytes against a recorded SHA-256, so every run uses identical skill content. Use `--jj-skill-dir <path>` to use a local copy, or `--jj-skill-package`, `--jj-skill-name`, and `--jj-skill-url` to point at another public skill (`--jj-skill-sha256 <hash|none>` controls the integrity check for custom URLs).

### Local jj-axi setup

The `jj-axi+skill` arm requires an explicit compiled binary and local skill directory:

```bash
node scripts/run-pilot-agent.mjs \
  --task pilot-1-selective-validation \
  --agent codex \
  --arm 'jj-axi+skill' \
  --jj-axi-bin /absolute/path/to/jj-axi/target/release/jj-axi \
  --jj-axi-skill-dir /absolute/path/to/jj-axi/skills/jj-axi
```

The runner records the binary path, SHA-256, source Git metadata, version, and the installed skill provenance. Its JJ setup and dirty-state application match `jj+skill`, but its measured task command is the direct `jj-axi` invocation; Jujutsu subprocesses spawned by that binary are recorded as tool-internal.

### Codex isolation

Codex trials use clean config by default: isolated per-run `CODEX_HOME`, auth material only, ignored user rules, ephemeral mode, and plugins disabled. That keeps user config and plugin noise out of timing and transcript measurements.

Useful debug knobs:

```bash
npm run pilot:agent -- --agent codex --arm git --codex-isolated-home false
npm run pilot:agent -- --agent codex --arm git --codex-disable-plugins false
npm run pilot:agent -- --agent codex --arm git --codex-clean-config false
```

### Outputs

Run artifacts are written under `tmp/pilot-runs/` and ignored by Git. A run directory contains the sandbox workspace, `result.json`, the command trace, generated instruction files, and verifier output.

`npm run runs:export -- --batch <batch-name>` packages the publishable evidence for a batch — per-run agent transcripts, command traces, prompts, `result.json`, runner logs, and a final Git-state snapshot per run — into a tarball under `tmp/exports/` (the k=7 batch exports to ~2 MB). The export scans for credential-shaped strings and aborts if any are found. Batches referenced in public results should have their artifact bundle attached to a GitHub release so every reported number can be traced to raw evidence.
Claude runs also write the raw JSON CLI result to `agent-output.json`; `result.json` records the configured model alias and the concrete observed model from Claude's `modelUsage`.

The useful measurement block is `measurement`, not the older coarse `metrics` block. It separates:

- task-relevant VC commands
- platform probes from Codex or Claude startup
- tool-internal Git calls
- command timing
- cold and warm-estimated transcript bytes
- warning and skill/reference output bytes

## Relation to other benchmarks

Neighboring benchmarks answer different questions, mostly of the form "given this tool, which model operates it best":

- [jj-benchmark](https://github.com/TabbyML/jj-benchmark) (TabbyML) fixes one tool — Jujutsu — and compares models on operating it.
- [GitBench](https://gitbench.gitkraken.com/) (GitKraken) is single-turn git question answering across models, without multi-turn tool use.
- [GitGoodBench](https://github.com/JetBrains-Research/git-good-bench) (JetBrains Research, ACL 2025) scores models on git tasks mined from real repositories.
- [Terminal-Bench](https://www.tbench.ai/) (Stanford / Laude Institute) measures general terminal agents across many task types; a handful touch version control.

vcbench inverts the axis: the agents are fixed and the toolset varies, because that is the choice a team faces once the agent is already picked.

## Docs

- [docs/scenarios.md](docs/scenarios.md): plain-English scenario guide with sketches.
- [docs/benchmark-design.md](docs/benchmark-design.md): benchmark model, task lifecycle, arm setup, reporting.
- [docs/task-format.md](docs/task-format.md): task package shape and fixture rules.
- [docs/scoring-and-validation.md](docs/scoring-and-validation.md): Git-state oracles, semantic edit atoms, failure classes, metrics.
- [docs/fairness-and-anti-cheat.md](docs/fairness-and-anti-cheat.md): tool-policy boundaries and leakage prevention.
- [docs/results-presentation.md](docs/results-presentation.md): how to report batches without cherry-picking.
- [docs/research-notes.md](docs/research-notes.md): external benchmark research.
