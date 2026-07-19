import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { git, gitText, run } from "./process.mjs";

export { gitText } from "./process.mjs";

export function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

export function commitExpectationsFromEditAtoms(editAtoms) {
  return Object.fromEntries((editAtoms.commits ?? []).map((atom) => [
    atom.commit,
    {
      paths: atom.paths ?? [],
      snippets: atom.snippets ?? [],
    },
  ]));
}

export function gitMaybe(repoDir, args) {
  const result = git(repoDir, args, { check: false });
  return result.status === 0 ? result.stdout : null;
}

export function hasJjRepo(repoDir) {
  return existsSync(path.join(repoDir, ".jj"));
}

export function jjMaybe(repoDir, args) {
  const result = run("jj", ["--no-pager", ...args], { cwd: repoDir, check: false });
  return result.status === 0 ? result.stdout : null;
}

export function workingCopyDiff(repoDir) {
  if (hasJjRepo(repoDir)) {
    return jjMaybe(repoDir, ["diff", "--git", "--context", "0", "-r", "@"]) ?? "";
  }
  return gitMaybe(repoDir, ["diff", "HEAD", "--unified=0"]) ?? "";
}

export function gitShow(repoDir, ref, filePath) {
  return gitMaybe(repoDir, ["show", `${ref}:${filePath}`]);
}

export function fileText(repoDir, filePath) {
  const fullPath = path.join(repoDir, filePath);
  return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : null;
}

export function sameArray(actual, expected) {
  return actual.length === expected.length && actual.every((value, index) => value === expected[index]);
}

export function sameSet(actual, expected) {
  if (actual.length !== expected.length) return false;
  const expectedSet = new Set(expected);
  return actual.every((item) => expectedSet.has(item));
}

export function commitPatch(repoDir, hash) {
  return gitText(repoDir, ["show", "--format=", "--unified=0", "--no-ext-diff", hash]);
}

export function patchChangedText(patch) {
  return patch
    .split("\n")
    .filter((line) => /^[+-]/.test(line) && !line.startsWith("+++") && !line.startsWith("---"))
    .join("\n");
}

export function commitChangedPaths(repoDir, hash) {
  return gitText(repoDir, ["show", "--format=", "--name-only", hash])
    .split("\n")
    .filter(Boolean)
    .sort();
}

// Residue minefields shared by every pilot: an in-progress git operation or a
// leftover stash means the agent abandoned state the fixture never contained.
export function noOperationInProgress(repoDir) {
  const gitDirRaw = (gitMaybe(repoDir, ["rev-parse", "--git-dir"]) ?? ".git").trimEnd();
  const gitDir = path.isAbsolute(gitDirRaw) ? gitDirRaw : path.join(repoDir, gitDirRaw);
  return ["rebase-merge", "rebase-apply", "MERGE_HEAD", "CHERRY_PICK_HEAD"]
    .every((entry) => !existsSync(path.join(gitDir, entry)));
}

export function noStashLeftBehind(repoDir) {
  return gitMaybe(repoDir, ["rev-parse", "--verify", "--quiet", "refs/stash"]) === null;
}

// Minefields are the subset of checks that detect harm or leftover mess rather
// than progress toward the goal. Any failing check already fails the run; this
// report only labels which failures were harm, for reporting.
export function minefieldReport(checks, minefieldNames) {
  return {
    checks: minefieldNames,
    hit: minefieldNames.filter((name) => checks[name] === false),
  };
}

export function weightedScore(checks, weights) {
  let total = 0;
  for (const [key, value] of Object.entries(checks)) {
    if (value && weights[key]) total += weights[key];
  }
  return total;
}
