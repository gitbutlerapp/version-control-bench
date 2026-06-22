#!/usr/bin/env node
import path from "node:path";
import { parseArgs } from "./lib/args.mjs";
import { git, gitText } from "./lib/process.mjs";
import { EXPECTED_COMMIT_SUBJECTS, TASK_BRANCH } from "./lib/pilot4-content.mjs";

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
