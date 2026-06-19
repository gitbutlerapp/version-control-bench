# Pilot 1: Selective Validation Commit

This pilot starts from a tiny TypeScript repo on `main` with dirty changes already applied.

The agent must create a new branch and commit only the input validation work. The logging cleanup, config cleanup, and debug notes must remain uncommitted.

The dirty state mixes target and leftover work across multiple files, including separate hunks in `src/handler.ts`. This pilot is not meant to require splitting individual diff hunks.

The task is intentionally VC-only: all file changes exist before the agent starts.

## Local QA

From the repo root:

```bash
npm run pilot:check
```

This proves the no-op and known-wrong states fail while both reference solutions pass.

Run agent trials with:

```bash
npm run pilot:agent -- --agent codex --arm git
npm run pilot:agent -- --agent codex --arm 'but+skill'
```

The `but+skill` arm runs GitButler setup before the measured agent run: clean fixture, `but setup`, skill install, generated `AGENTS.md`/`CLAUDE.md` instructions, then dirty task state. The setup is not included in agent duration or command metrics, and `result.json` records the installed skill and instruction paths plus pre-run setup metadata.

The task prompt itself does not tell the agent which version-control tool to use. The selected arm controls that through generated repository instruction files.

Codex runs default to clean ephemeral config to reduce plugin/user-config noise. The runner uses an isolated per-run `CODEX_HOME`, copies only Codex auth material into it, and disables Codex plugins. Pass `--codex-clean-config false` to opt back into the normal user config.

Codex runs default to `gpt-5.5` explicitly. Pass `--model <name>` to override.

For source-built GitButler CLI:

```bash
npm run but:build
npm run pilot:agent -- --agent codex --arm 'but+skill' --but-bin /Users/kiril/src/gitbutler/target/release/but
```
