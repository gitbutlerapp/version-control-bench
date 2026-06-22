#!/usr/bin/env node
import path from "node:path";
import { git } from "./lib/process.mjs";
import { EXPECTED_COMMIT_SUBJECTS, TASK_BRANCH } from "./lib/pilot4-content.mjs";

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

function gitText(repoDir, args) {
  return git(repoDir, args).stdout.trimEnd();
}

const args = parseArgs(process.argv.slice(2));
const repoDir = path.resolve(args.get("repo") ?? ".");
const branch = args.get("branch") ?? TASK_BRANCH;

git(repoDir, ["switch", branch]);

const commits = gitText(repoDir, ["rev-list", "--reverse", `main..${branch}`])
  .split("\n")
  .filter(Boolean);
const bySubject = new Map(
  commits.map((hash) => [gitText(repoDir, ["log", "-1", "--format=%s", hash]), hash]),
);

for (const subject of EXPECTED_COMMIT_SUBJECTS) {
  if (!bySubject.has(subject)) {
    throw new Error(`Missing commit subject: ${subject}`);
  }
}

git(repoDir, ["reset", "--hard", "main"]);
for (const subject of EXPECTED_COMMIT_SUBJECTS) {
  git(repoDir, ["cherry-pick", bySubject.get(subject)]);
}
