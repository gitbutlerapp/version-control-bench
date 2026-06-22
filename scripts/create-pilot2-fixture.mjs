#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "./lib/args.mjs";
import { commitStateSeries, initBenchmarkRepo, prepareFixtureDir } from "./lib/fixture.mjs";
import { git, run } from "./lib/process.mjs";
import { ALL_KNOWN_PATHS, COMMIT_STATES, MAIN_FILES, TASK_BRANCH } from "./lib/pilot2-content.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const args = parseArgs(process.argv.slice(2));
const outDir = path.resolve(args.get("out") ?? "tmp/pilot-2-workspace");
const force = args.get("force") === "true";
const dirty = args.get("dirty") !== "false";

prepareFixtureDir(outDir, { force });
initBenchmarkRepo(outDir);

run("node", [path.join(repoRoot, "scripts/apply-pilot2-state.mjs"), "main", outDir], { cwd: repoRoot });
git(outDir, ["add", ...Object.keys(MAIN_FILES)]);
git(outDir, ["commit", "-m", "Initial benchmark workspace"]);

git(outDir, ["switch", "-c", TASK_BRANCH]);
commitStateSeries(outDir, COMMIT_STATES, ALL_KNOWN_PATHS);

if (dirty) {
  run("node", [path.join(repoRoot, "scripts/apply-pilot2-state.mjs"), "dirty", outDir], { cwd: repoRoot });
}

console.log(outDir);
