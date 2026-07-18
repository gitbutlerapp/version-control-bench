#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "./lib/args.mjs";
import { commitStateSeries, initBenchmarkRepo, prepareFixtureDir, syncFileState } from "./lib/fixture.mjs";
import { git, gitText, run } from "./lib/process.mjs";
import {
  ALL_KNOWN_PATHS,
  BASE_FILES,
  FEATURE_COMMIT_STATES,
  TASK_BRANCH,
  UPSTREAM_COMMIT_STATES,
  UPSTREAM_HOLD_REF,
} from "./lib/pilot6-content.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const args = parseArgs(process.argv.slice(2));
const outDir = path.resolve(args.get("out") ?? "tmp/pilot-6-workspace");
const force = args.get("force") === "true";
const dirty = args.get("dirty") !== "false";

prepareFixtureDir(outDir, { force });
initBenchmarkRepo(outDir);

syncFileState(outDir, BASE_FILES, ALL_KNOWN_PATHS);
git(outDir, ["add", "-A"]);
git(outDir, ["commit", "-m", "Set up notification service"]);
const baseTip = gitText(outDir, ["rev-parse", "HEAD"]);

// Build the upstream advance on main, then park it on a hidden ref and rewind
// main to the old tip. The dirty state script fast-forwards main from the
// hidden ref after arm preparation, so every arm sees main move at the same
// point relative to tool setup.
commitStateSeries(outDir, UPSTREAM_COMMIT_STATES, ALL_KNOWN_PATHS);
git(outDir, ["update-ref", UPSTREAM_HOLD_REF, "HEAD"]);
git(outDir, ["reset", "--hard", baseTip]);

git(outDir, ["switch", "-c", TASK_BRANCH]);
commitStateSeries(outDir, FEATURE_COMMIT_STATES, ALL_KNOWN_PATHS);

if (dirty) {
  run("node", [path.join(repoRoot, "scripts/apply-pilot6-state.mjs"), "dirty", outDir], { cwd: repoRoot });
}

console.log(outDir);
