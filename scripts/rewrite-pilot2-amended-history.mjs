#!/usr/bin/env node
import path from "node:path";
import { parseArgs } from "./lib/args.mjs";
import { commitStateSeries, syncFileState } from "./lib/fixture.mjs";
import { git } from "./lib/process.mjs";
import { ALL_KNOWN_PATHS, AMENDED_COMMIT_STATES, DIRTY_FILES, TASK_BRANCH } from "./lib/pilot2-content.mjs";

const args = parseArgs(process.argv.slice(2));
const repoDir = path.resolve(args.get("repo") ?? ".");
const dirty = args.get("dirty") !== "false";

git(repoDir, ["switch", TASK_BRANCH]);
git(repoDir, ["reset", "--hard", "main"]);
git(repoDir, ["clean", "-fd"]);

commitStateSeries(repoDir, AMENDED_COMMIT_STATES, ALL_KNOWN_PATHS);

if (dirty) {
  syncFileState(repoDir, DIRTY_FILES, ALL_KNOWN_PATHS);
}
