# Pilot 5: Squash Commit Groups

## At a Glance

Plain English: the branch has noisy step-by-step commits that should be compressed into a smaller set of meaningful commits.

Real-world shape: helper extraction and retry support were committed in tiny pieces while building. Before review, the history should say what changed, not every intermediate step.

```text
before:
  A token model -> B extract helpers -> C wire helpers -> D export
  -> E retry code -> F retry tests -> G retry docs

after:
  A token model -> [B+C parser pipeline] -> D export -> [E+F+G retry support]
```

This pilot starts from a tiny TypeScript repo with a checked-out `squash-series` branch containing seven existing commits ahead of `main`.

The agent must squash two adjacent groups of commits into two semantic commits while preserving the unrelated commits, final file contents, and a clean worktree.

Initial branch order, oldest to newest:

1. `add parser token model`
2. `extract parser helpers`
3. `wire parser helpers`
4. `add export endpoint`
5. `add retry option`
6. `test retry option`
7. `document retry option`

Expected final branch order, oldest to newest:

1. `add parser token model`
2. `add parser pipeline`
3. `add export endpoint`
4. `add retry support`

The task gives the squash groups and replacement messages directly. It is testing whether the version-control tool helps the agent perform targeted history surgery without changing the final tree or leaving duplicate source commits behind.

## Local QA

```bash
npm run pilot5:check
```

To test with a local GitButler build:

```bash
npm run pilot5:check -- --but-bin /Users/kiril/src/gitbutler/target/release/but
```

## Agent Runs

```bash
npm run pilot:agent -- --task pilot-5-squash-commits --agent codex --arm git
npm run pilot:agent -- --task pilot-5-squash-commits --agent codex --arm 'but+skill'
```

For `but+skill`, harness setup checks out `main`, runs `but setup`, applies the existing `squash-series` branch, installs the GitButler skill and local agent instructions, and starts the agent from the existing seven-commit branch state. This setup is not included in agent duration or command metrics.
