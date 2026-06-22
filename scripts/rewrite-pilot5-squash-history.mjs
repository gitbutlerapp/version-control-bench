#!/usr/bin/env node
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { git } from "./lib/process.mjs";
import { ALL_KNOWN_PATHS, EXPECTED_COMMIT_STATES, TASK_BRANCH } from "./lib/pilot5-content.mjs";

function parseArgs(argv) {
  const args = new Map();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      args.set(arg.slice(2), argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true");
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const repoDir = path.resolve(args.get("repo") ?? ".");
const branch = args.get("branch") ?? TASK_BRANCH;

git(repoDir, ["switch", branch]);
git(repoDir, ["reset", "--hard", "main"]);

for (const state of EXPECTED_COMMIT_STATES) {
  syncCommitState(repoDir, state.files);
  git(repoDir, ["add", "-A"]);
  git(repoDir, ["commit", "-m", state.subject]);
}

function syncCommitState(repoDir, files) {
  for (const relativePath of ALL_KNOWN_PATHS) {
    if (!(relativePath in files) || files[relativePath] === undefined) {
      rmSync(path.join(repoDir, relativePath), { force: true });
    }
  }
  for (const [relativePath, content] of Object.entries(files)) {
    if (content === undefined) continue;
    const fullPath = path.join(repoDir, relativePath);
    mkdirSync(path.dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, content, "utf8");
  }
}
