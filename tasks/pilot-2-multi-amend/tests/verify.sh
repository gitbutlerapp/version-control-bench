#!/usr/bin/env bash
set -euo pipefail

BENCH_ROOT="${BENCH_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}"

node "$BENCH_ROOT/scripts/verify-pilot2.mjs" --repo "${1:-$PWD}" --task "$BENCH_ROOT/tasks/pilot-2-multi-amend"
