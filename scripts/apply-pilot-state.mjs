#!/usr/bin/env node
import path from "node:path";
import { syncFileState } from "./lib/fixture.mjs";
import { ALL_PATHS, BASELINE_FILES, DIRTY_FILES, TARGET_ONLY_FILES } from "./lib/pilot1-content.mjs";

const [state, repoDirArg = "."] = process.argv.slice(2);
const repoDir = path.resolve(repoDirArg);

const states = {
  baseline: BASELINE_FILES,
  dirty: DIRTY_FILES,
  "target-only": TARGET_ONLY_FILES,
};

if (!states[state]) {
  console.error("Usage: node scripts/apply-pilot-state.mjs <baseline|dirty|target-only> [repoDir]");
  process.exit(2);
}

syncFileState(repoDir, states[state], ALL_PATHS);
