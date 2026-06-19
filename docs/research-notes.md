# Research Notes

## Summary

The strongest external pattern is Harbor/Terminal-Bench: task instruction, isolated environment, hidden tests, oracle solution, outcome-based grading. Version-control operations fit that shape better than SWE-bench's patch-submission model because the final artifact is a Git state, not just a code diff.

The strongest local pattern is `but-bench`: milestones/minefields, agent adapters, trace extraction, per-turn VC metrics, Bayesian reporting. Reuse the concepts, not the GitButler-first assumptions.

## External Sources

### SWE-bench

Source: [SWE-bench harness docs](https://www.swebench.com/SWE-bench/reference/harness/)

Relevant ideas:

- Docker-based reproducible evaluation.
- Layered images: base, environment, instance.
- Apply agent output, run tests, generate reports.
- Separate setup, evaluation, and reporting.

What not to copy directly:

- SWE-bench expects a patch. This benchmark needs final Git graph and worktree validation.

### Terminal-Bench / Harbor

Sources:

- [Terminal-Bench repository](https://github.com/harbor-framework/terminal-bench)
- [Terminal-Bench paper](https://arxiv.org/html/2601.11868v1)
- [Terminal-Bench adapters docs](https://www.tbench.ai/docs/adapters)

Relevant ideas:

- A task is an English instruction, Docker image, tests, oracle solution, and time limit.
- Tests verify final container state, not the commands the agent typed.
- Tasks are reviewed for specificity, solvability, and integrity.
- Future commits must be removed from Git history to prevent cheating.
- The format is flexible enough for many terminal-based benchmarks.

This is the closest match for version-control tasks.

### DeepSWE

Source: [DeepSWE repository](https://github.com/datacurve-ai/deep-swe)

Relevant ideas:

- Uses Harbor task format.
- Task layout separates `task.toml`, `instruction.md`, `environment/`, `tests/`, `solution/`, and `pre_artifacts.sh`.
- Uses isolated environments and program-based verifiers.

This is a good concrete layout to imitate.

### Inspect AI

Sources:

- [Inspect AI overview](https://inspect.aisi.org.uk/)
- [Inspect sandboxing docs](https://inspect.aisi.org.uk/sandboxing.html)

Relevant ideas:

- Clean mental model: datasets, solvers/agents, tools, scorers, logs.
- Built-in support for agent evaluations and external agents.
- Docker sandboxing and structured logs.

Inspect may be useful later, but a custom runner is likely simpler at first because we need detailed Git artifact capture and Codex/Claude CLI integration.

### Realistic Agent Prompts

Source: [Saving SWE-Bench: A Benchmark Mutation Approach](https://arxiv.org/html/2510.08996v2)

Relevant idea:

- Formal issue descriptions do not match how developers ask chat-based coding agents for help.

Implication:

- Task prompts should sound like real user requests: concise, contextual, sometimes underspecified, but still objectively scorable.

### GitButler Docs

Sources:

- [GitButler AI agents getting started](https://docs.gitbutler.com/ai-agents/getting-started)
- [GitButler CLI overview](https://docs.gitbutler.com/cli-overview)
- [GitButler CLI cheat sheet](https://docs.gitbutler.com/cli/cheat)
- [GitButler commands overview](https://docs.gitbutler.com/commands/commands-overview)

Relevant ideas:

- GitButler provides a CLI and agent skill.
- GitButler currently needs workspace mode for its multi-branch model.
- The skill tells agents how to use `but`; repo instructions tell agents what behavior is desired.
- `but` covers setup, status, diff, branch, commit, stage, amend, squash, move, absorb, resolve, undo/oplog, push/pull/PR.

Implication:

- The benchmark should compile `but` and install the matching skill per run.
- The benchmark should keep skill behavior separate from task language.
- The benchmark should record `but` and skill revisions.

## Local Context: `/Users/kiril/tmp/coding-agent-benchmarks.md`

Key takeaways from the existing research note:

- There is no single official coding-agent benchmark standard.
- The practical standard is clean environment, hidden verifier, pinned dependencies, exact agent/model config, and published logs/results.
- Terminal-Bench or Harbor-style packaging is a better base than SWE-bench unless leaderboard comparability is the goal.

This matches the proposed design.

## Local Context: `/Users/kiril/src/but-bench`

Useful pieces:

- outcome-based validation
- milestones and minefields
- scenario setup hooks
- Claude Code and Codex provider abstraction
- transcript-to-trace extraction
- per-turn VC metrics
- output byte tracking
- VC error and retry metrics
- append-only history ledger
- generated markdown reports
- Bayesian posterior score for small k
- parallel session scheduler
- `hops x width` difficulty taxonomy

Pieces to avoid or replace:

- always running `but setup`
- validating through `but status`
- treating raw Git writes as globally forbidden
- installing GitButler-specific Codex/Claude instructions for all tasks
- using `cliId`, GitButler stacks, or `but` command names in generic task definitions
- scoring GitButler-specific flags like `--json` or `--status-after`
- using a GitButler-specific LLM judge prompt

The current `but-bench` is best understood as ACI usability testing for GitButler. This repo should be a neutral tool-comparison benchmark.

## Consolidated Lessons

1. Use outcome grading, not command grading.
2. Make task prompts tool-agnostic and realistic.
3. Keep tool-arm policy separate from task prompt.
4. Use hidden deterministic Git-state verifiers.
5. Require oracle solutions to pass and no-op solutions to fail.
6. Do not leave solution commits in object databases.
7. Record traces for diagnostics, not primary scoring.
8. Use repeated trials and uncertainty intervals.
9. Compare tools within each agent, then aggregate carefully.
10. Treat speed/tokens as secondary to correctness and safety.
11. Label the GitButler primary arm as `but+skill`; add `but-no-skill` only as an ablation.
12. Check pre-agent Git-visible state equivalence across arms.
13. Enforce tool policy with wrappers and trace review, with a clear boundary between agent-invoked commands and tool-internal subprocesses.
14. Measure output handling burden: parser commands, read/write ratio, repeated state queries, selector failures, output bytes before first mutation.
