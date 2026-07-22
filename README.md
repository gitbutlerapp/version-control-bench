# version-control-bench

**Which version-control tool should you give your coding agent?** Live results: [vcbench.dev](https://vcbench.dev/)

This benchmark holds the agents fixed — Claude Code and Codex — and varies the toolset: plain `git`, Jujutsu (`jj+skill`), and GitButler (`but+skill`), each scored on reliability, speed, and efficiency across six common version-control operations. Most benchmarks in this space fix the tool and compare models; this one fixes the agents and compares the tools — a measurement of agent–tool fit (what the industry has started calling agent experience) rather than a model leaderboard.

This is not a coding benchmark. The file changes already exist before the agent starts; the agent's job is to produce the right Git-visible state — commit boundaries, branch topology, what stays uncommitted, protected history. A deterministic grader judges the resulting Git history, never the commands used to produce it. And it is not a Claude-versus-Codex comparison: both agents run so the tool effect can be checked across them.

The benchmark is maintained by GitButler, one of the three tools measured. Read everything here with that in mind, and check rather than trust: the grader is deterministic, and the tasks, harness, per-run evidence, and data are public in this repo.

## Latest results

Full matrix from 2026-07-20 (Codex on `gpt-5.5`, Claude Code on `claude-opus-4-8`): 6 scenarios x 3 tools x 2 agents, ten runs per cell (k=10), 360 graded runs, 359 passed.

**GitButler passed all 120 runs and was the clear efficiency winner: about 65% faster than plain `git` with 78% fewer version-control commands.** It averaged 34.0s versus 92.2s for Codex and 32.2s versus 98.4s for Claude. Jujutsu was slower than `git` overall for both agents and had the matrix's only grader failure: one Claude split-commit run preserved an extra commit.

The sixth scenario is materially harder: update a dirty feature branch onto a moved `main`, resolve conflicts inside two commits, and preserve unrelated worktree changes. GitButler still passed 20/20 there. Claude's GitButler runs averaged 58.8s versus 51.8s for `git`, but used 9.2 commands versus 16.7; Codex's averaged 74.4s versus 110.6s and used 9.1 versus 16.9.

The task-clustered intervals are in the [full writeup](docs/results/full-k10-2026-07-20.md). GitButler's paired command-count reduction excludes zero for both agents; its Codex wall-time reduction also excludes zero, while Claude's wall interval remains wide across six tasks. This is evidence about these operations and agents, not a universal tool ranking.

Each cell shows pass rate, mean wall time, and mean version-control commands per run. **Bold** marks the fastest tool that passed every run of that scenario.

### Codex (gpt-5.5)

| Scenario | git | Jujutsu | GitButler |
| --- | --- | --- | --- |
| Selective commit | 10/10 · 61.3s · 17.8 cmds | 10/10 · 94.3s · 17.1 cmds | **10/10 · 20.7s · 2.0 cmds** |
| Multi-amend | 10/10 · 168.9s · 35.7 cmds | 10/10 · 124.2s · 22.4 cmds | **10/10 · 29.0s · 5.0 cmds** |
| Split commit | 10/10 · 117.6s · 30.0 cmds | 10/10 · 187.7s · 40.1 cmds | **10/10 · 35.8s · 6.0 cmds** |
| Reorder commits | 10/10 · 50.5s · 9.1 cmds | 10/10 · 53.1s · 9.9 cmds | **10/10 · 21.1s · 2.0 cmds** |
| Squash commits | 10/10 · 44.4s · 12.7 cmds | 10/10 · 51.9s · 10.0 cmds | **10/10 · 23.2s · 3.0 cmds** |
| Update dirty branch | 10/10 · 110.6s · 16.9 cmds | 10/10 · 148.0s · 26.2 cmds | **10/10 · 74.4s · 9.1 cmds** |
| **All scenarios** | 60/60 · 92.2s · 20.4 cmds | 60/60 · 109.9s · 21.0 cmds | **60/60 · 34.0s · 4.5 cmds** |

### Claude Code (claude-opus-4-8)

| Scenario | git | Jujutsu | GitButler |
| --- | --- | --- | --- |
| Selective commit | 10/10 · 39.4s · 11.6 cmds | 10/10 · 119.7s · 10.0 cmds | **10/10 · 20.3s · 2.0 cmds** |
| Multi-amend | 10/10 · 227.8s · 48.4 cmds | 10/10 · 277.9s · 19.6 cmds | **10/10 · 26.8s · 5.0 cmds** |
| Split commit | 10/10 · 194.9s · 32.5 cmds | 9/10 · 297.9s · 32.8 cmds | **10/10 · 42.6s · 6.2 cmds** |
| Reorder commits | 10/10 · 34.3s · 8.0 cmds | 10/10 · 53.4s · 4.4 cmds | **10/10 · 20.8s · 2.2 cmds** |
| Squash commits | 10/10 · 42.4s · 12.2 cmds | 10/10 · 42.9s · 7.4 cmds | **10/10 · 23.6s · 3.1 cmds** |
| Update dirty branch | **10/10 · 51.8s · 16.7 cmds** | 10/10 · 82.1s · 15.8 cmds | 10/10 · 58.8s · 9.2 cmds |
| **All scenarios** | 60/60 · 98.4s · 21.6 cmds | 59/60 · 145.7s · 15.0 cmds | **60/60 · 32.2s · 4.6 cmds** |

Both agents are run to check whether the tool effect holds across them; this is not a Claude-versus-Codex comparison.

More detail:

- Interactive results with per-scenario breakdowns and the failure ledger: [vcbench.dev](https://vcbench.dev/) (source in [web/](web/)).
- Checked-in results overview: [docs/results/README.md](docs/results/README.md).
- Latest full-matrix writeup: [docs/results/full-k10-2026-07-20.md](docs/results/full-k10-2026-07-20.md).

## Scenarios

Each scenario is a pre-built Git repository (a commit history plus uncommitted changes) and a plain-English instruction describing the intended result. No code is generated during a run; only the version-control operation is measured. For a friendlier walk-through with sketches, see [docs/scenarios.md](docs/scenarios.md).

```text
1. selective commit:   messy worktree -> [one clean validation commit] + leftovers
2. multi-amend:        dirty fixes -> old commit A, old commit C, old commit E
3. split commit:       [big mixed commit] -> [validation] [scoring] [docs]
4. reorder commits:    A B C D E F -> A D E B C F
5. squash commits:     A B C D E F G -> A [B+C] D [E+F+G]
6. update dirty branch: feature + moved main + 2 conflicting commits -> rebased branch, resolved, leftovers intact
```

| Task | What it tests | QA |
| --- | --- | --- |
| [`pilot-1-selective-validation`](tasks/pilot-1-selective-validation) | Create a new branch and commit only input-validation changes while leaving mixed same-file and cross-file leftovers uncommitted. | `npm run pilot:check` |
| [`pilot-2-multi-amend`](tasks/pilot-2-multi-amend) | Route dirty hunks into three different existing commits while preserving unrelated leftovers. | `npm run pilot2:check` |
| [`pilot-3-split-commit`](tasks/pilot-3-split-commit) | Replace one broad non-top commit with three semantic commits, keep later history above it, and expose leftovers as uncommitted. | `npm run pilot3:check` |
| [`pilot-4-reorder-commits`](tasks/pilot-4-reorder-commits) | Move an adjacent commit block earlier in a six-commit branch without changing commit contents. | `npm run pilot4:check` |
| [`pilot-5-squash-commits`](tasks/pilot-5-squash-commits) | Squash two adjacent commit groups in a seven-commit branch into two semantic commits while preserving final contents. | `npm run pilot5:check` |
| [`pilot-6-update-dirty-branch`](tasks/pilot-6-update-dirty-branch) | Rebase a dirty feature branch onto an advanced `main`, resolving conflicts inside two branch commits while carrying uncommitted work through untouched. | `npm run pilot6:check` |

## How it's scored

- **Identical task across tools.** Each task ships as one prepared fixture repo with one plain-English instruction. Harness policy identifies the allowed command wrappers for the selected arm, but the requested Git-visible outcome is unchanged.
- **Deterministic grader.** Correctness is checked by a hidden, scripted verifier that inspects the final Git state: commit boundaries, branch topology, and what stayed uncommitted. It is not an LLM judge and does not compare commands against a reference — two different command sequences pass if they produce the same history.
- **Timing boundary.** Fixture build, workspace prep, skill installation, and dirty-state application all happen before timing begins; the measured figures cover only the agent's work on the task.
- **Git write restriction.** In GitButler and Jujutsu runs, raw git write commands are blocked so the agent must use the tool under test. Git calls a tool makes internally count as tool-internal work, not agent commands.
- **k=10.** Every agent-tool-task cell ran ten times; reported numbers are means over those runs. Checked-in reports also carry Wilson 95% intervals on pass rates, paired per-scenario deltas with task-clustered CIs, and per-scenario pass^k ("passed all 10 runs").

Full method docs: [benchmark design](docs/benchmark-design.md), [scoring and validation](docs/scoring-and-validation.md), [fairness and anti-cheat](docs/fairness-and-anti-cheat.md), [results presentation](docs/results-presentation.md).

## What's here

- Six VC-only pilot tasks under [tasks/](tasks/), with a quick index at [tasks/README.md](tasks/README.md).
- Synthetic TypeScript fixtures generated by `scripts/create-pilot*-fixture.mjs`.
- Hidden oracle verifiers under `scripts/verify-pilot*.mjs`.
- Reference `git` and `but` solutions in each task directory.
- An agent runner for Codex, Claude, and Pool: `scripts/run-pilot-agent.mjs`.
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
npm run pilot6:check
```

Each check proves no-op and known-wrong states fail, then verifies the reference solutions.

### Agent trials

Run one task with Codex:

```bash
npm run pilot:agent -- --task pilot-3-split-commit --agent codex --arm git
npm run pilot:agent -- --task pilot-3-split-commit --agent codex --arm 'but+skill'
npm run pilot:agent -- --task pilot-3-split-commit --agent codex --arm 'jj+skill'
```

Run one task with Claude:

```bash
npm run pilot:agent -- --task pilot-5-squash-commits --agent claude --arm git
npm run pilot:agent -- --task pilot-5-squash-commits --agent claude --arm 'but+skill'
npm run pilot:agent -- --task pilot-5-squash-commits --agent claude --arm 'jj+skill'
```

Defaults are `--task pilot-1-selective-validation`, `--agent codex`, `--arm git`, Codex model `gpt-5.5`, Claude model `claude-opus-4-8`, and Pool model `poolside/laguna-s-2.1`. Use `--model <name>` to override a single run, or `--codex-model`, `--claude-model`, and `--pool-model` on the matrix runner. The runner records and verifies the concrete model observed in each Pool trajectory.

Claude auth gotcha: the runner copies the keychain OAuth token into an isolated config that cannot refresh itself. The keychain access token expires after roughly eight hours, and once it does every Claude run fails within seconds as `AGENT_RUNTIME_ERROR` with a 401 in `agent-output.json`. Run any plain `claude -p "ok"` outside the harness to refresh the keychain token, then rerun the affected cells. Before long batches (and periodically during overnight sessions), refresh proactively.

The supported arms are:

- `git`: plain Git is allowed for version-control writes; `but` and `jj` are blocked.
- `but+skill`: GitButler is prepared before the measured run, the GitButler skill is installed into `.codex/skills/gitbutler` and `.claude/skills/gitbutler`, local `AGENTS.md` / `CLAUDE.md` files are written, and raw Git write commands are blocked.
- `jj+skill`: the fixture repo is prepared with `jj git init --colocate`, the external `onevcat/skills@onevcat-jj` skill is fetched into the run directory and installed into the agent skill folders, local `AGENTS.md` / `CLAUDE.md` files are written, and raw Git writes plus GitButler are blocked.

Pre-run fixture setup, tool setup, applying task branches, skill installation, and dirty-state application are excluded from measured agent duration and command metrics.

### Full matrix

The matrix runner covers all six scenarios, both agents, and all three tool arms by default:

```bash
npm run matrix:run -- --dry-run true --k 1
npm run matrix:run -- --k 5 --batch-name full-k5
```

Use `--tasks`, `--agents`, or `--arms` with comma-separated values to run a subset. Plans, progress, aggregate data, and the generated report land under `tmp/pilot-runs/<batch-name>/`.

### Pool / Laguna S 2.1

Pool runs currently require macOS because the host boundary uses `sandbox-exec`. Install Node 20+, Git, Pool CLI, and Jujutsu. This path was developed against Pool CLI 1.0.14 and Jujutsu 0.42.0. Authenticate Pool in standalone mode, supplying the key through your shell or secret manager:

```bash
pool login --api-key "$POOLSIDE_API_KEY"
```

The harness reads the resulting standalone credential from `$HOME/.config/poolside/credentials.json`.

The full Pool-only k=3 suite is 54 runs: six tasks, three tool arms, and three repetitions. Use a fresh batch name:

```bash
npm run matrix:run -- \
  --agents pool \
  --k 3 \
  --pool-model poolside/laguna-s-2.1 \
  --pool-bin /absolute/path/to/pool \
  --jj-bin /absolute/path/to/jj \
  --gitbutler-root /absolute/path/to/gitbutler \
  --batch-name pool-laguna-s21-full-k3 \
  --pool-rate-limit-retries 6 \
  --pool-rate-limit-backoff-ms 60000 \
  --fail-on-failures true
```

`--pool-bin` and `--jj-bin` can be omitted when both commands are on `PATH`. The default path builds `but` from the GitButler checkout and reads its skill from `crates/but/skill`. To use an existing binary instead, replace `--gitbutler-root` with:

```bash
--build-but false --but-bin /absolute/path/to/but --skill-dir /absolute/path/to/gitbutler/crates/but/skill
```

Network access is needed for Pool and, unless `--jj-skill-dir` points at a local copy, the pinned Jujutsu skill download. A batch writes `batch-config.json` with its inputs and harness fingerprint; resuming with different inputs is rejected.

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

### Codex isolation

Codex trials use clean config by default: isolated per-run `CODEX_HOME`, auth material only, ignored user rules, ephemeral mode, and plugins disabled. That keeps user config and plugin noise out of timing and transcript measurements.

Useful debug knobs:

```bash
npm run pilot:agent -- --agent codex --arm git --codex-isolated-home false
npm run pilot:agent -- --agent codex --arm git --codex-disable-plugins false
npm run pilot:agent -- --agent codex --arm git --codex-clean-config false
```

### Claude isolation

Claude trials use a temporary config directory, load only project/local settings, disable user plugins, and ignore ambient MCP configuration. OAuth is passed through the process environment and the temporary config is deleted after the run; credentials are never written into retained benchmark artifacts. Pass `--claude-clean-config false` to opt out.

### Pool isolation

Pool trials use a per-run home, generated settings, a credential proxy, and a macOS sandbox. The model receives only a dummy credential; the real API key remains in the proxy process and is not written into retained artifacts. The runner pins Laguna through generated Pool settings because Pool CLI 1.0.14 rejects its advertised `-m` flag, then verifies the observed trajectory model before grading the run.

### Outputs

Run artifacts are written under `tmp/pilot-runs/` and ignored by Git. A run directory contains the sandbox workspace, `result.json`, the command trace, generated instruction files, and verifier output.

`npm run runs:export -- --batch <batch-name>` packages the publishable evidence for a batch — per-run agent transcripts, command traces, prompts, `result.json`, runner logs, and a final Git-state snapshot per run — into a tarball under `tmp/exports/` (the k=7 batch exports to ~2 MB). The export scans for credential-shaped strings and aborts if any are found. Batches referenced in public results should have their artifact bundle attached to a GitHub release so every reported number can be traced to raw evidence.
Claude runs also write the raw JSON CLI result to `agent-output.json`; `result.json` records the configured model alias and the concrete observed model from Claude's `modelUsage`.

Pool batches retain the evidence needed to diagnose harness or model failures:

- Batch-level: `batch-config.json`, `plan.tsv`, `progress.tsv`, `<run-id>.log`, `aggregate.json`, `manifest.tsv`, and `report.md`.
- Rate-limit retries: `retry-attempts/<run-id>/attempt-N/`, containing the complete failed run directory and `runner.log`.
- Per-run: `result.json`, `command-trace.tsv`, `pool-trajectory.ndjson`, `agent-stdout.txt`, `agent-stderr.txt`, `prompt.txt`, `pool-auth-proxy.log`, `pool-host-sandbox.sb`, and `workspace/`.
- Pool-native files: `pool-home/Library/Application Support/poolside/trajectories/*.ndjson` and `pool-home/Library/Application Support/poolside/logs/*.log`.

Start with `result.json`: `agent_output.output_error` can explain a failed Pool interaction even when the repository verifier itself passes.

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
