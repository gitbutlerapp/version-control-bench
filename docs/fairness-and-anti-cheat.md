# Fairness And Anti-Cheat

## Fairness Principle

The task is identical. The tool policy differs.

That means:

- same public instruction
- same logical initial repo state
- same time limit
- same agent runner settings
- same hidden verifier
- same scoring
- different tool availability and agent policy per arm

Do not compare a tool-specific task against a generic Git task. If the primary tools cannot reasonably solve the task, it does not belong in the main comparison.

After arm setup, run a pre-agent equivalence check. The Git-visible starting state must match across arms for:

- protected refs and branch heads
- reachable commit graph for task-relevant refs
- worktree file contents
- index state
- local remote refs
- configured remotes used by the task

GitButler-specific metadata may differ, but those differences need an explicit allowlist. Any unallowlisted difference is an `ENV_FAILURE`, not an agent failure.

JJ-specific metadata may also differ in the `jj+skill` arm. The Git-visible starting state still needs to match the other arms.

## Tool Policy Enforcement

Use trace inspection and, ideally, command wrappers.

Allowed in `but` arm:

- `but` reads and writes
- read-only `git` commands for inspection
- normal file edits and test commands

Forbidden in `but` arm:

- raw `git` writes
- direct `git update-ref`
- direct edits to `.git` or GitButler internal state
- hidden oracle/test access
- network lookup for solutions

Allowed in `git` arm:

- normal `git` reads and writes

Forbidden in `git` arm:

- `but`
- `jj`
- GitButler skill use
- JJ skill use
- direct hidden oracle/test access
- network lookup for solutions

Allowed in `jj+skill` arm:

- `jj` reads and writes
- read-only `git` commands for inspection
- normal file edits and test commands

Forbidden in `jj+skill` arm:

- raw `git` writes
- `but`
- direct `git update-ref`
- direct edits to `.git`, `.jj`, hooks, or config unless the task explicitly allows them
- hidden oracle/test access
- network lookup for solutions

### Enforcement Boundary

Use wrapper binaries ahead of real `git`, `but`, and `jj` in `PATH`, plus trace inspection.

The wrapper should classify top-level commands, log argv/env/cwd, and enforce policy for direct agent shell commands. It should not classify subprocesses launched by `but` as agent protocol violations; otherwise the benchmark would punish GitButler for using Git internally. The practical boundary is:

- direct `git ...` command typed by the agent: classified and enforced
- direct `but ...` command typed by the agent: classified and enforced
- direct `jj ...` command typed by the agent: classified and enforced
- `git` subprocess spawned inside the `but` binary: allowed and logged as internal if observable
- `git` subprocess spawned inside the `jj` binary: allowed and logged as internal if observable
- shell aliases/functions: disabled by clean shell config; if used, wrapper still sees the resolved executable when possible
- scripts created or invoked by the agent: scan contents and trace subprocesses; forbidden VC writes inside scripts are still protocol violations
- direct edits under `.git/`, GitButler data dirs, hooks, or config: protocol violations unless the task explicitly allows them

Do not rely only on shell history. It misses scripts, aliases, and non-interactive subprocesses.

## Environment Isolation

For serious runs, use containers or VMs.

Minimum isolation:

- fresh workspace per trial
- fresh `$HOME` per trial
- isolated Git config: `GIT_CONFIG_GLOBAL`, `GIT_CONFIG_NOSYSTEM=1`
- fixed author and committer
- fixed timezone and locale
- signing disabled
- editor disabled or set to noninteractive
- hooks disabled unless part of task
- network disabled inside the task environment
- no shared GitButler app data
- no global agent skills except the one under test

The old `but-bench` local runner is useful for iteration, but it is too host-dependent for a benchmark claim.

## GitButler-Specific Fairness

`but` may require workspace setup. Treat that as harness prep for the `but+skill` arm, not as agent work, unless the scenario explicitly tests setup.

The primary GitButler comparison is `git` vs `but+official skill`, because agent-facing tool documentation is part of the GitButler product surface. For JJ, label the arm as `jj+skill` for the same reason. If we want to separate a binary from skill guidance, run a no-skill ablation and label it clearly.

Record:

- GitButler source commit
- `but` binary version
- skill source commit
- skill install mode
- workspace setup mode
- GitButler data/config paths

Ignore GitButler internal refs and metadata in the main score unless the task explicitly tests GitButler-native state. The main oracle should be Git-visible final state.

## Fixture Hygiene

Do not leave the solution in the object database.

Bad pattern:

```text
create solution commits -> reset back -> run agent
```

Agents can inspect unreachable objects, reflogs, stash, tags, notes, or hidden refs.

Required cleanup:

```bash
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git fsck --unreachable
git show-ref
git stash list
git notes list
```

Better pattern: generate the starting state directly from scripts and keep oracle/solution data outside the agent workspace.

## Hidden Verifier Hygiene

The agent must not see:

- oracle manifests
- edit atom files
- reference solutions
- hidden verifier scripts
- expected refs/commit labels
- score feedback during the run

Public smoke tests should verify the task harness works, not reveal how to solve the task.

## Network Policy

Default task network should be `none`.

Reasons:

- prevents looking up benchmark tasks
- prevents fetching future commits
- prevents relying on live GitHub state
- improves reproducibility

If an agent CLI needs network for model API access, run the model client outside the sandbox and expose only controlled terminal/file tools into the sandbox.

## Contamination Controls

Use three task sets:

- `dev`: visible, used while building harness and tasks
- `public`: visible regression suite
- `private`: held-out claim suite

Rotate or mutate private tasks when benchmark leakage becomes plausible.

For public writeups, publish:

- task IDs
- categories
- aggregate results
- selected sanitized traces

Avoid publishing full private prompts, hidden oracle files, or full trajectories if leaderboard integrity matters.

## Agent Instruction Hygiene

Keep three instruction layers separate:

1. Global benchmark policy: safety, no network, no hidden files.
2. Tool-arm policy: use `git` or use `but` for VC writes.
3. Task instruction: user intent.

Do not bake tool names into the task instruction.

For GitButler, the official docs distinguish the skill from optional behavior instructions: the skill teaches the agent how to use `but`; project instructions tell it what behavior is desired. Preserve that separation in the benchmark.

## Protocol Violations

Protocol violations should fail the task regardless of final repo state.

Examples:

- using raw `git commit` in the `but` arm
- using `but` in the `git` arm
- editing hidden verifier files
- reading `oracle/`
- modifying `.git/config` to hide actions
- adding aliases/hooks that fake validation
- fetching from the internet
- force-updating protected refs

The benchmark should reward correct version-control work, not clever ways to slip around the harness.

## Human QA Checklist

Before accepting a task:

- oracle solution passes
- no-op baseline fails
- common wrong solutions fail
- both `git` and `but` arms are solvable when task is in the comparison suite
- hidden verifier accepts all intended valid final states
- hidden verifier rejects known invalid states
- no future solution objects are present
- task prompt is realistic and tool-agnostic
- time limit is reasonable
- task has a clear failure class when broken
- task has been run multiple times to check flakiness
