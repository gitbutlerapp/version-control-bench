#!/usr/bin/env node
import path from "node:path";
import { syncFileState } from "./lib/fixture.mjs";
import {
  ALL_KNOWN_PATHS,
  BROAD_FILES,
  DIRTY_FILES,
  EXPECTED_BRANCH_FILES,
  HANDLER_FILES,
  MAIN_FILES,
} from "./lib/pilot3-content.mjs";

const [state, repoDirArg = "."] = process.argv.slice(2);
const repoDir = path.resolve(repoDirArg);

const states = {
  main: MAIN_FILES,
  clean: HANDLER_FILES,
  broad: BROAD_FILES,
  dirty: DIRTY_FILES,
  "target-only": EXPECTED_BRANCH_FILES,
};

if (!states[state]) {
  console.error("Usage: node scripts/apply-pilot3-state.mjs <main|clean|broad|dirty|target-only> [repoDir]");
  process.exit(2);
}

syncFileState(repoDir, states[state], ALL_KNOWN_PATHS);
