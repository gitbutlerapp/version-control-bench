#!/usr/bin/env bash
set -euo pipefail

BENCH_ROOT="${BENCH_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}"

node "$BENCH_ROOT/scripts/verify-pilot4.mjs" --repo "$PWD" --task "$BENCH_ROOT/tasks/pilot-4-reorder-commits"
