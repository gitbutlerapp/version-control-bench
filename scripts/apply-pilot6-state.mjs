#!/usr/bin/env node
import path from "node:path";
import { syncFileState } from "./lib/fixture.mjs";
import { git, gitText, run } from "./lib/process.mjs";
import {
  ALL_KNOWN_PATHS,
  BASE_FILES,
  DIRTY_FILES,
  FEATURE2_FILES,
  NOTIFY_COMBINED_VARIANTS,
  UPSTREAM_HOLD_REF,
} from "./lib/pilot6-content.mjs";

const [state, repoDirArg = "."] = process.argv.slice(2);
const repoDir = path.resolve(repoDirArg);

function refExists(ref) {
  return git(repoDir, ["rev-parse", "--verify", "--quiet", ref], { check: false }).status === 0;
}

// The upstream advance is applied here, after arm preparation, so GitButler
// and Jujutsu set up against the old main tip and then observe main moving —
// the same order of events the git arm experiences.
function advanceMain() {
  if (!refExists(UPSTREAM_HOLD_REF)) return;
  const upstreamTip = gitText(repoDir, ["rev-parse", UPSTREAM_HOLD_REF]);
  git(repoDir, ["update-ref", "refs/heads/main", upstreamTip]);
  git(repoDir, ["update-ref", "-d", UPSTREAM_HOLD_REF]);
  const remotes = gitText(repoDir, ["remote"]).split("\n").filter(Boolean);
  if (remotes.includes("gb-local")) {
    run("git", ["fetch", "gb-local"], { cwd: repoDir, check: false });
  }
}

const partialStates = {
  "resolved-notify": { "src/notify.ts": NOTIFY_COMBINED_VARIANTS[0] },
  "resolved-config": { "src/config.ts": FEATURE2_FILES["src/config.ts"] },
};

if (state === "main") {
  syncFileState(repoDir, BASE_FILES, ALL_KNOWN_PATHS);
} else if (state === "dirty") {
  advanceMain();
  syncFileState(repoDir, DIRTY_FILES, ALL_KNOWN_PATHS);
} else if (partialStates[state]) {
  syncFileState(repoDir, partialStates[state], []);
} else {
  console.error("Usage: node scripts/apply-pilot6-state.mjs <main|dirty|resolved-notify|resolved-config> [repoDir]");
  process.exit(2);
}
