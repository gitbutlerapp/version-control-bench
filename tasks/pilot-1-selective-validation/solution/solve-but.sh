#!/usr/bin/env bash
set -euo pipefail

BENCH_ROOT="${BENCH_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}"
BUT_BIN="${BUT_BIN:-but}"

if [[ "$(git branch --show-current)" != "gitbutler/workspace" ]]; then
  node "$BENCH_ROOT/scripts/apply-pilot-state.mjs" baseline "$PWD"
  "$BUT_BIN" setup
  node "$BENCH_ROOT/scripts/apply-pilot-state.mjs" dirty "$PWD"
fi

"$BUT_BIN" branch new input-validation
node "$BENCH_ROOT/scripts/apply-pilot-state.mjs" target-only "$PWD"

STATUS="$("$BUT_BIN" status -fv)"
README_ID="$(printf '%s\n' "$STATUS" | awk '$4 == "README.md" { print $2; exit }')"
HANDLER_ID="$(printf '%s\n' "$STATUS" | awk '$4 == "src/handler.ts" { print $2; exit }')"
TEST_ID="$(printf '%s\n' "$STATUS" | awk '$4 == "tests/handler.test.ts" { print $2; exit }')"

if [[ -z "$README_ID" || -z "$HANDLER_ID" || -z "$TEST_ID" ]]; then
  echo "Failed to locate all target change IDs from but status" >&2
  printf '%s\n' "$STATUS" >&2
  exit 1
fi

"$BUT_BIN" commit input-validation -m "Add input validation" --changes "$README_ID,$HANDLER_ID,$TEST_ID"
node "$BENCH_ROOT/scripts/apply-pilot-state.mjs" dirty "$PWD"
