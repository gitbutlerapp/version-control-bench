#!/usr/bin/env node
import path from "node:path";
import { parseArgs } from "./lib/args.mjs";
import { EXPECTED_BRANCH_FILES, EXPECTED_COMMIT_SUBJECTS, TASK_BRANCH } from "./lib/pilot4-content.mjs";
import {
  commitChangedPaths,
  commitExpectationsFromEditAtoms,
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
} from "./lib/verifier.mjs";

function classify(checks) {
  if (!checks.git_repo || !checks.main_exists || !checks.main_has_single_commit || !checks.task_branch_exists) {
    return "ENV_FAILURE";
  }
  if (!checks.branch_has_expected_commit_count || !checks.commit_subjects_reordered || !checks.no_merge_commits) {
    return "GRAPH_WRONG";
  }
  if (!checks.branch_tree_matches_target || !checks.commit_paths_preserved || !checks.commit_snippets_preserved) {
    return "CONTENT_WRONG";
  }
  if (!checks.snippets_not_in_wrong_commits) {
    return "PARTITION_WRONG";
  }
  if (!checks.no_dirty_changes || !checks.no_unresolved_conflicts) {
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
    commit_subjects_reordered: 20,
    no_merge_commits: 5,
    branch_tree_matches_target: 15,
    commit_paths_preserved: 15,
    commit_snippets_preserved: 15,
    snippets_not_in_wrong_commits: 10,
    no_dirty_changes: 10,
    no_unresolved_conflicts: 5,
  };

  return weightedScore(checks, weights);
}

const args = parseArgs(process.argv.slice(2));
const repoDir = path.resolve(args.get("repo") ?? ".");
const taskDir = path.resolve(args.get("task") ?? "tasks/pilot-4-reorder-commits");
const oracle = readJson(path.join(taskDir, "oracle/oracle.json"));
const editAtoms = readJson(path.join(taskDir, "oracle/edit-atoms.json"));
const commitExpectations = commitExpectationsFromEditAtoms(editAtoms);

const checks = {};
const details = {};

checks.git_repo = gitMaybe(repoDir, ["rev-parse", "--git-dir"]) !== null;
checks.main_exists = gitMaybe(repoDir, ["rev-parse", "--verify", "refs/heads/main"]) !== null;
checks.main_has_single_commit = checks.main_exists && gitText(repoDir, ["rev-list", "--count", "main"]) === "1";

const branch = oracle.task_branch ?? TASK_BRANCH;
details.task_branch = branch;
checks.task_branch_exists = gitMaybe(repoDir, ["rev-parse", "--verify", `refs/heads/${branch}`]) !== null;

let commits = [];
let commitSubjects = [];
let patchesBySubject = new Map();
let changedTextBySubject = new Map();
let pathsBySubject = new Map();
if (checks.task_branch_exists) {
  commits = gitText(repoDir, ["rev-list", "--reverse", `main..${branch}`])
    .split("\n")
    .filter(Boolean);
  commitSubjects = commits.map((hash) => gitText(repoDir, ["log", "-1", "--format=%s", hash]));
  patchesBySubject = new Map(commits.map((hash, index) => [commitSubjects[index], commitPatch(repoDir, hash)]));
  changedTextBySubject = new Map([...patchesBySubject.entries()].map(([subject, patch]) => [subject, patchChangedText(patch)]));
  pathsBySubject = new Map(commits.map((hash, index) => [commitSubjects[index], commitChangedPaths(repoDir, hash)]));
}

const expectedSubjects = oracle.commit_subjects ?? EXPECTED_COMMIT_SUBJECTS;
details.commit_subjects = commitSubjects;
checks.branch_has_expected_commit_count = commits.length === expectedSubjects.length;
checks.commit_subjects_reordered = sameArray(commitSubjects, expectedSubjects);
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

const pathResults = Object.entries(commitExpectations).map(([subject, expectation]) => ({
  subject,
  expected_paths: expectation.paths.slice().sort(),
  actual_paths: pathsBySubject.get(subject) ?? [],
  matches: sameArray(pathsBySubject.get(subject) ?? [], expectation.paths.slice().sort()),
}));
details.commit_path_results = pathResults;
checks.commit_paths_preserved = pathResults.every((result) => result.matches);

const snippetResults = Object.entries(commitExpectations).flatMap(([subject, expectation]) => {
  const changedText = changedTextBySubject.get(subject) ?? "";
  return expectation.snippets.map((snippet) => ({
    subject,
    snippet,
    present: changedText.includes(snippet),
  }));
});
details.commit_snippet_results = snippetResults;
checks.commit_snippets_preserved = snippetResults.every((result) => result.present);

const wrongSnippetResults = Object.entries(commitExpectations).flatMap(([subject, expectation]) => {
  const wrongSubjects = expectedSubjects.filter((candidate) => candidate !== subject);
  return expectation.snippets.map((snippet) => ({
    subject,
    snippet,
    offenders: wrongSubjects.filter((candidate) => (changedTextBySubject.get(candidate) ?? "").includes(snippet)),
  }));
});
details.snippets_not_in_wrong_commits = wrongSnippetResults;
checks.snippets_not_in_wrong_commits = wrongSnippetResults.every((result) => result.offenders.length === 0);

details.status_porcelain = gitText(repoDir, ["status", "--porcelain"]);
checks.no_dirty_changes = details.status_porcelain === "";
checks.no_unresolved_conflicts = gitText(repoDir, ["ls-files", "-u"]) === "";

details.worktree_file_results = expectedTreePaths.map((filePath) => ({
  path: filePath,
  matches: fileText(repoDir, filePath) === EXPECTED_BRANCH_FILES[filePath],
}));

const failureClass = classify(checks);
const result = {
  passed: failureClass === null,
  failure_class: failureClass,
  score: score(checks),
  checks,
  details,
};

console.log(JSON.stringify(result, null, 2));
process.exit(result.passed ? 0 : 1);
