# Version Control Bench Design

Last updated: 2026-06-16

This repo should benchmark how coding agents perform version-control operations when the tool under test is either plain `git` or the GitButler CLI (`but`).

The key design choice is simple: tasks must describe user intent in tool-agnostic language, while the harness supplies an arm-specific tool policy. The same task should run as:

- `git` arm: `git` is available for version-control reads and writes; `but` is unavailable.
- `but` arm: `but` is available for version-control writes; read-only `git` inspection is allowed; raw `git` writes are a protocol violation.
- Optional `open` arm: both tools are available and the agent chooses. Useful for adoption/discoverability, not the clean primary comparison.

Primary scoring should inspect the final Git-visible repository state: refs, DAG, commits, trees, index, worktree, conflict state, and local remotes. Do not score the command sequence except for protocol violations and diagnostics.

## Docs

- [benchmark-design.md](benchmark-design.md): requirements, comparison model, architecture, task lifecycle.
- [task-format.md](task-format.md): proposed task package format and fixture rules.
- [scoring-and-validation.md](scoring-and-validation.md): deterministic oracles, semantic edit atoms, metrics.
- [fairness-and-anti-cheat.md](fairness-and-anti-cheat.md): fair git-vs-but setup, isolation, leakage prevention.
- [results-presentation.md](results-presentation.md): how to present benchmark runs without hiding setup or cherry-picking.
- [research-notes.md](research-notes.md): external benchmark research and local `but-bench` findings.
- [implementation-plan.md](implementation-plan.md): phased plan for building the harness later.

## Results

- [results/full-k3-2026-06-22.md](results/full-k3-2026-06-22.md): full five-pilot k=3 matrix for Codex and Claude across `git` and `but+skill`.
- [results/pilot-1-current-batch.md](results/pilot-1-current-batch.md): selective commit pilot batch.
- [results/pilot-2-current-batch.md](results/pilot-2-current-batch.md): selective multi-amend pilot batch.

## Opinionated Recommendation

Use a Harbor/Terminal-Bench-shaped task package with a custom Git-state verifier.

`but-bench` has useful harness ideas: milestones/minefields, agent adapters, transcript parsing, VC call metrics, Bayesian reporting. Do not copy its GitButler-first assumptions. This benchmark needs a neutral runner with explicit `ToolArm` configuration and validators built from Git plumbing.
