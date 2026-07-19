#!/usr/bin/env node
import path from "node:path";
import { parseArgs } from "./lib/args.mjs";
import { EXPECTED_BRANCH_FILES } from "./lib/pilot3-content.mjs";
import {
  commitPatch,
  fileText,
  gitMaybe,
  gitShow,
  gitText,
  patchChangedText,
  readJson,
  sameArray,
  sameSet,
  weightedScore,
  workingCopyDiff,
  minefieldReport,
  noOperationInProgress,
  noStashLeftBehind,
} from "./lib/verifier.mjs";

const MINEFIELD_CHECKS = [
  "leftover_atoms_not_committed",
  "leftover_atoms_preserved",
  "no_unresolved_conflicts",
  "no_operation_in_progress",
  "no_stash_left_behind",
];

function classify(checks) {
  if (!checks.git_repo || !checks.main_exists || !checks.main_has_single_commit || !checks.task_branch_exists) {
    return "ENV_FAILURE";
  }
  if (!checks.branch_has_expected_commit_count || !checks.commit_subjects_preserved || !checks.no_broad_commit || !checks.no_merge_commits) {
    return "GRAPH_WRONG";
  }
  if (!checks.branch_tree_matches_target || !checks.target_atoms_in_assigned_commits) {
    return "CONTENT_WRONG";
  }
  if (!checks.target_atoms_not_in_wrong_commits || !checks.leftover_atoms_not_committed) {
    return "PARTITION_WRONG";
  }
  if (!checks.leftover_atoms_preserved || !checks.target_atoms_not_left_uncommitted) {
    return "DIRTY_STATE_WRONG";
  }
  if (!checks.no_unresolved_conflicts || !checks.no_operation_in_progress || !checks.no_stash_left_behind) {
    return "DIRTY_STATE_WRONG";
  }
  return null;
}

function score(checks) {
  const weights = {
    git_repo: 5,
    main_exists: 5,
    main_has_single_commit: 5,
    task_branch_exists: 5,
    branch_has_expected_commit_count: 10,
    commit_subjects_preserved: 10,
    no_broad_commit: 5,
    no_merge_commits: 5,
    branch_tree_matches_target: 15,
    target_atoms_in_assigned_commits: 15,
    target_atoms_not_in_wrong_commits: 10,
    leftover_atoms_not_committed: 10,
    leftover_atoms_preserved: 10,
    target_atoms_not_left_uncommitted: 5,
    no_unresolved_conflicts: 5,
  };

  return weightedScore(checks, weights);
}

const args = parseArgs(process.argv.slice(2));
const repoDir = path.resolve(args.get("repo") ?? ".");
const taskDir = path.resolve(args.get("task") ?? "tasks/pilot-3-split-commit");
const oracle = readJson(path.join(taskDir, "oracle/oracle.json"));
const atoms = readJson(path.join(taskDir, "oracle/edit-atoms.json"));

const checks = {};
const details = {};

checks.git_repo = gitMaybe(repoDir, ["rev-parse", "--git-dir"]) !== null;
checks.main_exists = gitMaybe(repoDir, ["rev-parse", "--verify", "refs/heads/main"]) !== null;
checks.main_has_single_commit = checks.main_exists && gitText(repoDir, ["rev-list", "--count", "main"]) === "1";

const branch = oracle.task_branch;
details.task_branch = branch;
checks.task_branch_exists = gitMaybe(repoDir, ["rev-parse", "--verify", `refs/heads/${branch}`]) !== null;

let commits = [];
let commitSubjects = [];
let commitPatches = new Map();
let commitChangedText = new Map();
if (checks.task_branch_exists) {
  commits = gitText(repoDir, ["rev-list", "--reverse", `main..${branch}`])
    .split("\n")
    .filter(Boolean);
  commitSubjects = commits.map((hash) => gitText(repoDir, ["log", "-1", "--format=%s", hash]));
  commitPatches = new Map(commits.map((hash, index) => [commitSubjects[index], commitPatch(repoDir, hash)]));
  commitChangedText = new Map([...commitPatches.entries()].map(([subject, patch]) => [subject, patchChangedText(patch)]));
}

details.commit_subjects = commitSubjects;
checks.branch_has_expected_commit_count = commits.length === oracle.commit_subjects.length;
checks.commit_subjects_preserved = sameArray(commitSubjects, oracle.commit_subjects);
checks.no_broad_commit = !commitSubjects.includes(oracle.broad_commit_subject);
checks.no_merge_commits = checks.task_branch_exists && gitText(repoDir, ["rev-list", "--merges", `main..${branch}`]) === "";

const expectedTreePaths = Object.keys(EXPECTED_BRANCH_FILES).sort();
const actualTreePaths = checks.task_branch_exists
  ? gitText(repoDir, ["ls-tree", "-r", "--name-only", branch]).split("\n").filter(Boolean).sort()
  : [];
details.branch_tree_paths = actualTreePaths;

const treeFileResults = expectedTreePaths.map((filePath) => ({
  path: filePath,
  matches: gitShow(repoDir, branch, filePath) === EXPECTED_BRANCH_FILES[filePath],
}));
details.branch_tree_file_results = treeFileResults;
checks.branch_tree_matches_target = sameSet(actualTreePaths, expectedTreePaths) && treeFileResults.every((result) => result.matches);

const targetAtomResults = atoms.target.map((atom) => {
  const patch = commitChangedText.get(atom.commit) ?? "";
  return {
    id: atom.id,
    commit: atom.commit,
    present: patch.includes(atom.snippet),
  };
});
details.target_atoms_in_assigned_commits = targetAtomResults;
checks.target_atoms_in_assigned_commits = targetAtomResults.every((result) => result.present);

const wrongCommitResults = atoms.target.map((atom) => {
  const wrongSubjects = oracle.commit_subjects.filter((subject) => subject !== atom.commit);
  const offenders = wrongSubjects.filter((subject) => (commitChangedText.get(subject) ?? "").includes(atom.snippet));
  return {
    id: atom.id,
    commit: atom.commit,
    offenders,
  };
});
details.target_atoms_not_in_wrong_commits = wrongCommitResults;
checks.target_atoms_not_in_wrong_commits = wrongCommitResults.every((result) => result.offenders.length === 0);

const allBranchPatch = checks.task_branch_exists
  ? patchChangedText(gitText(repoDir, ["log", "--format=", "--unified=0", "-p", `main..${branch}`]))
  : "";
const leftoverCommitResults = atoms.leftover.map((atom) => ({
  id: atom.id,
  absent: !allBranchPatch.includes(atom.snippet),
}));
details.leftover_atoms_not_committed = leftoverCommitResults;
checks.leftover_atoms_not_committed = leftoverCommitResults.every((result) => result.absent);

const leftoverWorktreeResults = atoms.leftover.map((atom) => {
  const content = fileText(repoDir, atom.path) ?? "";
  return {
    id: atom.id,
    present: content.includes(atom.snippet),
  };
});
details.leftover_atoms_preserved = leftoverWorktreeResults;
checks.leftover_atoms_preserved = leftoverWorktreeResults.every((result) => result.present);

const uncommittedDiff = workingCopyDiff(repoDir);
const targetDiffResults = atoms.target.map((atom) => ({
  id: atom.id,
  absent: !uncommittedDiff.includes(atom.snippet),
}));
details.target_atoms_not_left_uncommitted = targetDiffResults;
checks.target_atoms_not_left_uncommitted = targetDiffResults.every((result) => result.absent);

checks.no_unresolved_conflicts = gitText(repoDir, ["ls-files", "-u"]) === "";
checks.no_operation_in_progress = noOperationInProgress(repoDir);
checks.no_stash_left_behind = noStashLeftBehind(repoDir);
details.status_porcelain = gitText(repoDir, ["status", "--porcelain=v2", "--branch"]);

const failureClass = classify(checks);
const result = {
  passed: failureClass === null,
  failure_class: failureClass,
  score: score(checks),
  checks,
  minefields: minefieldReport(checks, MINEFIELD_CHECKS),
  details,
};

console.log(JSON.stringify(result, null, 2));
process.exit(result.passed ? 0 : 1);
