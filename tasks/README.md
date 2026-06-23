# Pilot Tasks

These are the five version-control scenarios in the benchmark. They are all VC-only: the code changes already exist, and the agent is judged on the final Git state.

## Quick Map

1. [Selective Validation Commit](pilot-1-selective-validation/README.md): pick one useful topic out of a messy uncommitted worktree and commit only that on a new branch.
2. [Selective Multi-Amend](pilot-2-multi-amend/README.md): fold several uncommitted fixes into the older commits where they belong.
3. [Split Broad Commit](pilot-3-split-commit/README.md): break one overloaded non-top commit into clean semantic commits.
4. [Reorder Existing Commits](pilot-4-reorder-commits/README.md): move a related block of commits earlier without changing their contents.
5. [Squash Commit Groups](pilot-5-squash-commits/README.md): compress noisy step-by-step commits into fewer meaningful commits.

```text
1. selective commit:   messy worktree -> [one clean validation commit] + leftovers
2. multi-amend:        dirty fixes -> old commit A, old commit C, old commit E
3. split commit:       [big mixed commit] -> [validation] [scoring] [docs]
4. reorder commits:    A B C D E F -> A D E B C F
5. squash commits:     A B C D E F G -> A [B+C] D [E+F+G]
```

For the fuller plain-English guide, see [../docs/scenarios.md](../docs/scenarios.md).
