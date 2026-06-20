#!/usr/bin/env node
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { git } from "./lib/process.mjs";
import { ALL_KNOWN_PATHS, AMENDED_COMMIT_STATES, DIRTY_FILES, TASK_BRANCH } from "./lib/pilot2-content.mjs";

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
const dirty = args.get("dirty") !== "false";

git(repoDir, ["switch", TASK_BRANCH]);
git(repoDir, ["reset", "--hard", "main"]);
git(repoDir, ["clean", "-fd"]);

for (const state of AMENDED_COMMIT_STATES) {
  syncFiles(repoDir, state.files);
  git(repoDir, ["add", "-A"]);
  git(repoDir, ["commit", "-m", state.subject]);
}

if (dirty) {
  syncFiles(repoDir, DIRTY_FILES);
}

function syncFiles(repoDir, files) {
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
