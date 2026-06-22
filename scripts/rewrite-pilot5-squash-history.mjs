#!/usr/bin/env node
import path from "node:path";
import { parseArgs } from "./lib/args.mjs";
import { commitStateSeries } from "./lib/fixture.mjs";
import { git } from "./lib/process.mjs";
import { ALL_KNOWN_PATHS, EXPECTED_COMMIT_STATES, TASK_BRANCH } from "./lib/pilot5-content.mjs";

const args = parseArgs(process.argv.slice(2));
const repoDir = path.resolve(args.get("repo") ?? ".");
const branch = args.get("branch") ?? TASK_BRANCH;

git(repoDir, ["switch", branch]);
git(repoDir, ["reset", "--hard", "main"]);

commitStateSeries(repoDir, EXPECTED_COMMIT_STATES, ALL_KNOWN_PATHS);
