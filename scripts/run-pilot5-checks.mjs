#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "./lib/args.mjs";
import { expectVerification, resetCheckDir, verifyRepo } from "./lib/checks.mjs";
import { commitStateSeries } from "./lib/fixture.mjs";
import {
  ALL_KNOWN_PATHS,
  EXPECTED_COMMIT_STATES,
  EXPORT_FILES,
  PARSER_HELPERS_FILES,
  RETRY_DOC_FILES,
  TASK_BRANCH,
  TOKEN_FILES,
} from "./lib/pilot5-content.mjs";
import { git, run } from "./lib/process.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const taskDir = path.join(repoRoot, "tasks/pilot-5-squash-commits");
const verifierScript = path.join(repoRoot, "scripts/verify-pilot5.mjs");
const tmpRoot = path.join(repoRoot, "tmp/pilot5-checks");

const args = parseArgs(process.argv.slice(2));
const butBin = args.get("but-bin") ?? process.env.BUT_BIN ?? "but";

function fixture(name) {
  const out = path.join(tmpRoot, name);
  run("node", [
    path.join(repoRoot, "scripts/create-pilot5-fixture.mjs"),
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

function rewriteWithStates(repoDir, states) {
  git(repoDir, ["switch", TASK_BRANCH]);
  git(repoDir, ["reset", "--hard", "main"]);
  commitStateSeries(repoDir, states, ALL_KNOWN_PATHS);
}

resetCheckDir(tmpRoot);

{
  const repo = fixture("noop");
  expect("noop", repo, false, { failureClass: "GRAPH_WRONG" });
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
  const repo = fixture("wrong-extra-old-subject");
  run(path.join(taskDir, "solution/solve-git.sh"), [], {
    cwd: repo,
    env: { ...process.env, BENCH_ROOT: repoRoot },
  });
  git(repo, ["commit", "--allow-empty", "-m", "extract parser helpers"]);
  expect("wrong-extra-old-subject", repo, false, {
    failureClass: "GRAPH_WRONG",
    checks: { source_subjects_removed: false },
  });
}

{
  const repo = fixture("dirty-after-squash");
  run(path.join(taskDir, "solution/solve-git.sh"), [], {
    cwd: repo,
    env: { ...process.env, BENCH_ROOT: repoRoot },
  });
  writeFileSync(path.join(repo, "scratch.txt"), "leftover note\n", "utf8");
  expect("dirty-after-squash", repo, false, { failureClass: "DIRTY_STATE_WRONG" });
}

{
  const repo = fixture("wrong-clean-worktree");
  run(path.join(taskDir, "solution/solve-git.sh"), [], {
    cwd: repo,
    env: { ...process.env, BENCH_ROOT: repoRoot },
  });
  git(repo, ["switch", "main"]);
  expect("wrong-clean-worktree", repo, false, {
    failureClass: "CONTENT_WRONG",
    checks: { branch_tree_matches_target: true, worktree_matches_target: false },
  });
}

{
  const repo = fixture("content-mutated");
  run(path.join(taskDir, "solution/solve-git.sh"), [], {
    cwd: repo,
    env: { ...process.env, BENCH_ROOT: repoRoot },
  });
  const retryPath = path.join(repo, "src/retry.ts");
  writeFileSync(retryPath, readFileSync(retryPath, "utf8").replace("500", "750"), "utf8");
  git(repo, ["add", "src/retry.ts"]);
  git(repo, ["commit", "--amend", "--no-edit"]);
  expect("content-mutated", repo, false, {
    failureClass: "CONTENT_WRONG",
    checks: { branch_tree_matches_target: false },
  });
}

{
  const repo = fixture("mispartitioned-final-tree");
  rewriteWithStates(repo, [
    { subject: "add parser token model", files: TOKEN_FILES },
    { subject: "add parser pipeline", files: PARSER_HELPERS_FILES },
    { subject: "add export endpoint", files: EXPORT_FILES },
    { subject: "add retry support", files: RETRY_DOC_FILES },
  ]);
  expect("mispartitioned-final-tree", repo, false, {
    failureClass: "CONTENT_WRONG",
    checks: {
      branch_tree_matches_target: true,
      snippets_not_in_wrong_commits: false,
    },
  });
}

{
  const repo = fixture("wrong-message");
  rewriteWithStates(repo, [
    EXPECTED_COMMIT_STATES[0],
    { subject: "wire parser helpers", files: EXPECTED_COMMIT_STATES[1].files },
    EXPECTED_COMMIT_STATES[2],
    EXPECTED_COMMIT_STATES[3],
  ]);
  expect("wrong-message", repo, false, {
    failureClass: "GRAPH_WRONG",
    checks: { commit_subjects_match: false },
  });
}

{
  const repo = fixture("wrong-main-tree");
  git(repo, ["switch", "main"]);
  writeFileSync(path.join(repo, "README.md"), "# Wrong Main\n", "utf8");
  git(repo, ["add", "README.md"]);
  git(repo, ["commit", "--amend", "--no-edit"]);
  expect("wrong-main-tree", repo, false, {
    failureClass: "ENV_FAILURE",
    checks: { main_has_single_commit: true, main_tree_matches_fixture: false },
  });
}

if (!process.exitCode) {
  console.log("pilot5 checks passed");
}
