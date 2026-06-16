#!/usr/bin/env node
import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { git, run } from "./lib/process.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const taskDir = path.join(repoRoot, "tasks/pilot-1-selective-validation");
const tmpRoot = path.join(repoRoot, "tmp/pilot-checks");

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
  run("node", [path.join(repoRoot, "scripts/create-pilot-fixture.mjs"), "--out", out, "--force", "true"], {
    cwd: repoRoot,
  });
  return out;
}

function verify(repoDir) {
  const result = run("node", [path.join(repoRoot, "scripts/verify-pilot.mjs"), "--repo", repoDir, "--task", taskDir], {
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

function expect(name, repoDir, expectedPass) {
  const actual = verify(repoDir);
  const passed = actual.ok === expectedPass && actual.result.passed === expectedPass;
  const status = passed ? "ok" : "FAIL";
  console.log(`${status} ${name}: expected ${expectedPass ? "pass" : "fail"}, got ${actual.result.passed ? "pass" : "fail"} (${actual.result.failure_class ?? "none"})`);
  if (!passed) {
    console.log(JSON.stringify(actual.result, null, 2));
    process.exitCode = 1;
  }
}

rmSync(tmpRoot, { recursive: true, force: true });
mkdirSync(tmpRoot, { recursive: true });

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

if (!process.exitCode) {
  console.log("pilot checks passed");
}
