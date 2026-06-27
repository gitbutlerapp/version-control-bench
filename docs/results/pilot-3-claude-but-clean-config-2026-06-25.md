# Pilot 3 Claude `but+skill` Config-Isolation Rerun

> Current results: this per-pilot rerun is historical context. The latest k=5 full-matrix test run is displayed in [full-k5-2026-06-27.md](full-k5-2026-06-27.md).

Date: 2026-06-25

Task: `pilot-3-split-commit`

Scope: Claude via `claude -p`, `but+skill`, `k=3`, latest local GitButler binary and skill from `/Users/kiril/src/gitbutler`.

Binary: `/Users/kiril/src/gitbutler/target/release/but` (`shasum ecb7cc8bd206b1780d0479f3d550ccc45317e274`)

Skill: `/Users/kiril/src/gitbutler/crates/but/skill` (`shasum add54aaf652c72c53580181d8e6bbb4eb6c05771` for installed `SKILL.md`)

Batch: `tmp/pilot-runs/pilot3-claude-but-clean-medium-k3-20260625`

## Headline

The apparent Claude `but+skill` regression was not caused by the new GitButler binary or skill. The unisolated rerun used the same prompt and installed skill but inherited local Claude config; it passed 3/3 but slowed to 59.0s mean wall time. With the same latest binary and same latest skill, but with benchmark-owned Claude settings, the rerun passed 3/3 at 32.7s mean wall time.

The fix is to isolate Claude Code config for benchmark runs, matching the existing Codex config isolation. The runner now writes a per-run Claude settings file, disables local plugins, pins `effortLevel` to `medium`, and launches Claude with `--settings <file> --strict-mcp-config`.

This is not test cheating: the task prompt, verifier, fixture, command wrappers, binary, and installed skill are unchanged. Platform-level Git probes are still traced and counted separately. The change only removes machine-local Claude settings from the agent-under-test.

## Scorecard

Setup work is excluded from measured agent duration and command metrics: fixture creation, `but setup`, applying `split-workflow`, skill installation, local agent instruction files, and dirty-state application.

| Batch | n | Pass | Mean Wall | Median Wall | Max Wall | Task VC Cmds | Inspect | Mutate | Failed Task VC | Platform VC Cmds | Task `but` Runtime | Platform Runtime | Warm Transcript |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 2026-06-22 full matrix | 3 | 3/3 | 34.5s | 36.2s | 38.7s | 3.0 | 1.0 | 2.0 | 0.0 | n/a | n/a | n/a | 1.7 KB |
| 2026-06-25 latest skill/binary, unisolated Claude config | 3 | 3/3 | 59.0s | 64.2s | 65.5s | 4.0 | 2.0 | 2.0 | 0.0 | 28.3 | 0.64s | 1.02s | 1.4 KB |
| 2026-06-25 latest skill/binary, clean Claude config | 3 | 3/3 | 32.7s | 32.4s | 33.3s | 3.0 | 1.0 | 2.0 | 0.0 | 19.0 | 0.59s | 0.73s | 1.9 KB |

## Evidence

- The prompt for the unisolated latest rerun and the clean rerun is byte-identical.
- The installed Claude skill is byte-identical in both reruns: `add54aaf652c72c53580181d8e6bbb4eb6c05771`.
- The latest reruns used the same binary path, `/Users/kiril/src/gitbutler/target/release/but`.
- Observed task `but` runtime stayed sub-second in both batches, so wall time was not a GitButler CLI runtime regression.
- Claude did not read the installed skill during the clean rerun (`skill_reference_output_bytes = 0`), so the clean result is not from extra skill text steering the task.

The local Claude settings that leaked into the unisolated harness included enabled plugins and `"effortLevel": "high"`. A single old-skill control did not restore baseline behavior, which further points away from the GitButler skill as the cause.

## Command Shape

The clean rerun used the expected direct split-commit shape in all three runs:

```bash
but status -fv
but uncommit <broad-commit> --diff
but commit batch split-workflow --before <top-commit> \
  -m "refactor validation helpers" --changes <ids> \
  -m "tune lead scoring" --changes <ids> \
  -m "document lead workflow" --changes <ids>
```

One run used compact `but status` instead of `but status -fv`; it still passed with the same mutation shape.

## Included Runs

| Group | Run IDs |
| --- | --- |
| Claude `but+skill`, latest skill/binary, unisolated config | `pilot3-claude-but-latest-k3-1`, `pilot3-claude-but-latest-k3-2`, `pilot3-claude-but-latest-k3-3` |
| Claude `but+skill`, latest skill/binary, clean config | `pilot3-claude-but-clean-medium-k3-1`, `pilot3-claude-but-clean-medium-k3-2`, `pilot3-claude-but-clean-medium-k3-3` |

Raw artifacts live under `tmp/pilot-runs/` and are intentionally not checked in.

Command shape:

```bash
node scripts/run-pilot-agent.mjs --task pilot-3-split-commit --agent claude --arm 'but+skill' --but-bin /Users/kiril/src/gitbutler/target/release/but --skill-dir /Users/kiril/src/gitbutler/crates/but/skill
```
