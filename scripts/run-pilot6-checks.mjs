#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { rmSync, writeFileSync } from "node:fs";
import { parseArgs } from "./lib/args.mjs";
import { expectVerification, resetCheckDir, verifyRepo } from "./lib/checks.mjs";
import { git, run } from "./lib/process.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const taskDir = path.join(repoRoot, "tasks/pilot-6-update-dirty-branch");
const verifierScript = path.join(repoRoot, "scripts/verify-pilot6.mjs");
const tmpRoot = path.join(repoRoot, "tmp/pilot6-checks");

const args = parseArgs(process.argv.slice(2));
const butBin = args.get("but-bin") ?? process.env.BUT_BIN ?? "but";

function fixture(name, dirty = true) {
  const out = path.join(tmpRoot, name);
  run("node", [
    path.join(repoRoot, "scripts/create-pilot6-fixture.mjs"),
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
  git(repo, ["switch", "main"]);
  run(path.join(taskDir, "solution/solve-but.sh"), [], {
    cwd: repo,
    env: {
      ...process.env,
      BENCH_ROOT: repoRoot,
      BUT_BIN: butBin,
      E2E_TEST_APP_DATA_DIR: path.join(tmpRoot, "solve-but-app-data"),
    },
  });
  expect("solve-but", repo, true);
}

{
  const repo = fixture("wrong-merge-instead-of-rebase");
  git(repo, ["stash", "push"]);
  git(repo, ["merge", "main", "--no-edit"], { check: false });
  run("node", [path.join(repoRoot, "scripts/apply-pilot6-state.mjs"), "resolved-notify", repo], { cwd: repoRoot });
  run("node", [path.join(repoRoot, "scripts/apply-pilot6-state.mjs"), "resolved-config", repo], { cwd: repoRoot });
  git(repo, ["add", "-A"]);
  git(repo, ["commit", "--no-edit"], { check: false });
  git(repo, ["stash", "pop"], { check: false });
  expect("wrong-merge-instead-of-rebase", repo, false, { failureClass: "GRAPH_WRONG" });
}

{
  const repo = fixture("wrong-committed-dirty-readme");
  run(path.join(taskDir, "solution/solve-git.sh"), [], {
    cwd: repo,
    env: { ...process.env, BENCH_ROOT: repoRoot },
  });
  git(repo, ["add", "README.md"]);
  git(repo, ["commit", "--amend", "--no-edit"]);
  expect("wrong-committed-dirty-readme", repo, false, { failureClass: "CONTENT_WRONG" });
}

{
  const repo = fixture("wrong-lost-leftover-note");
  run(path.join(taskDir, "solution/solve-git.sh"), [], {
    cwd: repo,
    env: { ...process.env, BENCH_ROOT: repoRoot },
  });
  rmSync(path.join(repo, "notes/rollout-checklist.md"));
  expect("wrong-lost-leftover-note", repo, false, { failureClass: "DIRTY_STATE_WRONG" });
}

{
  const repo = fixture("wrong-markers-left");
  run(path.join(taskDir, "solution/solve-git.sh"), [], {
    cwd: repo,
    env: { ...process.env, BENCH_ROOT: repoRoot },
  });
  writeFileSync(path.join(repo, "src/config.ts"), "<<<<<<< ours\nretryLimit: 8,\n=======\nretryLimit: 5,\n>>>>>>> theirs\n");
  expect("wrong-markers-left", repo, false, { failureClass: "CONFLICT_UNRESOLVED" });
}

{
  const repo = fixture("wrong-stash-left");
  run(path.join(taskDir, "solution/solve-git.sh"), [], {
    cwd: repo,
    env: { ...process.env, BENCH_ROOT: repoRoot },
  });
  writeFileSync(path.join(repo, "README.md"), "# stash bait\n");
  git(repo, ["stash", "push"]);
  git(repo, ["checkout", "README.md"], { check: false });
  expect("wrong-stash-left", repo, false, { failureClass: "DIRTY_STATE_WRONG" });
}

if (!process.exitCode) {
  console.log("pilot6 checks passed");
}
