#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "./lib/args.mjs";
import { expectVerification, resetCheckDir, verifyRepo } from "./lib/checks.mjs";
import { git, run } from "./lib/process.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const taskDir = path.join(repoRoot, "tasks/pilot-2-multi-amend");
const verifierScript = path.join(repoRoot, "scripts/verify-pilot2.mjs");
const tmpRoot = path.join(repoRoot, "tmp/pilot2-checks");

const args = parseArgs(process.argv.slice(2));
const butBin = args.get("but-bin") ?? process.env.BUT_BIN ?? "but";

function fixture(name, dirty = true) {
  const out = path.join(tmpRoot, name);
  run("node", [
    path.join(repoRoot, "scripts/create-pilot2-fixture.mjs"),
    "--out",
    out,
    "--force",
    "true",
    "--dirty",
    String(dirty),
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
  const repo = fixture("solve-but", false);
  run(path.join(taskDir, "solution/solve-but.sh"), [], {
    cwd: repo,
    env: { ...process.env, BENCH_ROOT: repoRoot, BUT_BIN: butBin },
  });
  expect("solve-but", repo, true);
}

{
  const repo = fixture("wrong-extra-commit");
  git(repo, ["add", "."]);
  git(repo, ["commit", "-m", "Apply requested amend changes"]);
  expect("wrong-extra-commit", repo, false);
}

{
  const repo = fixture("wrong-commit-leftovers");
  git(repo, ["add", "."]);
  git(repo, ["commit", "--amend", "--no-edit"]);
  expect("wrong-commit-leftovers", repo, false);
}

if (!process.exitCode) {
  console.log("pilot2 checks passed");
}
