#!/usr/bin/env node
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
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

for (const relativePath of ALL_KNOWN_PATHS) {
  if (!(relativePath in states[state]) || states[state][relativePath] === undefined) {
    rmSync(path.join(repoDir, relativePath), { force: true });
  }
}

for (const [relativePath, content] of Object.entries(states[state])) {
  if (content === undefined) continue;
  const fullPath = path.join(repoDir, relativePath);
  mkdirSync(path.dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, content, "utf8");
}
