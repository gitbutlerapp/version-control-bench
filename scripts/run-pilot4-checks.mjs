#!/usr/bin/env node
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EXPECTED_BRANCH_FILES } from "./lib/pilot4-content.mjs";
import { git, run } from "./lib/process.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const taskDir = path.join(repoRoot, "tasks/pilot-4-reorder-commits");
const tmpRoot = path.join(repoRoot, "tmp/pilot4-checks");

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
const butBin = args.get("but-bin") ?? process.env.BUT_BIN ?? "but";

function fixture(name) {
  const out = path.join(tmpRoot, name);
  run("node", [
    path.join(repoRoot, "scripts/create-pilot4-fixture.mjs"),
    "--out",
    out,
    "--force",
    "true",
  ], { cwd: repoRoot });
  return out;
}

function verify(repoDir) {
  const result = run("node", [path.join(repoRoot, "scripts/verify-pilot4.mjs"), "--repo", repoDir, "--task", taskDir], {
    cwd: repoRoot,
    check: false,
  });
  let parsed;
  try {
    parsed = JSON.parse(result.stdout);
  } catch {
    parsed = { passed: false, failure_class: "BAD_VERIFIER_OUTPUT", raw: result.stdout, stderr: result.stderr };
  }
  return { ok: result.status === 0, result: parsed };
}

function expect(name, repoDir, expectedPass, options = {}) {
  const actual = verify(repoDir);
  const expectedFailureClass = options.failureClass;
  const expectedChecks = options.checks ?? {};
  const failureClassMatches = expectedFailureClass === undefined
    || actual.result.failure_class === expectedFailureClass;
  const checksMatch = Object.entries(expectedChecks)
    .every(([key, value]) => actual.result.checks?.[key] === value);
  const passed = actual.ok === expectedPass
    && actual.result.passed === expectedPass
    && failureClassMatches
    && checksMatch;
  const status = passed ? "ok" : "FAIL";
  const expectedClassText = expectedFailureClass === undefined ? "" : `/${expectedFailureClass}`;
  console.log(`${status} ${name}: expected ${expectedPass ? "pass" : "fail"}${expectedClassText}, got ${actual.result.passed ? "pass" : "fail"} (${actual.result.failure_class ?? "none"})`);
  if (!passed) {
    console.log(JSON.stringify(actual.result, null, 2));
    process.exitCode = 1;
  }
}

function writeExpectedFiles(repoDir, filePaths) {
  for (const filePath of filePaths) {
    const fullPath = path.join(repoDir, filePath);
    mkdirSync(path.dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, EXPECTED_BRANCH_FILES[filePath], "utf8");
  }
}

function commitExpectedFiles(repoDir, subject, filePaths, options = {}) {
  writeExpectedFiles(repoDir, filePaths);
  if (filePaths.length > 0) {
    git(repoDir, ["add", ...filePaths]);
  }
  const args = ["commit", "-m", subject];
  if (options.allowEmpty) args.splice(1, 0, "--allow-empty");
  git(repoDir, args);
}

rmSync(tmpRoot, { recursive: true, force: true });
mkdirSync(tmpRoot, { recursive: true });

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
  const repo = fixture("wrong-extra-commit");
  git(repo, ["commit", "--allow-empty", "-m", "Explain reorder plan"]);
  expect("wrong-extra-commit", repo, false, { failureClass: "GRAPH_WRONG" });
}

{
  const repo = fixture("dirty-after-reorder");
  run(path.join(taskDir, "solution/solve-git.sh"), [], {
    cwd: repo,
    env: { ...process.env, BENCH_ROOT: repoRoot },
  });
  writeFileSync(path.join(repo, "notes.txt"), "leftover scratch note\n", "utf8");
  expect("dirty-after-reorder", repo, false, { failureClass: "DIRTY_STATE_WRONG" });
}

{
  const repo = fixture("content-mutated");
  run(path.join(taskDir, "solution/solve-git.sh"), [], {
    cwd: repo,
    env: { ...process.env, BENCH_ROOT: repoRoot },
  });
  const retryPath = path.join(repo, "src/retry.ts");
  writeFileSync(retryPath, readFileSync(retryPath, "utf8").replace("30_000", "60_000"), "utf8");
  git(repo, ["add", "src/retry.ts"]);
  git(repo, ["commit", "--amend", "--no-edit"]);
  expect("content-mutated", repo, false, {
    failureClass: "CONTENT_WRONG",
    checks: { branch_tree_matches_target: false },
  });
}

{
  const repo = fixture("mispartitioned-final-tree");
  git(repo, ["reset", "--hard", "main"]);
  commitExpectedFiles(repo, "add app configuration", [], { allowEmpty: true });
  commitExpectedFiles(repo, "add retry policy", [
    "src/retry.ts",
    "tests/retry.test.ts",
  ]);
  commitExpectedFiles(repo, "add notification sender", [
    "src/notification.ts",
    "tests/notification.test.ts",
  ]);
  commitExpectedFiles(repo, "add customer model", [
    "src/customer.ts",
    "tests/customer.test.ts",
  ]);
  commitExpectedFiles(repo, "add email formatter", [
    "src/config.ts",
    "src/email.ts",
    "tests/email.test.ts",
  ]);
  commitExpectedFiles(repo, "document notification flow", [
    "README.md",
    "docs/notification-flow.md",
  ]);
  expect("mispartitioned-final-tree", repo, false, {
    failureClass: "CONTENT_WRONG",
    checks: {
      branch_tree_matches_target: true,
      snippets_not_in_wrong_commits: false,
    },
  });
}

if (!process.exitCode) {
  console.log("pilot4 checks passed");
}
