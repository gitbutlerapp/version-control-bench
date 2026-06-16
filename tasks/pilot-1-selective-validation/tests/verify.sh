#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BENCH_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

node "$BENCH_ROOT/scripts/verify-pilot.mjs" --repo "${1:-$PWD}" --task "$BENCH_ROOT/tasks/pilot-1-selective-validation"
