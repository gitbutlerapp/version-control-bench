#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { git } from "./lib/process.mjs";
import { EXPECTED_BRANCH_FILES, EXPECTED_COMMIT_SUBJECTS, MAIN_FILES, SQUASHED_SOURCE_SUBJECTS, TASK_BRANCH } from "./lib/pilot5-content.mjs";

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

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function commitExpectationsFromEditAtoms(editAtoms) {
  return Object.fromEntries((editAtoms.commits ?? []).map((atom) => [
    atom.commit,
    {
      paths: atom.paths ?? [],
      snippets: atom.snippets ?? [],
    },
  ]));
}

function gitMaybe(repoDir, args) {
  const result = git(repoDir, args, { check: false });
  return result.status === 0 ? result.stdout : null;
}

function gitText(repoDir, args) {
  return git(repoDir, args).stdout.trimEnd();
}

function gitShow(repoDir, ref, filePath) {
  return gitMaybe(repoDir, ["show", `${ref}:${filePath}`]);
}

function fileText(repoDir, filePath) {
  const fullPath = path.join(repoDir, filePath);
  return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : null;
}

function sameArray(actual, expected) {
  return actual.length === expected.length && actual.every((value, index) => value === expected[index]);
}

function sameSet(actual, expected) {
  if (actual.length !== expected.length) return false;
  const expectedSet = new Set(expected);
  return actual.every((item) => expectedSet.has(item));
}

function commitPatch(repoDir, hash) {
  return gitText(repoDir, ["show", "--format=", "--unified=0", "--no-ext-diff", hash]);
}

function patchChangedText(patch) {
  return patch
    .split("\n")
    .filter((line) => /^[+-]/.test(line) && !line.startsWith("+++") && !line.startsWith("---"))
    .join("\n");
}

function commitChangedPaths(repoDir, hash) {
  return gitText(repoDir, ["show", "--format=", "--name-only", hash])
    .split("\n")
    .filter(Boolean)
    .sort();
}

function classify(checks) {
  if (
    !checks.git_repo
    || !checks.main_exists
    || !checks.main_has_single_commit
    || !checks.main_tree_matches_fixture
    || !checks.task_branch_exists
  ) {
    return "ENV_FAILURE";
  }
  if (
    !checks.branch_has_expected_commit_count
    || !checks.commit_subjects_match
    || !checks.source_subjects_removed
    || !checks.no_merge_commits
  ) {
    return "GRAPH_WRONG";
  }
  if (
    !checks.branch_tree_matches_target
    || !checks.worktree_matches_target
    || !checks.commit_paths_match
    || !checks.commit_snippets_present
  ) {
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
    main_tree_matches_fixture: 5,
    task_branch_exists: 5,
    branch_has_expected_commit_count: 15,
    commit_subjects_match: 20,
    source_subjects_removed: 15,
    no_merge_commits: 5,
    branch_tree_matches_target: 15,
    worktree_matches_target: 10,
    commit_paths_match: 15,
    commit_snippets_present: 15,
    snippets_not_in_wrong_commits: 10,
    no_dirty_changes: 10,
    no_unresolved_conflicts: 5,
  };

  let total = 0;
  for (const [key, value] of Object.entries(checks)) {
    if (value && weights[key]) total += weights[key];
  }
  return total;
}

const args = parseArgs(process.argv.slice(2));
const repoDir = path.resolve(args.get("repo") ?? ".");
const taskDir = path.resolve(args.get("task") ?? "tasks/pilot-5-squash-commits");
const oracle = readJson(path.join(taskDir, "oracle/oracle.json"));
const editAtoms = readJson(path.join(taskDir, "oracle/edit-atoms.json"));
const commitExpectations = commitExpectationsFromEditAtoms(editAtoms);

const checks = {};
const details = {};

checks.git_repo = gitMaybe(repoDir, ["rev-parse", "--git-dir"]) !== null;
checks.main_exists = gitMaybe(repoDir, ["rev-parse", "--verify", "refs/heads/main"]) !== null;
checks.main_has_single_commit = checks.main_exists && gitText(repoDir, ["rev-list", "--count", "main"]) === "1";

const expectedMainPaths = Object.keys(MAIN_FILES).sort();
const actualMainPaths = checks.main_exists
  ? gitText(repoDir, ["ls-tree", "-r", "--name-only", "main"]).split("\n").filter(Boolean).sort()
  : [];
details.main_tree_paths = actualMainPaths;
const mainTreeFileResults = expectedMainPaths.map((filePath) => ({
  path: filePath,
  matches: gitShow(repoDir, "main", filePath) === MAIN_FILES[filePath],
}));
details.main_tree_file_results = mainTreeFileResults;
checks.main_tree_matches_fixture = sameSet(actualMainPaths, expectedMainPaths) && mainTreeFileResults.every((result) => result.matches);

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
const sourceSubjects = oracle.squashed_source_subjects ?? SQUASHED_SOURCE_SUBJECTS;
details.commit_subjects = commitSubjects;
checks.branch_has_expected_commit_count = commits.length === expectedSubjects.length;
checks.commit_subjects_match = sameArray(commitSubjects, expectedSubjects);
details.source_subjects_still_reachable = commitSubjects.filter((subject) => sourceSubjects.includes(subject));
checks.source_subjects_removed = details.source_subjects_still_reachable.length === 0;
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
checks.commit_paths_match = pathResults.every((result) => result.matches);

const snippetResults = Object.entries(commitExpectations).flatMap(([subject, expectation]) => {
  const changedText = changedTextBySubject.get(subject) ?? "";
  return expectation.snippets.map((snippet) => ({
    subject,
    snippet,
    present: changedText.includes(snippet),
  }));
});
details.commit_snippet_results = snippetResults;
checks.commit_snippets_present = snippetResults.every((result) => result.present);

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

const worktreePaths = gitText(repoDir, ["ls-files"]).split("\n").filter(Boolean).sort();
details.worktree_paths = worktreePaths;
details.worktree_file_results = expectedTreePaths.map((filePath) => ({
  path: filePath,
  matches: fileText(repoDir, filePath) === EXPECTED_BRANCH_FILES[filePath],
}));
checks.worktree_matches_target = sameSet(worktreePaths, expectedTreePaths)
  && details.worktree_file_results.every((result) => result.matches);

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
