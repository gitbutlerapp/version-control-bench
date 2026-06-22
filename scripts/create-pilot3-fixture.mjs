#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "./lib/args.mjs";
import { commitStateSeries, initBenchmarkRepo, prepareFixtureDir } from "./lib/fixture.mjs";
import { git, run } from "./lib/process.mjs";
import { ALL_KNOWN_PATHS, INITIAL_COMMIT_STATES, MAIN_FILES, TASK_BRANCH } from "./lib/pilot3-content.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const args = parseArgs(process.argv.slice(2));
const outDir = path.resolve(args.get("out") ?? "tmp/pilot-3-workspace");
const force = args.get("force") === "true";

prepareFixtureDir(outDir, { force });
initBenchmarkRepo(outDir);

run("node", [path.join(repoRoot, "scripts/apply-pilot3-state.mjs"), "main", outDir], { cwd: repoRoot });
git(outDir, ["add", ...Object.keys(MAIN_FILES)]);
git(outDir, ["commit", "-m", "Initial benchmark workspace"]);

git(outDir, ["switch", "-c", TASK_BRANCH]);
commitStateSeries(outDir, INITIAL_COMMIT_STATES, ALL_KNOWN_PATHS);

console.log(outDir);
