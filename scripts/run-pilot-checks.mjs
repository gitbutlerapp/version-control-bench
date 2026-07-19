#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "./lib/args.mjs";
import { expectVerification, resetCheckDir, verifyRepo } from "./lib/checks.mjs";
import { git, run } from "./lib/process.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const taskDir = path.join(repoRoot, "tasks/pilot-1-selective-validation");
const verifierScript = path.join(repoRoot, "scripts/verify-pilot.mjs");
const tmpRoot = path.join(repoRoot, "tmp/pilot-checks");

const args = parseArgs(process.argv.slice(2));
const butBin = args.get("but-bin") ?? process.env.BUT_BIN ?? "but";

function fixture(name) {
  const out = path.join(tmpRoot, name);
  run("node", [path.join(repoRoot, "scripts/create-pilot-fixture.mjs"), "--out", out, "--force", "true"], {
    cwd: repoRoot,
  });
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
  const repo = fixture("wrong-add-all");
  git(repo, ["switch", "-c", "input-validation"]);
  git(repo, ["add", "."]);
  git(repo, ["commit", "-m", "Add input validation"]);
  expect("wrong-add-all", repo, false);
}

{
  const repo = fixture("wrong-handler-only");
  git(repo, ["switch", "-c", "input-validation"]);
  run("node", [path.join(repoRoot, "scripts/apply-pilot-state.mjs"), "target-only", repo], { cwd: repoRoot });
  git(repo, ["add", "src/handler.ts"]);
  git(repo, ["commit", "-m", "Add input validation"]);
  run("node", [path.join(repoRoot, "scripts/apply-pilot-state.mjs"), "dirty", repo], { cwd: repoRoot });
  expect("wrong-handler-only", repo, false);
}

// Minefield sabotage: task solved correctly, but harmful residue left behind.
{
  const repo = fixture("minefield-stash");
  run(path.join(taskDir, "solution/solve-git.sh"), [], {
    cwd: repo,
    env: { ...process.env, BENCH_ROOT: repoRoot },
  });
  writeFileSync(path.join(repo, "scratch.txt"), "junk\n");
  git(repo, ["stash", "push", "--include-untracked", "--", "scratch.txt"]);
  expect("minefield-stash", repo, false, {
    failureClass: "DIRTY_STATE_WRONG",
    checks: { no_stash_left_behind: false },
  });
}

{
  const repo = fixture("minefield-op-residue");
  run(path.join(taskDir, "solution/solve-git.sh"), [], {
    cwd: repo,
    env: { ...process.env, BENCH_ROOT: repoRoot },
  });
  mkdirSync(path.join(repo, ".git", "rebase-merge"), { recursive: true });
  expect("minefield-op-residue", repo, false, {
    failureClass: "DIRTY_STATE_WRONG",
    checks: { no_operation_in_progress: false },
  });
}

if (!process.exitCode) {
  console.log("pilot checks passed");
}
