# Implementation Plan

This is a plan for later. No code should be written until the design is accepted.

## Phase 0: Lock The Benchmark Contract

Decide and write down:

- supported tool arms: `git`, `but+skill`, optional `but-no-skill`, optional `open`
- allowed/forbidden commands per arm
- wrapper-based enforcement boundary
- pre-agent Git-visible equivalence checks
- artifact format
- verifier result schema
- task package layout
- report schema
- minimum isolation level for official runs

Deliverable:

- finalized docs
- one example empty task package with no real scenario

## Phase 1: Build The Minimal Runner

Build only the harness spine:

- discover tasks
- prepare isolated workspace
- apply `git` or `but` arm setup
- run Codex or Claude Code adapter
- collect trace
- export final Git artifact
- run verifier
- write JSONL results

Keep task logic out of the runner.

## Phase 2: Build The Git-State Verifier Library

Implement reusable verifier pieces:

- ref extraction
- commit graph extraction
- protected-ref checks
- dirty-state checks
- edit atom detection
- semantic commit matching
- stack/branch-local diff validation
- failure class assignment

This is the technical heart of the benchmark. Do it before making many tasks.

## Phase 3: Create A Tiny Pilot Suite

Create 3 to 5 pilot tasks covering different verifier needs, not the full benchmark:

- one simple commit task
- one partial-file/semantic partition task
- one history rewrite task
- one stacked-branch/topology task
- one dirty-worktree preservation task

The goal is to validate the harness and scorer, not to claim anything.

Quality gates:

- `solve-git.sh` passes
- `solve-but.sh` passes
- no-op fails
- intentionally wrong states fail with useful failure classes
- k=3 runs complete for both agents and both arms

For pilot reporting, collect enough quantitative signal to compare passing runs:

- total duration
- VC command count
- inspection vs mutation count
- parser command count
- repeated state queries
- selector failures
- VC output bytes
- transcript bytes or real token counts when available
- time to first successful mutation

## Phase 4: Calibrate Task Difficulty

Run pilots across:

- Codex + git
- Codex + but
- Claude Code + git
- Claude Code + but

Then inspect failures manually.

Adjust only task clarity and verifier correctness at this stage. Do not tune prompts to make one tool look better.

## Phase 5: Expand The Suite

Build toward 20 to 50 tasks.

Split into:

- easy regression tasks
- medium comparison tasks
- hard stress tasks
- private holdout tasks

Keep tags consistent so results can be sliced by operation family, graph shape, dirty state, and difficulty.

## Phase 6: Reporting And Claims

Before making tool-comparison claims:

- run enough trials for stable intervals
- report per-agent and combined results
- report task-family breakdowns
- separate infra failures from task failures
- include uncertainty intervals
- include representative sanitized traces
- publish exact `git`, `but`, skill, agent, model, and suite versions

Recommended headline table:

```text
agent       tool  pass@1  posterior  ci90      median_vc_calls  median_time  timeouts
Codex       git   ...
Codex       but   ...
ClaudeCode  git   ...
ClaudeCode  but   ...
```

Recommended secondary table:

```text
family              git_pass  but_pass  delta  dominant_failure_git  dominant_failure_but
selective-commit    ...
amend-history       ...
split-squash        ...
stacked-branch      ...
```

## Phase 7: Maintenance

Every task change should require:

- verifier review
- oracle solution rerun
- no-op rerun
- fixture leakage check
- version bump
- changelog entry

Every benchmark run should record:

- suite version
- task versions
- agent runner versions
- model IDs
- `git --version`
- `but` commit/version
- skill commit/version
- OS/container image digest
- run config

## First Engineering Choice

Start with a custom TypeScript runner only if speed of iteration matters more than portability. Otherwise start with the static task package format and a thin runner.

My pick: static package format plus a thin TypeScript runner. It keeps the benchmark portable without forcing us into a full external framework immediately.
