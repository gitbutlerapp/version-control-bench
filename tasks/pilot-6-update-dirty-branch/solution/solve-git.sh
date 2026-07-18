#!/usr/bin/env bash
set -euo pipefail

BENCH_ROOT="${BENCH_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}"

git stash push --quiet

if ! git rebase main; then
  node "$BENCH_ROOT/scripts/apply-pilot6-state.mjs" resolved-notify "$PWD"
  git add src/notify.ts
  if ! GIT_EDITOR=true git rebase --continue; then
    node "$BENCH_ROOT/scripts/apply-pilot6-state.mjs" resolved-config "$PWD"
    git add src/config.ts
    GIT_EDITOR=true git rebase --continue
  fi
fi

git stash pop --quiet
