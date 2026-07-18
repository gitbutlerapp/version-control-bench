# Pilot 6: Update Dirty Branch Onto Moved Target

The `main` branch has advanced by two commits while the `notify-retry` branch was in progress with uncommitted work in the worktree. The agent must rebuild `notify-retry` on the new `main` tip with linear history, resolve conflicts inside both branch commits — the notification channels combine (either ordering accepted) and the branch's tuned retry limit wins — and carry the uncommitted work — a README edit and an untracked note — through the update untouched and uncommitted.

This is the first pilot to exercise conflicts and a moving target. Conflicts live only inside commits, one per commit in separate files, resolved bottom-up; the dirty worktree state never conflicts with the update, it just must not be lost or committed.

- Fixture: `npm run pilot6:fixture`
- Verifier: `npm run pilot6:verify -- --repo <dir>`
- QA checks: `npm run pilot6:check`

The upstream advance is parked on the hidden ref `refs/bench/upstream-main` at fixture time and applied by the dirty-state script after arm preparation, so GitButler and Jujutsu set up against the old `main` tip and then observe it move — the same order of events the git arm experiences.
