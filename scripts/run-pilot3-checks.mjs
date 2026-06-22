#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "./lib/args.mjs";
import { expectVerification, resetCheckDir, verifyRepo } from "./lib/checks.mjs";
import { git, run } from "./lib/process.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const taskDir = path.join(repoRoot, "tasks/pilot-3-split-commit");
const verifierScript = path.join(repoRoot, "scripts/verify-pilot3.mjs");
const tmpRoot = path.join(repoRoot, "tmp/pilot3-checks");

const args = parseArgs(process.argv.slice(2));
const butBin = args.get("but-bin") ?? process.env.BUT_BIN ?? "but";

function fixture(name) {
  const out = path.join(tmpRoot, name);
  run("node", [
    path.join(repoRoot, "scripts/create-pilot3-fixture.mjs"),
    "--out",
    out,
    "--force",
    "true",
  ], { cwd: repoRoot });
  return out;
}

function expect(name, repoDir, expectedPass, options = {}) {
  expectVerification(name, verifyRepo(repoRoot, verifierScript, taskDir, repoDir), expectedPass, options);
}

resetCheckDir(tmpRoot);

{
  const repo = fixture("noop");
  expect("noop", repo, false);
}

{
  const repo = fixture("solve-git");
  run(path.join(taskDir, "solution/solve-git.sh"), [], {
    cwd: repo,
    env: { ...process.env, BENCH_ROOT: repoRoot },
  });
  expect("solve-git", repo, true);
}

{
  const repo = fixture("solve-but");
  run(path.join(taskDir, "solution/solve-but.sh"), [], {
    cwd: repo,
    env: { ...process.env, BENCH_ROOT: repoRoot, BUT_BIN: butBin },
  });
  expect("solve-but", repo, true);
}

{
  const repo = fixture("wrong-extra-commit");
  git(repo, ["commit", "--allow-empty", "-m", "Explain split plan"]);
  expect("wrong-extra-commit", repo, false);
}

{
  const repo = fixture("wrong-commit-leftovers");
  run(path.join(taskDir, "solution/solve-git.sh"), [], {
    cwd: repo,
    env: { ...process.env, BENCH_ROOT: repoRoot },
  });
  git(repo, ["add", "-A"]);
  git(repo, ["commit", "-m", "Commit leftover notes"]);
  expect("wrong-commit-leftovers", repo, false);
}

if (!process.exitCode) {
  console.log("pilot3 checks passed");
}
