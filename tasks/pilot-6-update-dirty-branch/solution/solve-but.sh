#!/usr/bin/env bash
set -euo pipefail

BENCH_ROOT="${BENCH_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}"
BUT_BIN="${BUT_BIN:-but}"

if [[ "$(git branch --show-current)" != "gitbutler/workspace" ]]; then
  git switch main >/dev/null
  "$BUT_BIN" setup >/dev/null
  "$BUT_BIN" apply notify-retry >/dev/null
  node "$BENCH_ROOT/scripts/apply-pilot6-state.mjs" dirty "$PWD"
fi

commit_id() {
  local subject="$1"
  "$BUT_BIN" status --format json | node -e '
    const fs = require("node:fs");
    const subject = process.argv[1];
    const status = JSON.parse(fs.readFileSync(0, "utf8"));
    for (const stack of status.stacks ?? []) {
      for (const branch of stack.branches ?? []) {
        for (const commit of branch.commits ?? []) {
          if ((commit.message ?? "").trim().split(/\n/)[0] === subject) {
            process.stdout.write(commit.cliId);
            process.exit(0);
          }
        }
      }
    }
    process.exit(1);
  ' "$subject"
}

# The dirty README edit does not conflict with the update, so pull carries it
# along; both branch commits come back conflicted. Resolve bottom-up: the
# oldest commit first, then the one above it.
"$BUT_BIN" pull >/dev/null

sms_id="$(commit_id "Add sms channel")"
"$BUT_BIN" resolve "$sms_id" >/dev/null
node "$BENCH_ROOT/scripts/apply-pilot6-state.mjs" resolved-notify "$PWD"
"$BUT_BIN" resolve finish >/dev/null

retry_id="$(commit_id "Tune retry budget")"
"$BUT_BIN" resolve "$retry_id" >/dev/null
node "$BENCH_ROOT/scripts/apply-pilot6-state.mjs" resolved-config "$PWD"
"$BUT_BIN" resolve finish >/dev/null
