#!/usr/bin/env bash
set -euo pipefail

BUT_BIN="${BUT_BIN:-but}"
BRANCH="reorder-series"

if [[ "$(git branch --show-current)" != "gitbutler/workspace" ]]; then
  git switch main >/dev/null
  "$BUT_BIN" setup >/dev/null
  "$BUT_BIN" apply "$BRANCH" >/dev/null
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
          if ((commit.message ?? "").trim() === subject) {
            process.stdout.write(commit.cliId);
            process.exit(0);
          }
        }
      }
    }
    process.exit(1);
  ' "$subject"
}

retry="$(commit_id "add retry policy")"
sender="$(commit_id "add notification sender")"
customer="$(commit_id "add customer model")"
"$BUT_BIN" move "$retry,$sender" "$customer" >/dev/null
