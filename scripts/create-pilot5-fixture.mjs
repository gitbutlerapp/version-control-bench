#!/usr/bin/env node
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { git, run } from "./lib/process.mjs";
import { ALL_KNOWN_PATHS, INITIAL_COMMIT_STATES, MAIN_FILES, TASK_BRANCH } from "./lib/pilot5-content.mjs";

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
const outDir = path.resolve(args.get("out") ?? "tmp/pilot-5-workspace");
const force = args.get("force") === "true";

if (existsSync(outDir)) {
  if (!force) {
    console.error(`Refusing to overwrite existing directory: ${outDir}`);
    console.error("Pass --force true to replace it.");
    process.exit(2);
  }
  rmSync(outDir, { recursive: true, force: true });
}

mkdirSync(outDir, { recursive: true });
run("git", ["init", "-b", "main"], { cwd: outDir });
git(outDir, ["config", "user.name", "Bench Author"]);
git(outDir, ["config", "user.email", "bench@example.com"]);
git(outDir, ["config", "commit.gpgsign", "false"]);

syncCommitState(outDir, MAIN_FILES);
git(outDir, ["add", ...Object.keys(MAIN_FILES)]);
git(outDir, ["commit", "-m", "Initial benchmark workspace"]);

git(outDir, ["switch", "-c", TASK_BRANCH]);
for (const state of INITIAL_COMMIT_STATES) {
  syncCommitState(outDir, state.files);
  git(outDir, ["add", "-A"]);
  git(outDir, ["commit", "-m", state.subject]);
}

console.log(outDir);

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
