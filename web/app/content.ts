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
    'Which version-control tool should you give your coding agent? This benchmark holds the agents fixed — Claude Code and Codex — and varies the toolset: plain git, Jujutsu, and GitButler, each scored on reliability, speed, and efficiency across five common version-control operations. Other benchmarks fix the tool and compare models; this one fixes the agents and compares the tools.',
    'The sharpest finding in the latest run: Claude Code failed to split a commit correctly with plain git in five of seven attempts, and with Jujutsu in six of seven. With GitButler it succeeded in all seven. Codex passed every run with every tool, so for Codex the tools differ only in speed and command count.',
    'Every run is judged by a deterministic grader on the resulting Git history, not on the commands used to produce it. This is not a coding benchmark — the file changes exist before the agent starts — and not a Claude-versus-Codex comparison.',
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
  lede: 'This benchmark is built and maintained by GitButler, one of the three tools it measures — read everything below with that in mind, and check rather than trust: tasks, grader, harness, and per-run evidence are public. Correctness is scored by a hidden, deterministic grader on the final Git state; two different command sequences pass if they produce the same history. Every tool receives the same task and the same plain-English instruction, the tool name does not appear in the prompt, and setup is excluded from timing.',
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

// Known limits, stated so they are priced in rather than discovered. Scope
// critiques are welcome; honesty critiques should find nothing to add.
export const LIMITS = {
  title: 'Limitations',
  lede: 'Every benchmark measures a slice. These are the known limits of this one.',
  items: [
    {
      term: 'Built by a contestant',
      body: 'GitButler funds and maintains this benchmark and is one of the three tools measured. Treat every design choice as potentially biased, and check rather than trust: the tasks, grader, harness, and per-run evidence are public, and any cell can be re-run from the repository.',
    },
    {
      term: 'Five scenarios',
      body: 'Five operations is a small sample of version-control work. Per-cell pass intervals are wide, and most cross-scenario effect sizes (the statistical read above) do not reach significance. Claims on this page are about these five operations, not version control in general. The task set is growing.',
    },
    {
      term: 'Skill asymmetry',
      body: 'GitButler runs with its first-party agent skill; Jujutsu runs with the most-installed community skill, pinned to a fixed revision and verified by hash; git runs bare, as the tool agents already know best. A better skill for any arm would change its numbers. Improvements to any arm’s configuration are welcome as pull requests — each tool should be measured at its community’s best agent setup.',
    },
    {
      term: 'Training data favors git',
      body: 'The models have seen far more git than Jujutsu or GitButler in training. The deck is stacked toward the baseline: challenger wins are stronger evidence than they look, and challenger losses are partly unfamiliarity.',
    },
    {
      term: 'Synthetic fixtures',
      body: 'Scenarios are small, script-built TypeScript repositories. That keeps runs deterministic and contamination-resistant, but real repositories are bigger and noisier. Scenarios derived from real repositories are planned.',
    },
    {
      term: 'Codex is at the ceiling',
      body: 'Codex passed every run of every scenario, so for Codex this benchmark currently separates the tools only on speed and efficiency. Harder scenarios are needed before the reliability comparison says anything about stronger agents.',
    },
    {
      term: 'Versions, not verdicts',
      body: 'Each result is a property of a specific agent version, model, tool build, and skill revision, all recorded in provenance. Newer models can change the picture; the benchmark is re-run as they ship.',
    },
    {
      term: 'What a pass does not measure',
      body: 'The grader checks the final Git state only. Commit-message quality, human ergonomics, merge and remote workflows, and long-horizon multi-branch work are not measured yet.',
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
  limitations: 'Limitations',
  provenance: 'About',
};

// Every full-matrix batch, newest first. Links go to the checked-in writeups
// so the page shows the benchmark is versioned and re-run, not a one-shot.
const resultDocUrl = (name: string) => `${REPO_URL}/blob/main/docs/results/${name}`;
export const HISTORY = {
  title: 'Results history',
  lede: 'Every full-matrix batch is written up and checked in; the page above always shows the latest.',
  entries: [
    { date: '2026-07-03', scope: 'k=7 · 3 tools · 2 agents', passed: '193/210', url: resultDocUrl('full-k7-2026-07-03.md'), current: true },
    { date: '2026-07-01', scope: 'k=5 · 3 tools · 2 agents', passed: '137/150', url: resultDocUrl('full-k5-2026-07-01.md') },
    { date: '2026-06-29', scope: 'k=5 · 3 tools · 2 agents', passed: '142/150', url: resultDocUrl('full-k5-2026-06-29.md') },
    { date: '2026-06-28', scope: 'k=5 · git + GitButler', passed: '100/100', url: resultDocUrl('full-k5-2026-06-28.md') },
    { date: '2026-06-27', scope: 'k=5 · git + GitButler', passed: '99/100', url: resultDocUrl('full-k5-2026-06-27.md') },
    { date: '2026-06-26', scope: 'k=5 · git + GitButler', passed: '95/100', url: resultDocUrl('full-k5-2026-06-26.md') },
    { date: '2026-06-22', scope: 'k=3 · git + GitButler', passed: '60/60', url: resultDocUrl('full-k3-2026-06-22.md') },
  ],
};

// Neighbors in the benchmark landscape. Named generously: they answer
// different questions, and saying how earns the comparison back.
export const RELATED = {
  title: 'How this relates to other benchmarks',
  lede: 'Most benchmarks in this space fix the tool and compare models. This one fixes the agents and compares the tools — the question a team faces once the agent is already chosen.',
  items: [
    {
      name: 'jj-benchmark',
      by: 'TabbyML',
      url: 'https://github.com/TabbyML/jj-benchmark',
      read: 'Fixes one tool (Jujutsu) and compares models on operating it.',
    },
    {
      name: 'GitBench',
      by: 'GitKraken',
      url: 'https://gitbench.gitkraken.com/',
      read: 'Single-turn git question answering across models; no multi-turn tool use.',
    },
    {
      name: 'GitGoodBench',
      by: 'JetBrains Research',
      url: 'https://github.com/JetBrains-Research/git-good-bench',
      read: 'Scores models on git tasks mined from real repositories.',
    },
    {
      name: 'Terminal-Bench',
      by: 'Stanford / Laude Institute',
      url: 'https://www.tbench.ai/',
      read: 'General terminal agents across many task types; a handful touch version control.',
    },
  ],
};

// The k=7 batch predates per-run model capture for Claude; the model is known
// from Claude Code session metadata (see docs/results/full-k7-2026-07-03.md).
// Once a batch with per-run capture lands, observed_model populates and this
// fallback goes unused.
export const MODEL_FALLBACK: Record<string, string> = {
  claude: 'claude-opus-4-1-20250805 (from session metadata)',
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
