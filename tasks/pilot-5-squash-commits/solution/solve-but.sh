#!/usr/bin/env bash
set -euo pipefail

BUT_BIN="${BUT_BIN:-but}"
BRANCH="squash-series"

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
          const firstLine = String(commit.message ?? "").split(/\r?\n/, 1)[0].trim();
          if (firstLine === subject) {
            process.stdout.write(commit.cliId);
            process.exit(0);
          }
        }
      }
    }
    process.exit(1);
  ' "$subject"
}

helpers="$(commit_id "extract parser helpers")"
wire="$(commit_id "wire parser helpers")"
"$BUT_BIN" squash "$helpers" "$wire" -m "add parser pipeline" >/dev/null

retry_option="$(commit_id "add retry option")"
retry_test="$(commit_id "test retry option")"
retry_doc="$(commit_id "document retry option")"
"$BUT_BIN" squash "$retry_option" "$retry_test" "$retry_doc" -m "add retry support" >/dev/null
