// Page copy. Register: a benchmark report, declarative and precise, defined
// terms used consistently, accessible to a non-specialist. The benchmark is
// the subject; GitButler is one of three tools plus a single flat disclosure.

// Public benchmark repository. Each scenario id is also its task directory name.
export const REPO_URL = 'https://github.com/gitbutlerapp/version-control-bench';
export const taskDefUrl = (scenarioId: string) =>
  `${REPO_URL}/tree/main/tasks/${scenarioId}`;

// Homepage / docs for each measured tool, linked from the results-matrix headers.
export const TOOL_URL: Record<string, string> = {
  git: 'https://git-scm.com/',
  'jj+skill': 'https://www.jj-vcs.dev/latest/',
  'but+skill': 'https://docs.gitbutler.com/ai-agents/overview',
};

export const HERO = {
  title: 'A version-control benchmark for coding agents',
  intro: [
    'Coding agents do a growing share of version-control work. This benchmark measures how Claude Code and Codex handle five common version-control tasks with git, Jujutsu, and GitButler.',
    'Each tool is scored on reliability, speed, and efficiency, judged on the resulting Git history rather than the commands used to produce it.',
  ],
};

// The results matrix: 5 tasks (rows) x 3 tools, each with pass, time, commands, KB.
export const RESULTS = {
  eyebrow: 'Results',
  title: 'Results matrix',
  lede: 'Each tool on each scenario, for the selected agent.',
  columns: {
    pass: 'Reliability: the share of the seven runs that produced the exact history specified by the instruction.',
    time: 'Speed: mean wall-clock time per run, with setup excluded.',
    cmds: 'Count of version-control commands the agent ran per run. Fewer commands generally correspond to lower wall-clock time and less output.',
    kb: 'Efficiency: kilobytes of version-control output the agent read back per run (skill reads excluded), a proxy for token cost. Comparable within one agent only.',
  },
};

export const SCENARIOS_INTRO = {
  title: 'Scenarios',
  lede: 'Each scenario is a pre-built Git repository (a commit history plus uncommitted changes) and a plain-English instruction describing the intended result. No code is generated during a run; only the version-control operation is measured.',
};

export const METHOD = {
  title: 'Method',
  lede: 'Correctness is scored by a hidden, deterministic grader on the final Git state; two different command sequences pass if they produce the same history. Every tool receives the same task and the same plain-English instruction, the tool name does not appear in the prompt, and setup is excluded from timing.',
  facts: [
    {
      term: 'Identical instruction across tools',
      body: 'Each task ships as one prepared repository (the fixture) with one plain-English instruction ("commit just the input validation work on a new branch, leave the rest uncommitted"). The tool\'s name does not appear in the prompt. The agent decides how to carry out the instruction.',
    },
    {
      term: 'Deterministic grader',
      body: "Correctness is checked by a hidden, deterministic grader: a scripted check that returns the same verdict for the same final state. It inspects the resulting Git state: commit boundaries, branch topology (which commits sit on which branch, in what order), and what stayed uncommitted. It is not an LLM judge, and it does not compare the agent's commands against a reference sequence: two different command sequences pass if they produce the same history.",
    },
    {
      term: 'Timing boundary',
      body: "Building the fixture, preparing the workspace, installing each tool's skill (an instruction file documenting the tool's commands), and placing the uncommitted changes in the working tree all happen before timing begins. The measured figures cover only the agent's work on the task.",
    },
    {
      term: 'Git write restriction',
      body: "In runs using GitButler or Jujutsu, raw git write commands are blocked, so the agent must use the tool under test. When the tool calls git internally, that is the tool's own work and does not count against the agent.",
    },
    {
      term: 'Jujutsu setup',
      body: 'jj 0.42.0, a colocated repository (jj and git operating on the same working copy), and the most-used external jj agent skill, installed before timing begins.',
    },
    {
      term: 'Seven runs per cell (k=7)',
      body: 'Each agent–tool–task combination (a cell) ran seven times. The numbers on this page are means over those seven runs, not a single run.',
    },
    {
      term: 'Uncertainty',
      body: 'Pass rates carry Wilson 95% intervals (hover any pass chip). Runs of the same scenario are correlated, so cross-scenario claims pair per-scenario deltas against the same agent’s git runs; with five scenarios those intervals are wide, and the "statistical read" under the results matrix shows them. Wall-time deltas are consistent in direction across scenarios, but their effect size is measured on these five operations only.',
    },
  ],
};

export const LEDGER = {
  title: 'Failed runs',
  lede: 'Seventeen of 210 runs failed the grader. Every grader failure was Claude; GitButler had zero verifier misses.',
  proportionality:
    'Plain git failed 7 verifier checks: Claude split-commit failed 5/7, selective commit failed 1/7, and multi-amend failed 1/7. Jujutsu failed 10: Claude split-commit failed 6/7, selective commit failed 2/7, multi-amend failed 1/7, and squash failed 1/7.',
};

export const AGENT_NOTE =
  'Both agents are run to check whether the tool effect holds across them. This is not a Claude-versus-Codex comparison.';

// Section kicker labels (rendered uppercase mono above each heading).
export const EYEBROWS = {
  scenarios: 'Scenarios',
  method: 'Method',
  proof: 'Results',
  failures: 'Failures',
  provenance: 'About',
};

// Small inline strings used across components.
export const MICRO = {
  promptLabel: 'Instruction given to the agent',
  lowerIsBetter: 'lower is better',
  reproduceTitle: 'About this benchmark',
  reproduceLede:
    'The numbers above are derived from the latest full-matrix aggregate. The source snapshot and commands that produced them are listed below.',
  footerNote:
    'Maintained by GitButler, one of the three tools measured; the grader is deterministic and the data is public.',
};
