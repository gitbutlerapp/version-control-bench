#!/usr/bin/env bash
set -euo pipefail

BENCH_ROOT="${BENCH_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}"
BUT_BIN="${BUT_BIN:-but}"

if [[ "$(git branch --show-current)" != "gitbutler/workspace" ]]; then
  git switch main >/dev/null
  "$BUT_BIN" setup >/dev/null
  "$BUT_BIN" apply amend-series >/dev/null
  node "$BENCH_ROOT/scripts/apply-pilot2-state.mjs" dirty "$PWD"
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

hunk_id() {
  local file_path="$1"
  local snippet="$2"
  "$BUT_BIN" diff | node -e '
    const fs = require("node:fs");
    const filePath = process.argv[1];
    const snippet = process.argv[2];
    const lines = fs.readFileSync(0, "utf8").split(/\n/);
    const blocks = [];
    let current = null;
    for (const line of lines) {
      const match = line.match(/^([a-z0-9]+)\s+(.+?)│$/);
      if (match) {
        current = { id: match[1], path: match[2].trim(), body: "" };
        blocks.push(current);
        continue;
      }
      if (current) current.body += `${line}\n`;
    }
    const found = blocks.find((block) => block.path === filePath && block.body.includes(snippet));
    if (!found) process.exit(1);
    process.stdout.write(found.id);
  ' "$file_path" "$snippet"
}

amend_snippets() {
  local subject="$1"
  shift
  local cid
  local ids=()
  cid="$(commit_id "$subject")"
  while [[ "$#" -gt 0 ]]; do
    ids+=("$(hunk_id "$1" "$2")")
    shift 2
  done
  local changes
  changes="$(IFS=,; echo "${ids[*]}")"
  "$BUT_BIN" amend "$cid" --changes "$changes" >/dev/null
}

amend_snippets "refactor validation helpers" \
  "README.md" "likely email address" \
  "src/lead.ts" "isLikelyEmail" \
  "tests/lead.test.ts" "testIsValidLeadRejectsMalformedEmail"

amend_snippets "add lead scoring" \
  "src/lead.ts" "@enterprise.example" \
  "tests/lead.test.ts" "testScoreLeadRewardsEnterpriseDomain"

amend_snippets "document response behavior" \
  "README.md" "reason that can be shown" \
  "docs/response.md" "accepted: false"
