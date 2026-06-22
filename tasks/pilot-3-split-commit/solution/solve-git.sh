#!/usr/bin/env bash
set -euo pipefail

BENCH_ROOT="${BENCH_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}"

node "$BENCH_ROOT/scripts/rewrite-pilot3-split-history.mjs" --repo "$PWD"
