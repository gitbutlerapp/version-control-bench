# Benchmark Design

## Goal

Answer this question cleanly:

> For common version-control operations, do coding agents complete the task more reliably, efficiently, and safely using plain `git`, GitButler CLI (`but`), or Jujutsu (`jj`)?

The tools are the main thing under test. Codex and Claude Code should both be run because a convincing claim needs to show whether the tool effect generalizes across agents.

## Non-Goals

- Do not design exact benchmark scenarios yet.
- Do not make this a GitButler API compliance suite.
- Do not make this a generic coding benchmark.
- Do not grade the agent's explanation.
- Do not grade exact command sequences, except for forbidden actions.

## Experimental Design

Use a crossed design:

```text
agent runner: Codex CLI, Claude Code
tool arm: git, but+skill, jj+skill, optional open
task: same task package and same natural-language user instruction
trial: repeated independent runs
```

Report tool effects as paired deltas within the same agent and task set:

```text
Codex:      arm_pass_rate - git_pass_rate
ClaudeCode: arm_pass_rate - git_pass_rate
Combined:  model-aware aggregate, not blind pooling
```

This avoids sloppy claims like "but is better" or "jj is better" when the real effect might be "Codex handles one tool better than Claude" or "Claude handles interactive rebase better than Codex."

## Tool Arms

### `git` Arm

- `git` is available.
- `but` and `jj` are absent from `PATH`.
- No GitButler or JJ skill or tool-specific agent instruction is installed.
- Agent instructions say version-control writes should use plain Git.

### `but` Arm

- `but` is compiled from `/Users/kiril/src/gitbutler` and added to `PATH`.
- The GitButler skill is installed from the same GitButler source revision.
- Repositories are placed in the required GitButler mode during harness setup when the task needs it.
- Agent instructions say version-control writes should use `but`.
- Read-only `git` inspection is allowed: `git status`, `git log`, `git diff`, `git show`, `git rev-parse`, `git for-each-ref`, etc.
- Raw `git` writes are protocol violations: `git commit`, `git add`, `git reset`, `git rebase`, `git cherry-pick`, `git merge`, `git branch -f`, `git update-ref`, etc.

This is the right compromise. A strict no-`git` arm is artificial because Git plumbing is the common substrate. Let agents inspect with Git, but require `but` for the operation being evaluated.

Name this arm honestly in reports as `but+skill`, not just `but`. The official skill is part of the product experience for agents, so it belongs in the primary comparison. Add a later `but-no-skill` ablation if we want to isolate CLI affordance from skill guidance.

### `jj+skill` Arm

- `jj` is installed and added to `PATH`.
- The repository is prepared as a colocated JJ/Git repository during harness setup.
- A public external JJ skill is installed into the agent skill directory.
- Agent instructions say version-control writes should use `jj`.
- Read-only `git` inspection is allowed.
- Raw `git` writes and GitButler writes are protocol violations.

Name this arm honestly in reports as `jj+skill`. The skill is part of the tested agent experience; do not report this as naked JJ.

### `open` Arm

Optional. Multiple tools are available and no write-tool restriction is imposed.

Use this to answer "which tool do agents naturally choose?" Do not mix it into the primary controlled comparison.

## Task Prompt Policy

The visible user instruction must be tool-agnostic:

- Good: "Put just the validation change into the earlier API commit and leave the logging tweak uncommitted."
- Bad: "Use `but amend` to amend the validation hunk into commit abc123."
- Bad: "Run `git rebase -i` and squash commits 2 and 3."

Arm-specific policy lives outside the task prompt in runner-provided agent instructions. This preserves a single task definition while still controlling the tool under test.

## Core Architecture

```text
task package
  -> fixture builder
  -> arm preparer
  -> agent adapter
  -> trace collector
  -> artifact exporter
  -> hidden verifier
  -> report aggregator
```

### Task Package

Each task declares:

- public instruction
- initial repository state
- operation family tags
- allowed final-state variants
- hidden oracle manifest
- reference solution
- verifier entrypoint

The agent sees the instruction and workspace only. It does not see the oracle, hidden tests, expected graph, or reference solution.

### Fixture Builder

Build initial state from scripts, not from precomputed solution commits that remain in `.git/objects`.

Use local bare remotes and bundles, not live GitHub clones. Network should not be needed during task execution.

### Arm Preparer

Transforms the same logical initial repo into the arm-specific environment:

- `git`: normal Git checkout.
- `but`: GitButler workspace mode, isolated GitButler config/data dirs, skill installed.

Harness setup cost should be recorded separately from agent task cost. Do not punish the agent for `but setup` unless a scenario explicitly measures adoption/setup.

After arm prep, the harness must snapshot the Git-visible baseline for every arm and compare it against the canonical starting state. Allowlist only expected GitButler workspace metadata and refs that are invisible to the task oracle. If branch heads, reachable commits, worktree files, index state, local remotes, or protected refs differ unexpectedly, mark the trial `ENV_FAILURE` before the agent runs.

### Agent Adapter

One adapter per runner:

- Codex CLI
- Claude Code

Adapters should normalize:

- prompt/session handling
- timeout behavior
- transcript location
- token usage if exposed
- command/tool traces
- final answer text

If an adapter cannot report token usage reliably, record `unknown`, not `0`.

### Trace Collector

The trace is diagnostic and policy-enforcing, not the primary scorer.

Capture:

- shell commands
- tool calls
- stdout/stderr byte sizes
- exit codes
- duration
- per-turn grouping
- VC command classification
- errors and retries

### Artifact Exporter

After the agent stops, export a bounded final-state artifact:

- `git bundle` or tarred `.git` plus worktree
- refs
- commit graph
- branch heads
- local remote refs
- `git status --porcelain=v2`
- `git diff` and `git diff --cached`
- conflict markers / unmerged index entries
- command trace metadata

The verifier should grade artifacts or a copied final repo, not rely on the agent workspace still being live.

### Hidden Verifier

Use deterministic scripts and Git plumbing. LLM judges can summarize failures later, but must not decide pass/fail.

## Task Families To Support Later

These are families, not scenario designs:

- commit all relevant work
- selective file commit
- selective hunk / partial-file commit
- leave unrelated work uncommitted
- amend new changes into an earlier commit
- amend several changes into several commits
- reorder commits
- squash commits
- split a commit into semantic commits
- create a branch on top of existing work
- create and maintain stacked branches
- route later changes into lower or upper stack branches
- recover from conflicts or failed history edits
- preserve user/other-agent work while editing local history

Every family should be expressible as final Git-state invariants.

## Task Difficulty Tags

Keep the old `but-bench` `hops x width` idea, but make it tool-neutral:

- `hops`: number of dependent VC steps required.
- `width`: number of independent branches/change streams.
- `scope`: file, hunk, commit, branch, stack, remote.
- `dirty_state`: clean, dirty worktree, staged changes, untracked files, conflicted index.
- `history_shape`: linear, split, squash, reorder, stack, merge.
- `ambiguity`: explicit, realistic terse, multi-turn.

These tags help compare like with like and diagnose where one tool wins.

## Reporting

Primary:

- pass@1 by task, family, agent, and tool arm
- posterior mean and credible interval for success probability
- pass@k and pass^k when repeated trials are run

Secondary:

- deterministic subscores
- wall-clock time
- VC command count
- total shell/tool calls
- output handling burden: parser commands, read/write ratio, repeated state queries, selector failures
- token usage when available
- cost when available
- VC output bytes
- error count and recovery success
- timeout and infra-failure rates

Do not rank tools by speed unless correctness is comparable. A fast wrong history edit is not impressive; it is just fast damage.
