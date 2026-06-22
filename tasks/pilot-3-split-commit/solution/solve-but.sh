#!/usr/bin/env bash
set -euo pipefail

BENCH_ROOT="${BENCH_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}"
BUT_BIN="${BUT_BIN:-but}"

if [[ "$(git branch --show-current)" != "gitbutler/workspace" ]]; then
  git switch main >/dev/null
  "$BUT_BIN" setup >/dev/null
  "$BUT_BIN" apply split-workflow >/dev/null
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

commit_snippets() {
  local message="$1"
  shift
  local ids=()
  while [[ "$#" -gt 0 ]]; do
    ids+=("$(hunk_id "$1" "$2")")
    shift 2
  done
  local changes
  changes="$(IFS=,; echo "${ids[*]}")"
  "$BUT_BIN" commit split-workflow -m "$message" --changes "$changes" >/dev/null
}

move_before_preserved_top() {
  local message="$1"
  local commit
  local preserved_top
  commit="$(commit_id "$message")"
  preserved_top="$(commit_id "add handler routing metadata")"
  "$BUT_BIN" move "$commit" "$preserved_top" >/dev/null
}

broad_commit="$(commit_id "add lead workflow")"
"$BUT_BIN" uncommit "$broad_commit" >/dev/null

commit_snippets "refactor validation helpers" \
  "src/lead.ts" "isLikelyEmail" \
  "tests/lead.test.ts" "testIsValidLeadRejectsMalformedEmail"
move_before_preserved_top "refactor validation helpers"

commit_snippets "tune lead scoring" \
  "src/lead.ts" "@enterprise.example" \
  "tests/lead.test.ts" "testScoreLeadRewardsEnterpriseDomain"
move_before_preserved_top "tune lead scoring"

commit_snippets "document lead workflow" \
  "README.md" "docs/lead-workflow.md" \
  "docs/lead-workflow.md" "Enterprise email domains"
move_before_preserved_top "document lead workflow"
