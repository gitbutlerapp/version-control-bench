import { mkdirSync, rmSync } from "node:fs";
import { run } from "./process.mjs";

export function resetCheckDir(tmpRoot) {
  rmSync(tmpRoot, { recursive: true, force: true });
  mkdirSync(tmpRoot, { recursive: true });
}

export function verifyRepo(repoRoot, verifierScript, taskDir, repoDir) {
  const result = run("node", [verifierScript, "--repo", repoDir, "--task", taskDir], {
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

export function expectVerification(name, actual, expectedPass, options = {}) {
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
