# Results Presentation

Benchmark reports should be boring, explicit, and hard to misread.

Correctness is the gate. Do not headline speed, token, or command-count wins unless pass rates are comparable for the same task, agent, and run batch.

## Report Shape

Use one Markdown report per run batch:

1. Headline: one short paragraph with the honest result.
2. Scope: task, agents, arms, model/config, run count, date, included run IDs.
3. Correctness table: pass count, pass@1 estimate, failure classes.
4. Efficiency table: wall time, task VC commands, task inspections/mutations, failed task commands, parser burden, transcript/token fields.
5. Pairwise deltas: compare each non-baseline arm against `git` within the same agent.
6. Notes: setup exclusions, cold/warm transcript caveats, any non-comparable fields.
7. Raw evidence: exact artifact directories and command used to generate the report.

Avoid averaging every `tmp/pilot-runs/*/result.json` file. That directory contains smoke tests, debugging runs, and superseded runs. A report must be generated from an explicit list of run directories or a checked-in manifest.

## Headline Metrics

For each `(task, agent, arm)` group, report:

- `n`: independent trials.
- `pass`: passed verifier count.
- `mean_wall_s` and `median_wall_s`: measured agent duration; pre-run setup excluded.
- `mean_task_vc_commands`: commands classified as task-relevant VC operations.
- `mean_task_inspections` and `mean_task_mutations`.
- `mean_failed_task_vc_commands`.
- `mean_parser_commands`.
- `mean_time_to_first_successful_task_mutation_s`.
- `mean_transcript_cold_kb`.
- `mean_transcript_warm_kb` when available.

For public claims, also add uncertainty intervals. For pilot work, 3-run means are fine for spotting large differences, not for making precise claims.

## What To Keep Out Of The Headline

Do not headline:

- total visible VC commands when a cleaner task/platform/tool-internal split exists
- GitButler internal Git commands as agent work
- setup time for `but setup`, skill install, fixture creation, or dirty-state application
- cross-agent transcript byte comparisons when adapters expose different transcript surfaces
- raw token/cost fields unless both adapters expose the same kind of accounting

These fields still belong in raw JSON and can be useful diagnostics.

## Recommended Tables

Primary table:

```text
agent   arm        n  pass  mean wall  median wall  task VC  inspect  mutate  failed task  parser  cold KB  warm KB
Codex   git        3  3/3   ...
Codex   but+skill  3  3/3   ...
Codex   jj+skill   3  3/3   ...
Claude  git        3  3/3   ...
Claude  but+skill  3  3/3   ...
Claude  jj+skill   3  3/3   ...
```

Delta table:

```text
agent   arm        wall delta  wall delta %  task VC delta  task VC delta %  transcript note
Codex   ...
Claude  ...
```

Run manifest:

```text
group                run ids
Codex git            ...
Codex but+skill      ...
Codex jj+skill       ...
Claude git           ...
Claude but+skill     ...
Claude jj+skill      ...
```

## Narrative Rules

Say what passed first. Then say whether the efficiency difference is large enough to matter.

Good:

> All four groups passed 3/3. On this pilot, `but+skill` used far fewer task VC commands and roughly half the wall time for both agents.

Bad:

> GitButler is faster.

That overclaims from one pilot and hides the fact that this is specifically `but+skill`, not naked `but`.

## Cold And Warm Transcript

Use cold transcript bytes to represent first-use overhead.

Use warm-estimated transcript bytes for the repeated-use case where the agent has already read visible skill/reference material. Label it as an estimate. It subtracts visible skill/reference reads, not hidden model-side instruction loading.

Claude text-mode transcript bytes are currently not comparable to Codex transcript bytes. Once Claude JSON mode is wired in, prefer real usage and cost fields over crude transcript size.
