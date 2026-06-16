#!/usr/bin/env bash
set -euo pipefail

BENCH_ROOT="${BENCH_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}"

git switch -c input-validation
node "$BENCH_ROOT/scripts/apply-pilot-state.mjs" target-only "$PWD"
git add README.md src/handler.ts tests/handler.test.ts
git commit -m "Add input validation"
node "$BENCH_ROOT/scripts/apply-pilot-state.mjs" dirty "$PWD"
