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
    'Which version-control tool should you give your coding agent? Claude Code and Codex run the same five version-control tasks three ways — with plain git, with Jujutsu, and with GitButler. Only the tool changes.',
    'All three turn out reliable — 299 of 300 runs passed — so the separator is speed: GitButler ran about 60% faster than git with roughly 80% fewer commands; Jujutsu ran slower than git.',
  ],
};

// The results matrix: 5 tasks (rows) x 3 tools, each with pass, time, commands, KB.
export const RESULTS = {
  eyebrow: 'Results',
  title: 'Results matrix',
  columns: {
    pass: 'Reliability: share of runs that produced the exact history the instruction asked for.',
    time: 'Speed: mean wall-clock time per run, setup excluded.',
    cmds: 'Version-control commands the agent ran per run — fewer usually means less time and output.',
    kb: 'Efficiency: kilobytes of version-control output the agent read back per run (skill reads excluded) — a token-cost proxy, comparable within one agent only.',
  },
};

export const SCENARIOS_INTRO = {
  title: 'Scenarios',
  lede: 'Each scenario is a pre-built Git repository plus a plain-English instruction. No code is written during a run — only the version-control operation is measured.',
};

export const METHOD = {
  title: 'Method',
  lede: 'A hidden, deterministic grader scores the final Git state, so two command sequences pass if they produce the same history. Every tool gets the same task and plain-English instruction, its name never appears in the prompt, and setup is excluded from timing.',
  facts: [
    {
      term: 'Identical instruction across tools',
      body: 'Each task is one prepared repository plus one plain-English instruction ("commit just the input-validation work on a new branch, leave the rest uncommitted"). The tool’s name never appears; the agent decides how to carry it out.',
    },
    {
      term: 'Deterministic grader',
      body: 'A hidden, scripted check that returns the same verdict for the same final state — no LLM judge. It inspects commit boundaries, branch topology, and what stayed uncommitted; it never compares commands against a reference.',
    },
    {
      term: 'Timing boundary',
      body: 'Fixture build, workspace prep, skill install, and placing the uncommitted changes all happen before timing starts. The figures cover only the agent’s work on the task.',
    },
    {
      term: 'Git write restriction',
      body: 'In GitButler and Jujutsu runs, raw git write commands are blocked, so the agent must use the tool under test. Git the tool calls internally is the tool’s own work, not the agent’s.',
    },
    {
      term: 'Jujutsu setup',
      body: 'jj 0.42.0, a colocated repository (jj and git on the same working copy), and the most-installed external jj skill, all in place before timing.',
    },
    {
      term: 'Repeated runs per cell',
      body: 'Each agent–tool–scenario cell runs several times (k, shown above); the figures are means over those runs, with a Wilson 95% interval on each pass rate.',
    },
  ],
};

export const LEDGER = {
  title: 'Failed runs',
  // lede is derived from the data in the component so it never goes stale.
  emptyLede: 'No runs failed the grader in this batch.',
};

export const AGENT_NOTE =
  'Both agents run the same matrix to check the tool effect holds across models — not a Claude-versus-Codex comparison.';

// Section kicker labels (rendered uppercase mono above each heading).
export const EYEBROWS = {
  scenarios: 'Scenarios',
  method: 'Method',
  proof: 'Results',
  failures: 'Failures',
  provenance: 'About',
};

// Every full-matrix batch, newest first. Links go to the checked-in writeups
// so the page shows the benchmark is versioned and re-run, not a one-shot.
const resultDocUrl = (name: string) => `${REPO_URL}/blob/main/docs/results/${name}`;
export const HISTORY = {
  title: 'Results history',
  entries: [
    { date: '2026-07-06', scope: 'k=10 · Opus 4.8 · GPT-5.5', passed: '299/300', url: resultDocUrl('full-k10-2026-07-06.md'), current: true },
    { date: '2026-07-05', scope: 'k=8 · Opus 4.8 · GPT-5.5', passed: '239/240', url: resultDocUrl('full-k8-2026-07-05.md') },
    { date: '2026-07-03', scope: 'k=7 · Opus 4.1 · GPT-5.5', passed: '193/210', url: resultDocUrl('full-k7-2026-07-03.md') },
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
  lede: 'Most benchmarks here hold the tool constant and compare models; this one holds the agents constant and compares the tools — the question a team faces once the agent is chosen.',
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
  reproduceTitle: 'About this benchmark',
};
