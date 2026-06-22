# Task Format

Use a task directory format inspired by Harbor/Terminal-Bench and DeepSWE, with a verifier specialized for Git state.

## Proposed Layout

```text
tasks/<task-id>/
  task.toml
  instruction.md
  environment/
    Dockerfile
    setup.sh
    seed-repo.bundle
    maybe-local-remote.bundle
  solution/
    solve-git.sh
    solve-but.sh
  oracle/
    oracle.json
    edit-atoms.json
  tests/
    verify.sh
    verifier/
  pre_artifacts.sh
  README.md
```

For public tasks, `oracle/`, `tests/`, and `solution/` should be held out from the agent environment. Public smoke tests can exist, but they must not encode the answer.

## `task.toml`

Minimum useful fields:

```toml
id = "vc-0001"
version = "0.1.0"
category = "selective-commit"
repo_seed = "seed-repo.bundle"
base_ref = "refs/heads/main"
time_limit_seconds = 900
network = "none"

[difficulty]
hops = 2
width = 1
scope = "hunk"
history_shape = "linear"
dirty_state = "dirty-worktree"

[tools]
supports_git = true
supports_but = true

[limits]
max_shell_commands = 200
max_output_bytes = 2000000
```

Do not put expected branch names, expected commit labels, or oracle snippets in `task.toml` unless they are intentionally public.

## `instruction.md`

This is the only task-specific prompt the agent should see.

Rules:

- Use realistic user language.
- Specify the desired outcome, not the tool.
- Include constraints a user would actually care about.
- Avoid exact implementation recipes.
- Avoid exact commit hashes unless a real user would identify a commit that way.

Good prompts can still be precise. Tool-agnostic does not mean vague.

## `environment/`

This prepares the initial workspace and any local remote.

Requirements:

- no network dependency during task execution
- deterministic author/committer identity
- deterministic branch default
- deterministic timezone and locale
- disabled commit signing
- disabled hooks unless hooks are part of the task
- isolated `$HOME`, Git config, and GitButler data dirs
- no future solution objects, reflogs, stash entries, notes, tags, or hidden refs

Use local bare remotes for push/fetch/pull tasks. Do not use real GitHub remotes in the benchmark path.

## `solution/`

Reference solutions are for task QA, not for grading by exact replay.

Each comparison task should eventually have:

- `solve-git.sh`
- `solve-but.sh`

Both must pass the same verifier. If a task has no reasonable `git` solution or no reasonable `but` solution, mark it out of scope for the main comparison and put it in a separate product-specific suite.

## `oracle/`

The oracle describes acceptable final states.

It should use semantic labels instead of commit SHAs:

```json
{
  "protected_refs": ["refs/heads/main"],
  "expected_refs": {
    "refs/heads/feature": "commit:api-validation"
  },
  "semantic_commits": {
    "api-validation": {
      "parents": ["main"],
      "atoms": ["edit-001", "edit-004"],
      "message_terms": ["validation", "api"]
    }
  },
  "expected_worktree": {
    "mode": "dirty",
    "contains_atoms": ["edit-002"],
    "does_not_contain_atoms": ["edit-001", "edit-004"]
  },
  "allow_merge_commits": false
}
```

The exact schema can evolve. The important part is that the oracle expresses final-state invariants, not command rituals.

## Edit Atoms

An edit atom is the smallest hidden unit of expected change the scorer can reason about.

Examples:

- file path plus old/new snippet
- added/removed file
- file mode change
- rename
- structured config key change
- AST node change when practical
- line-range fallback for plain text

Partial-file tasks need atoms. Without them, "selective commit" collapses into "commit file A but not file B", which is too easy and not representative.

## `tests/verify.sh`

The verifier should:

1. Load the final repo artifact.
2. Run protocol and safety checks.
3. Extract Git state with plumbing commands.
4. Match actual commits to semantic commits.
5. Validate graph, refs, trees, worktree/index, and metadata.
6. Emit a structured result.

Suggested result shape:

```json
{
  "passed": false,
  "failure_class": "PARTITION_WRONG",
  "score": 72,
  "checks": {
    "tree_correct": true,
    "partition_correct": false,
    "graph_correct": true,
    "worktree_correct": true,
    "protected_refs_unchanged": true
  },
  "notes": ["combined two semantic commits into one actual commit"]
}
```

## `pre_artifacts.sh`

Run after the agent, before verification.

It should export:

- final repo bundle or tarball
- refs
- commit graph with parents
- status porcelain v2
- unstaged and staged diffs
- local remote refs
- command trace pointer
- environment metadata

This mirrors the DeepSWE/Harbor idea of capturing the agent's work before running hidden verification.

## Static TypeScript vs Static Task Packages

Early development can use TypeScript scenario modules because they are fast to iterate on. The durable benchmark should move toward static task packages because they are easier to audit, share, version, hold out, and run under multiple harnesses.

My pick: start the new repo with the static package shape even if the first runner is small. It prevents inheriting too much `but-bench` GitButler-specific logic.

## Adding A Pilot

Current pilots still use script fixtures instead of full static packages. Keep new pilots close to this shape:

- Put public task text and oracle data under `tasks/<pilot-id>/`.
- Put deterministic file contents in `scripts/lib/<pilot>-content.mjs`.
- Use `scripts/lib/fixture.mjs` for repo setup, file-state syncing, and commit-state sequences.
- Use `scripts/lib/process.mjs` and `scripts/lib/verifier.mjs` for Git plumbing, JSON reads, patch text, path checks, and scoring helpers.
- Use `scripts/lib/checks.mjs` for verifier QA cases.
- Keep scenario-specific `classify()` and score weights in the verifier. Those are part of the scenario contract.
