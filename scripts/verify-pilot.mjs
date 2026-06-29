#!/usr/bin/env node
import path from "node:path";
import { parseArgs } from "./lib/args.mjs";
import { fileText, gitMaybe, gitShow, gitText, readJson, sameSet, weightedScore, workingCopyDiff } from "./lib/verifier.mjs";

function classify(checks) {
  if (!checks.git_repo || !checks.main_exists || !checks.main_has_single_commit) return "ENV_FAILURE";
  if (!checks.has_exactly_one_task_branch || !checks.branch_has_one_commit_ahead) return "REF_WRONG";
  if (!checks.no_merge_commits || !checks.commit_changed_only_target_paths) return "GRAPH_WRONG";
  if (!checks.target_atoms_committed) return "CONTENT_WRONG";
  if (!checks.leftover_atoms_not_committed) return "PARTITION_WRONG";
  if (!checks.leftover_atoms_preserved || !checks.target_atoms_not_left_uncommitted) return "DIRTY_STATE_WRONG";
  if (!checks.commit_message_semantic) return "METADATA_WRONG";
  if (!checks.no_unresolved_conflicts) return "DIRTY_STATE_WRONG";
  return null;
}

function score(checks) {
  const weights = {
    git_repo: 5,
    main_exists: 5,
    main_has_single_commit: 5,
    has_exactly_one_task_branch: 10,
    branch_has_one_commit_ahead: 10,
    no_merge_commits: 5,
    commit_changed_only_target_paths: 10,
    target_atoms_committed: 15,
    leftover_atoms_not_committed: 15,
    leftover_atoms_preserved: 10,
    target_atoms_not_left_uncommitted: 5,
    commit_message_semantic: 3,
    no_unresolved_conflicts: 2,
  };

  return weightedScore(checks, weights);
}

const args = parseArgs(process.argv.slice(2));
const repoDir = path.resolve(args.get("repo") ?? ".");
const taskDir = path.resolve(args.get("task") ?? "tasks/pilot-1-selective-validation");
const oracle = readJson(path.join(taskDir, "oracle/oracle.json"));
const atoms = readJson(path.join(taskDir, "oracle/edit-atoms.json"));

const checks = {};
const details = {};

checks.git_repo = gitMaybe(repoDir, ["rev-parse", "--git-dir"]) !== null;
checks.main_exists = gitMaybe(repoDir, ["rev-parse", "--verify", "refs/heads/main"]) !== null;
checks.main_has_single_commit = checks.main_exists && gitText(repoDir, ["rev-list", "--count", "main"]) === "1";

const allBranches = checks.git_repo
  ? gitText(repoDir, ["for-each-ref", "--format=%(refname:short)", "refs/heads"])
      .split("\n")
      .filter(Boolean)
  : [];
const taskBranches = allBranches.filter((branch) => branch !== "main" && !branch.startsWith("gitbutler/"));
details.branches = allBranches;
details.task_branches = taskBranches;

checks.has_exactly_one_task_branch = taskBranches.length === oracle.expected_new_branch_count;
const branch = taskBranches[0] ?? null;
details.task_branch = branch;

if (branch) {
  checks.branch_has_one_commit_ahead =
    gitMaybe(repoDir, ["merge-base", "--is-ancestor", "main", branch]) !== null &&
    gitText(repoDir, ["rev-list", "--count", `main..${branch}`]) === String(oracle.expected_commits_ahead_of_main);
  checks.no_merge_commits = gitText(repoDir, ["rev-list", "--merges", `main..${branch}`]) === "";
  const changedPaths = gitText(repoDir, ["diff-tree", "--no-commit-id", "--name-only", "-r", branch])
    .split("\n")
    .filter(Boolean)
    .sort();
  details.changed_paths = changedPaths;
  checks.commit_changed_only_target_paths = sameSet(changedPaths, ["README.md", "src/handler.ts", "tests/handler.test.ts"]);

  const message = gitText(repoDir, ["log", "-1", "--format=%s", branch]).toLowerCase();
  details.commit_message = message;
  checks.commit_message_semantic = oracle.message_terms_any.some((term) => message.includes(term));

  const targetResults = atoms.target.map((atom) => {
    const content = gitShow(repoDir, branch, atom.path) ?? "";
    return { id: atom.id, present: content.includes(atom.snippet) };
  });
  details.target_atoms = targetResults;
  checks.target_atoms_committed = targetResults.every((result) => result.present);

  const leftoverCommitResults = atoms.leftover.map((atom) => {
    const content = gitShow(repoDir, branch, atom.path);
    return { id: atom.id, absent: content === null || !content.includes(atom.snippet) };
  });
  details.leftover_atoms_not_committed = leftoverCommitResults;
  checks.leftover_atoms_not_committed = leftoverCommitResults.every((result) => result.absent);
} else {
  checks.branch_has_one_commit_ahead = false;
  checks.no_merge_commits = false;
  checks.commit_changed_only_target_paths = false;
  checks.commit_message_semantic = false;
  checks.target_atoms_committed = false;
  checks.leftover_atoms_not_committed = false;
}

const leftoverWorktreeResults = atoms.leftover.map((atom) => {
  const content = fileText(repoDir, atom.path) ?? "";
  return { id: atom.id, present: content.includes(atom.snippet) };
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
details.status_porcelain = gitText(repoDir, ["status", "--porcelain=v2", "--branch"]);

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
