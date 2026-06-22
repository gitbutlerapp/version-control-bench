#!/usr/bin/env node
import path from "node:path";
import { parseArgs } from "./lib/args.mjs";
import { commitStateSeries, initBenchmarkRepo, prepareFixtureDir, syncFileState } from "./lib/fixture.mjs";
import { git } from "./lib/process.mjs";
import { ALL_KNOWN_PATHS, INITIAL_COMMIT_STATES, MAIN_FILES, TASK_BRANCH } from "./lib/pilot4-content.mjs";

const args = parseArgs(process.argv.slice(2));
const outDir = path.resolve(args.get("out") ?? "tmp/pilot-4-workspace");
const force = args.get("force") === "true";

prepareFixtureDir(outDir, { force });
initBenchmarkRepo(outDir);

syncFileState(outDir, MAIN_FILES, ALL_KNOWN_PATHS);
git(outDir, ["add", ...Object.keys(MAIN_FILES)]);
git(outDir, ["commit", "-m", "Initial benchmark workspace"]);

git(outDir, ["switch", "-c", TASK_BRANCH]);
commitStateSeries(outDir, INITIAL_COMMIT_STATES, ALL_KNOWN_PATHS);

console.log(outDir);
