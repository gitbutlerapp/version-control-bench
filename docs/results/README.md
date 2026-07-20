# Results Overview

Latest full matrix: [full-k10-2026-07-20.md](full-k10-2026-07-20.md).

The current six-scenario view is nearly reliability-saturated: 359 of 360 canonical runs passed. Plain `git` and GitButler each passed 120/120; Jujutsu passed 119/120 after one Claude split-commit graph miss. GitButler is still the clear efficiency winner, with roughly two-thirds lower mean wall time and about 78% fewer task-relevant version-control commands than `git` for both agents.

The batch uses Codex `gpt-5.5` with codex-cli 0.144.6 and Claude `claude-opus-4-8` with Claude Code 2.1.215. Each agent–tool–scenario cell ran ten times: 6 scenarios × 2 agents × 3 arms × k=10 = 360 canonical runs.

## Current Scorecard

| Agent | Arm | Pass | Mean wall | Median wall | P90 wall | Task VC commands | Tasks all-k |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Codex | `git` | 60/60 | 92.2s | 73.3s | 160.6s | 20.4 | 6/6 |
| Codex | `but+skill` | 60/60 | 34.0s | 26.2s | 69.3s | 4.5 | 6/6 |
| Codex | `jj+skill` | 60/60 | 109.9s | 105.9s | 191.6s | 21.0 | 6/6 |
| Claude | `git` | 60/60 | 98.4s | 49.3s | 222.5s | 21.6 | 6/6 |
| Claude | `but+skill` | 60/60 | 32.2s | 25.4s | 55.8s | 4.6 | 6/6 |
| Claude | `jj+skill` | 59/60 | 145.7s | 98.4s | 313.3s | 15.0 | 5/6 |

## Current Read

GitButler's mean wall time was 63.1% below `git` for Codex and 67.3% below it for Claude, while task VC commands were 77.8% and 78.6% lower. The paired task-level confidence intervals exclude zero for GitButler's command reduction with both agents and its Codex wall-time reduction. Claude's GitButler wall-time interval remains wide over six tasks.

Jujutsu was slower than `git` for both agents. Its Claude paired wall-time interval is entirely above zero; the Codex interval crosses zero. The one verifier miss was Claude Jujutsu on split commit: the files and semantic edits were right, but the graph retained one extra `add app configuration` commit.

The new update-dirty-branch scenario passed 60/60 across all arms. GitButler was faster than `git` for Codex (74.4s vs 110.6s) but slower for Claude (58.8s vs 51.8s), while using substantially fewer commands for both.

## Run Integrity

Fifteen infrastructure-failed attempts were excluded before the strict aggregate was formed: four HTTP 529 responses, five HTTP 500 responses, three HTTP 401 responses, and three interrupted runs. They affected 12 slots across all three arms. Every slot was rerun from a fresh isolated workspace and its canonical replacement passed. See the [full report](full-k10-2026-07-20.md#run-integrity-and-excluded-attempts) for the inclusion rule.

## GitButler Regression Read

There is no credible GitButler regression in this batch: 120/120 canonical runs passed, with zero failed actual `but` task commands. On the five tasks shared with the previous k=10 matrix, current mean wall time and command count were directionally lower overall for both agents. Codex split-commit and reorder means rose 4% and 8% respectively, without added commands or failures. The known Codex update-dirty-branch `config target` detour occurred in 0/10 runs.

These historical comparisons are directional, not controlled A/B measurements, because the GitButler binary, skill, and agent CLI builds differ. The per-task audit is in the [full report](full-k10-2026-07-20.md#gitbutler-regression-watch).

## Provenance

- Raw batch: `tmp/pilot-runs/full-k10-20260720-six-scenarios`
- Models: Codex `gpt-5.5` (codex-cli 0.144.6); Claude `claude-opus-4-8` (Claude Code 2.1.215)
- GitButler authoritative common base / `origin/master`: `66505acb5ef98299b1dc7ff9f9fd5c58b82d2871`
- GitButler binary SHA-256: `3f654efed91fa1b4a040cd0204989c5e9f5e7a21ec92a8b798e5d5e5e95580f6`
- GitButler source skill SHA-256: `c680cd1ce5f1064f54fbdb177ede321b924e31a242a76c2299ede22dbe776b40`
- GitButler installed skill SHA-256: `8acc12b42c2c8d6ea5062ea0cf6a58ab2b70d8fba828b50fe854aa4974e475ff`
- Jujutsu: `jj 0.42.0`; skill `onevcat/skills@onevcat-jj` at commit `4955f542`

The aggregate's raw GitButler `source_head` is stale virtual-workspace metadata; the full report records why the common base above is authoritative.

## Evidence

- Consolidated full report: [full-k10-2026-07-20.md](full-k10-2026-07-20.md)
- Previous full report: [full-k10-2026-07-06.md](full-k10-2026-07-06.md)
- Results archive: [archive.md](archive.md)
- Plain-English scenarios: [../scenarios.md](../scenarios.md)
- Aggregate JSON: `tmp/pilot-runs/full-k10-20260720-six-scenarios/aggregate.json`
- Manifest: `tmp/pilot-runs/full-k10-20260720-six-scenarios/manifest.tsv`
