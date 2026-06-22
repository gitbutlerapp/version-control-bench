#!/usr/bin/env node
import path from "node:path";
import { syncFileState } from "./lib/fixture.mjs";
import {
  ALL_KNOWN_PATHS,
  AMENDED_COMMIT_STATES,
  DIRTY_FILES,
  MAIN_FILES,
  TARGET_FILES,
} from "./lib/pilot2-content.mjs";

const [state, repoDirArg = "."] = process.argv.slice(2);
const repoDir = path.resolve(repoDirArg);

const amendedState = AMENDED_COMMIT_STATES[AMENDED_COMMIT_STATES.length - 1].files;
const states = {
  main: MAIN_FILES,
  clean: amendedState,
  dirty: DIRTY_FILES,
  "target-only": TARGET_FILES,
};

if (!states[state]) {
  console.error("Usage: node scripts/apply-pilot2-state.mjs <main|clean|dirty|target-only> [repoDir]");
  process.exit(2);
}

syncFileState(repoDir, states[state], ALL_KNOWN_PATHS);
