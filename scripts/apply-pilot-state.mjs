#!/usr/bin/env node
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { BASELINE_FILES, DIRTY_FILES, TARGET_ONLY_FILES } from "./lib/pilot1-content.mjs";

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

for (const relativePath of ["notes/debug-log.md"]) {
  if (state !== "dirty") {
    rmSync(path.join(repoDir, relativePath), { force: true });
  }
}

for (const [relativePath, content] of Object.entries(states[state])) {
  const fullPath = path.join(repoDir, relativePath);
  mkdirSync(path.dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, content, "utf8");
}
