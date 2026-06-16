# Scoring And Validation

## Principle

Grade the final repository state. Do not grade the path.

For version-control tasks, the output is not a patch string. The output is a repository state:

- refs
- commit DAG
- commit boundaries
- tree contents
- index
- worktree
- local remote refs
- conflict state
- metadata

## Primary Score

Use a strict binary pass/fail gate:

- final content is correct
- requested history shape is correct
- expected refs point to expected semantic commits
- protected refs are unchanged
- index/worktree state matches the instruction
- no unresolved conflicts unless requested
- no protocol violation

This is the score to headline.

## Diagnostic Score

Also compute a 100-point diagnostic score. Do not let it replace pass/fail.

Suggested weights:

- 20: final filesystem/tree state
- 30: semantic commit partitioning
- 25: history graph, refs, and stack topology
- 10: index/worktree/untracked state
- 5: commit messages and metadata
- 10: safety and protocol cleanliness

Suggested caps:

- protocol violation: 0
- protected history damage: cap 30
- final content wrong: cap 55
- content right but graph wrong: cap 70
- only dirty-state mismatch: cap 90

The diagnostic score helps sort failures. The pass/fail result stays crisp.

## Git Plumbing Inputs

Prefer plumbing and stable porcelain:

```bash
git rev-list --parents --topo-order
git for-each-ref --format=...
git cat-file -p
git diff-tree --root -m --name-status
git diff --cached
git diff
git merge-base
git ls-tree -r
git status --porcelain=v2 --branch
git ls-files -u
git fsck
git patch-id --stable
```

`patch-id` is useful but insufficient. It can miss wrong partitioning, duplicated changes, adjacent hunk mistakes, whitespace-sensitive changes, and metadata issues.

## Semantic Commit Matching

Never match expected commits by SHA. Rebases, amends, GitButler operations, timestamps, and authors all change hashes.

Match actual commits to expected semantic commits by edit atoms:

```text
expected semantic commit -> set of hidden edit atoms
actual commit            -> set of observed edit atoms
```

For each pair, compute a similarity score from precision and recall:

- recall: did the actual commit include the atoms expected for this semantic commit?
- precision: did it avoid atoms that belong elsewhere?

Then use maximum-weight bipartite matching between expected and actual commits.

This catches:

- two expected commits squashed accidentally
- one expected commit split accidentally
- a hunk amended into the wrong commit
- duplicated parent changes in a child branch
- correct total diff but wrong history

## Graph Validation

After matching actual commits to semantic labels, canonicalize the graph:

```text
main -> api-validation -> ui-copy -> docs-update
```

Validate:

- parent edges
- ancestor relationships
- branch heads
- absence of unexpected reachable commits
- no merge commits unless allowed
- no detached state when a branch head was requested
- protected refs unchanged

For stacked branches, validate two views:

- cumulative branch content: what the branch contains through ancestry
- branch-local introduced content: what commits on that branch introduce over its parent branch

The second view is crucial. A child branch should contain parent changes by ancestry, but it should not duplicate them in its own commits.

## Worktree And Index Validation

Many VC operations are about what remains uncommitted.

Validate:

- clean vs dirty worktree
- staged vs unstaged changes
- untracked files
- file mode changes
- unresolved conflicts
- requested leftovers preserved
- unrelated leftovers not touched

Use `git status --porcelain=v2`, `git diff`, `git diff --cached`, and `git ls-files -u`.

## Operation-Specific Invariants

Selective commit:

- committed atoms are reachable from the requested branch
- uncommitted atoms remain uncommitted
- unrelated edits stay untouched
- no extra commit accidentally captures leftovers

Amend into earlier commit:

- target semantic commit contains the new atom
- no fixup/temp commit remains
- descendants are still present and ordered correctly
- final combined diff is expected

Squash:

- requested commits become one semantic commit
- message requirements are satisfied
- no duplicate old commits remain reachable

Split:

- combined diff is preserved
- new commit boundaries match expected atom groups
- order is valid

Reorder:

- same semantic commits remain
- parent order changes as requested
- final content is still correct

Stacked branches:

- expected branch heads exist
- ancestry chain is correct
- each branch introduces only its assigned atoms
- parent branch changes are not duplicated in child-local commits

Conflict recovery:

- no unresolved index entries
- no conflict markers remain unless intentionally part of file content
- resolved content matches expected semantic result
- graph is still valid

## Failure Classes

Use explicit failure taxonomy:

- `ENV_FAILURE`: harness or tool setup broke
- `NO_OP`: agent did not meaningfully act
- `CONTENT_WRONG`: final files are wrong
- `PARTITION_WRONG`: total diff is right, commit grouping is wrong
- `GRAPH_WRONG`: order, parents, squash/split, or stack shape is wrong
- `REF_WRONG`: wrong branch heads, names, remote refs, or detached state
- `DIRTY_STATE_WRONG`: index/worktree/untracked state is wrong
- `METADATA_WRONG`: commit message/author requirements missed
- `PROTECTED_HISTORY_DAMAGE`: base branch or unrelated history was rewritten
- `PROTOCOL_VIOLATION`: forbidden tool, hidden oracle access, network, harness edits
- `TIMEOUT`: task did not finish

These classes matter more than a generic "failed" label when improving the benchmark or the tools.

## Statistical Reporting

Run repeated independent trials. Single-run agent results are too noisy.

Report:

- pass@1
- pass@k: at least one success in k trials
- pass^k: all k trials succeeded
- posterior mean `(successes + 1) / (trials + 2)` with Beta(1,1) prior
- credible intervals

For early development, `k=3` is fine for finding broken tasks and huge gaps. For public claims about tool superiority, use larger k and confidence intervals.

## Efficiency Metrics

Keep efficiency separate from correctness.

Track:

- wall-clock duration
- VC command count
- total shell/tool calls
- failed VC command count
- retry count
- VC output bytes
- agentic turns
- token usage if exposed by the agent runner
- cost if exposed by the provider

Within-agent comparisons are more meaningful than cross-agent comparisons because Codex and Claude Code may expose different token accounting and have different latency profiles.

## Measurement Hygiene

Separate what the benchmark asks the agent to do from harness and agent-platform noise.

Pre-run setup is excluded from measured duration and command metrics. For `but+skill`, this includes fixture creation, `but setup`, skill installation, and applying the dirty task state.

Timing runs should use a release-built `but` binary, not `target/debug/but`. Debug builds make GitButler command latency look worse for reasons unrelated to the version-control workflow being measured.

Codex runs should use an isolated per-run `CODEX_HOME` with only auth material copied from the user's Codex home, plus plugin loading disabled. This keeps global user plugins, skills, and warning spam out of both wall-time and transcript comparisons.

Runtime reporting should split:

- platform probes: agent CLI startup checks, plugin discovery, no-remote probes
- task-relevant VC commands: commands issued to solve the benchmark task
- tool-internal commands: for example Git commands spawned inside GitButler
- command timing: wrapper-level start, end, duration, summed runtime, and merged occupied runtime for task/platform/internal command buckets
- transcript bytes: prompt, stdout, stderr, platform warnings, skill/reference output, and a warm estimate that subtracts visible skill/reference reads
- failures: task/tool failures vs harmless environment probes

Keep legacy aggregate counters for continuity, but do not headline them when a cleaner split exists. Use task-relevant counters for comparisons like "how many VC commands did the agent need?" Use total transcript bytes for cold-start overhead and warm-estimated transcript bytes for the repeated-use case where the agent has already read the skill/reference material.

The warm transcript estimate is not a real token counter. It subtracts visible output from commands that read installed skill/reference files. Agent-internal instruction loading and hidden reasoning are outside the transcript unless the runner exposes them directly.

## Output Handling Burden

If both `git` and `but+skill` pass a task, the interesting question becomes: how much work did the agent have to do to turn tool output into the next correct action?

Track this as a first-class ergonomics metric:

- `vc_command_count`: all version-control commands
- `vc_inspection_count`: read-only VC commands like status, diff, show, log, branch listing
- `vc_mutation_count`: write operations like branch creation, commit, amend, squash, move
- `read_to_write_ratio`: inspections divided by mutations
- `parser_command_count`: `jq`, `python -c`, `node -e`, `sed`, `awk`, `grep`, `cut`, or similar commands used to extract data from VC output
- `repeated_state_queries`: repeated status/diff/show commands without intervening file or VC mutation
- `selector_failure_count`: wrong file IDs, wrong commit IDs, pathspec failures, invalid revision names, bad branch selectors
- `vc_output_bytes_before_first_mutation`: how much VC output the agent had to consume before it could act
- `time_to_first_successful_mutation_ms`: elapsed time from prompt start to first successful VC write
- `retry_after_parse_failure_count`: failed command followed by a corrected command using a different selector or parsed value

This is not just speed. It measures how hard the tool's output is for an agent to operationalize. A tool that succeeds in three clear commands is meaningfully better than one that succeeds after eight inspections, two parser scripts, and a selector retry.

Do not treat parser commands as inherently bad. Sometimes they are the right move. But a high parser burden is strong evidence that the tool output is not agent-friendly enough.

## LLM Judge

Use an LLM judge only for post-hoc diagnostics:

- discoverability
- error recovery
- output comprehension
- overuse or underuse of the intended tool
- transcript summary

Do not use an LLM judge for the primary score.
