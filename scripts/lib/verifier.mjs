import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { git, gitText } from "./process.mjs";

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

export function weightedScore(checks, weights) {
  let total = 0;
  for (const [key, value] of Object.entries(checks)) {
    if (value && weights[key]) total += weights[key];
  }
  return total;
}
