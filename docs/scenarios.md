# Scenario Guide

These scenarios are version-control chores, not coding challenges. The code changes already exist; the agent has to make the Git history match what a human reviewer would expect.

Each pilot represents a common cleanup situation from real branch work.

## 1. Selective Validation Commit

Plain English: there is a messy pile of uncommitted work, and only one topic should become a commit.

Use case: you fixed input validation while also poking at logging, config, and notes. Now you want a clean branch with only the validation work committed.

What it tests: can the agent select the right changed files and hunks, create a new branch, and leave unrelated work alone?

```text
messy worktree
  validation + logging + config + notes
        |
        v
new branch: [validation commit]
left over:  logging, config, notes stay uncommitted
```

## 2. Selective Multi-Amend

Plain English: several new fixes are sitting uncommitted, and each one belongs inside a different old commit.

Use case: after review, you have three fixups that should be folded into the original commits instead of added as a new "misc fixes" commit.

What it tests: can the agent route dirty hunks into multiple existing commits while preserving unrelated leftovers?

```text
dirty fixes
  validation fix  -> old commit: refactor validation helpers
  scoring fix     -> old commit: add lead scoring
  docs fix        -> old commit: document response behavior

left over: debug/config/investigation work stays uncommitted
```

## 3. Split Broad Commit

Plain English: one old commit is doing too much, so it needs to be split into clean, reviewable commits.

Use case: you made a big "lead workflow" commit, then realized it mixes validation, scoring, docs, and stray debug work.

What it tests: can the agent rewrite a non-top commit into several ordered commits, keep the later commit on top, and turn the stray work back into uncommitted leftovers?

```text
before:
  main - [big mixed commit] - [later routing commit]

after:
  main - [validation] - [scoring] - [docs] - [later routing commit]

left over:
  debug/config/investigation work becomes uncommitted
```

## 4. Reorder Existing Commits

Plain English: the commits are all correct, but two related commits are in the wrong place.

Use case: the branch works, but the story is awkward. Moving retry and notification commits earlier makes the history read in the order the feature is built.

What it tests: can the agent reorder history without changing file contents, commit subjects, or leaving a dirty worktree?

```text
before:
  A config -> B customer -> C email -> D retry -> E sender -> F docs

after:
  A config -> D retry -> E sender -> B customer -> C email -> F docs
```

## 5. Squash Commit Groups

Plain English: the branch has noisy step-by-step commits that should be compressed into two meaningful commits.

Use case: you committed "extract helper", then "wire helper", then code/test/docs retry changes. Before review, you want the history to say what changed, not every tiny step you took.

What it tests: can the agent squash adjacent commit groups, keep unrelated commits separate, preserve final file contents, and leave the worktree clean?

```text
before:
  A token model -> B extract helpers -> C wire helpers -> D export
  -> E retry code -> F retry tests -> G retry docs

after:
  A token model -> [B+C parser pipeline] -> D export -> [E+F+G retry support]
```

## 6. Update Dirty Branch Onto Moved Target

Plain English: `main` moved on while you were working, and syncing up means resolving conflicts inside two of your commits — without losing the uncommitted work sitting in your worktree.

Use case: you branched off to add an sms notification channel and tune the retry budget, with uncommitted notes in progress. Meanwhile main gained a push channel on the same line your first commit changed, and bumped the retry limit on the same line your second commit changed.

What it tests: can the agent rebase onto the new target with linear history, resolve two committed conflicts in the right order (one combining both sides, one keeping the branch's value), and carry the dirty worktree state — a tracked edit and an untracked note — through the update untouched and uncommitted?

```text
before:
  main:         M - U1 - U2          (moved ahead)
  notify-retry: M - F1 - F2          (F1 conflicts with U1, F2 with U2)
  worktree:     dirty README edit + untracked note

after:
  main:         M - U1 - U2          (untouched)
  notify-retry: M - U1 - U2 - F1' - F2'
  worktree:     dirty edit survives uncommitted + untracked note intact
```

This is the first scenario with conflicts and a moving target, and the tools' conflict models genuinely differ: git needs a stash/rebase/pop dance with two mid-rebase conflict stops, Jujutsu materializes the conflicts in the commits, and GitButler carries the uncommitted work through `pull` and marks both commits conflicted for `resolve`, resolved bottom-up.
