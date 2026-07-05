# Results Overview

Latest full matrix: [full-k8-2026-07-05.md](full-k8-2026-07-05.md).

Short answer on these frontier models: reliability no longer separates the tools — 239 of 240 runs passed — so the comparison is about speed and efficiency. GitButler is the fastest arm for both agents (roughly 60% below plain `git`) with far fewer version-control commands; Jujutsu is slower than plain `git` for both agents. The reliability gap this benchmark showed a generation earlier (Claude failing split-commit on `git` and `jj`) closed with the newer model, so harder scenarios are the priority.

The current view is one full 2026-07-05 batch: 240 planned runs across five scenarios, Codex and Claude, and three arms: `git`, `but+skill`, and `jj+skill`.

Models: Codex used `gpt-5.5` (codex-cli 0.141.0); Claude used `claude-opus-4-8` (Claude Code 2.1.198). Both configured and observed models are captured in the aggregate.

## Current Scorecard

Pass is over k=8 runs per cell; "tasks all-k" is the count of scenarios where every run passed (per-scenario pass^k).

| Agent | Arm | Pass | Mean wall | Median wall | P90 wall | Task VC commands | Tasks all-k |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Codex | `git` | 40/40 | 77.6s | 60.7s | 150.8s | 20.8 | 5/5 |
| Codex | `but+skill` | 40/40 | 27.7s | 27.7s | 40.3s | 3.7 | 5/5 |
| Codex | `jj+skill` | 39/40 | 116.2s | 103.4s | 184.9s | 20.9 | 4/5 |
| Claude | `git` | 40/40 | 108.6s | 64.0s | 228.4s | 23.2 | 5/5 |
| Claude | `but+skill` | 40/40 | 40.5s | 40.2s | 58.9s | 4.8 | 5/5 |
| Claude | `jj+skill` | 40/40 | 172.2s | 140.2s | 348.4s | 17.2 | 5/5 |

Per-scenario breakdowns, paired deltas, and confidence intervals are in the full writeup: [full-k8-2026-07-05.md](full-k8-2026-07-05.md).

## Current Read

On these frontier models reliability no longer separates the tools: 239 of 240 runs passed, and every arm cleared every scenario except one Codex `jj+skill` split-commit run. So the comparison is now about speed and efficiency.

GitButler is the fastest arm for both agents — 27.7s vs 77.6s for Codex, 40.5s vs 108.6s for Claude versus plain `git` — and uses a fraction of the version-control commands (Codex 3.7 vs 20.8). Jujutsu is slower than plain `git` for both agents. Plain `git` sits in the middle: reliable here, but slower and far more command-heavy than GitButler.

The blunt read: GitButler with the skill is the most efficient agent-facing workflow in this benchmark. It is no longer *more reliable* than the others on these five operations — the frontier models close that gap — so the honest current claim is about speed and command count, not correctness.

## Compared With Previous Current

Compared with [full-k7-2026-07-03.md](full-k7-2026-07-03.md) (`claude-opus-4-1-20250805`), the Claude reliability gap closed as the model improved to `claude-opus-4-8`. Overall pass rate moved from 193/210 (91.9%) to 239/240 (99.6%).

| Agent | Arm | Pass Change | Mean Wall Change | Read |
| --- | --- | --- | --- | --- |
| Codex | `git` | 35/35 -> 40/40 | 89.4s -> 77.6s | Clean both runs; a little faster. |
| Codex | `but+skill` | 35/35 -> 40/40 | 29.0s -> 27.7s | Still clean and still the fastest Codex arm. |
| Codex | `jj+skill` | 35/35 -> 39/40 | 119.0s -> 116.2s | One split-commit miss this run; still slower than `git`. |
| Claude | `git` | 28/35 -> 40/40 | 248.4s -> 108.6s | Split-commit recovered from 2/7 to 8/8; much faster. |
| Claude | `but+skill` | 35/35 -> 40/40 | 97.5s -> 40.5s | Still perfect and now markedly faster. |
| Claude | `jj+skill` | 25/35 -> 40/40 | 282.2s -> 172.2s | Reliability recovered to perfect; still the slowest arm. |

## Failure Read

One of 240 runs failed the verifier: a Codex `jj+skill` split-commit run (`CONTENT_WRONG`). Every other agent–tool cell passed all eight runs of all five scenarios. No agent-runtime errors or timeouts.

## Fair Shot Read

The JJ setup was fair for this benchmark shape:

- The `jj+skill` arm used `jj 0.42.0`.
- The fixture repo was prepared before timing with `jj git init --colocate`.
- The agent got an installed external JJ skill before timing.
- Raw Git writes and GitButler were blocked in the JJ arm.
- Setup, skill fetch/install, fixture creation, and dirty-state application were excluded from measured agent time.

The skill was `onevcat/skills@onevcat-jj`, pinned to upstream commit `4955f542` and verified by SHA-256; it was the top direct `jj` result from `npx skills find jj` on 2026-06-29.

## Provenance

Current full batch:

- Raw batch: `tmp/pilot-runs/full-k8-20260704`
- Models: Codex `gpt-5.5` (codex-cli 0.141.0); Claude `claude-opus-4-8` (Claude Code 2.1.198)
- Setup block SHA-256: `e68d505c5f060b89692c253e8dddb689fb42c5a61fc001bdce0a8dc383db76b2` for `but+skill`; `b440ab7d0e70159b81f573267df5c284bf387e006dbc7c8dee83cb897443c91f` for `jj+skill`
- GitButler binary SHA-256: `ff4ef22eddaa34bb753f1e6346f47907b551514cbb06a9dec1597f809e6840d4`
- GitButler skill file SHA-256: `a5e5ac057b64819a22471b9a31751943e6183a8d475047fa8667de21541a04de`
- GitButler source head: `17334e2eb8d2ad95192ec9bee43a39b8b2431393`
- `jj` binary SHA-256: `849c9ab4bbfd955b9d9fbe39c3a63b071e348e3978888b5289d3dccd99379680`
- `jj` version: `jj 0.42.0`
- JJ skill package: `onevcat/skills@onevcat-jj` (commit `4955f542`)
- JJ skill file SHA-256: `e0364004187a1769adc0b532befe346fd4b372bb1aab2768b9ebb694f2d13687`

## Evidence

- Consolidated full report: [full-k8-2026-07-05.md](full-k8-2026-07-05.md)
- Previous full report: [full-k7-2026-07-03.md](full-k7-2026-07-03.md)
- Results archive: [archive.md](archive.md)
- Plain-English scenarios: [../scenarios.md](../scenarios.md)
- Per-run artifact bundle: `npm run runs:export -- --batch full-k8-20260704`
- Aggregate JSON: `tmp/pilot-runs/full-k8-20260704/aggregate.json`
- Manifest: `tmp/pilot-runs/full-k8-20260704/manifest.tsv`
