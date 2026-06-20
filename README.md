# version-control-bench

Design notes for a benchmark comparing coding agents doing version-control operations with plain `git` versus GitButler CLI.

Start with [docs/README.md](docs/README.md).

## Pilot 1

The first vertical slice is `tasks/pilot-1-selective-validation`: a VC-only selective commit task in a tiny TypeScript repo.

The second pilot is `tasks/pilot-2-multi-amend`: a VC-only selective multi-amend task where dirty hunks must be routed into three different existing commits while leftovers remain uncommitted.

Run verifier QA:

```bash
npm run pilot:check
npm run pilot2:check
```

Run a real agent trial:

```bash
npm run pilot:agent -- --agent codex --arm git
npm run pilot:agent -- --agent codex --arm 'but+skill'
npm run pilot:agent -- --task pilot-2-multi-amend --agent codex --arm git
npm run pilot:agent -- --task pilot-2-multi-amend --agent codex --arm 'but+skill'
```

The `but+skill` arm prepares GitButler before the measured agent run: it creates a clean fixture, runs `but setup`, performs any task-specific pre-application such as applying the existing `amend-series` branch for pilot 2, installs the GitButler skill from `/Users/kiril/src/gitbutler/crates/but/skill` into the trial workspace under both `.codex/skills/but` and `.claude/skills/but`, writes local `AGENTS.md` and `CLAUDE.md` files with GitButler's optional baseline agent instructions, then applies the dirty task state. This setup happens before command wrappers, timing, and metrics start.

Build and use `but` from the local GitButler checkout:

```bash
npm run but:build
npm run pilot:check -- --but-bin /Users/kiril/src/gitbutler/target/release/but
npm run pilot:agent -- --agent codex --arm 'but+skill' --but-bin /Users/kiril/src/gitbutler/target/release/but
```

Use `--skill-dir <path>` to test a different GitButler skill directory.

Codex trials use a clean ephemeral config by default to reduce user-plugin noise. The runner also creates an isolated per-run `CODEX_HOME`, copies only Codex auth material into it, and disables Codex plugins for the measured agent run. Use `--codex-clean-config false` only when you intentionally want the user's normal Codex config in the run.

For debugging Codex environment isolation:

```bash
npm run pilot:agent -- --agent codex --arm git --codex-isolated-home false
npm run pilot:agent -- --agent codex --arm git --codex-disable-plugins false
```

Codex trials default to `gpt-5.5` explicitly. Use `--model <name>` to override.

Claude is wired through the same runner:

```bash
npm run pilot:agent -- --agent claude --arm git
```

Run artifacts are written under `tmp/pilot-runs/` and are ignored by git.

The task prompt is tool-agnostic. The arm-specific version-control policy lives in generated pre-run instruction files, not in the prompt itself. The legacy `metrics` block keeps coarse counters such as `vc_command_count`. The cleaner `measurement` block splits platform probes, task-relevant commands, GitButler internal Git calls, cold and warm-estimated transcript bytes, warning bytes, skill/reference output bytes, and millisecond-level command timing.

Current result summaries live under `docs/results/`.
