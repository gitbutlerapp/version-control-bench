export const TASK_BRANCH = "squash-series";

export const MAIN_FILES = {
  "README.md": `# Import Pipeline

Tiny TypeScript repo used by the squash-commit benchmark pilot.
`,

  "package.json": `{
  "name": "import-pipeline",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "test": "node tests/token.test.ts && node tests/parser.test.ts && node tests/exporter.test.ts && node tests/retry.test.ts"
  },
  "dependencies": {},
  "devDependencies": {}
}
`,
};

export const TOKEN_FILES = {
  ...MAIN_FILES,

  "src/token.ts": `export interface ParsedToken {
  kind: "email" | "name";
  value: string;
}

export function normalizeToken(value: string): string {
  return value.trim().toLowerCase();
}
`,

  "tests/token.test.ts": `import { normalizeToken } from "../src/token";

export function testNormalizeToken(): void {
  const normalized = normalizeToken(" ADA@EXAMPLE.COM ");

  if (normalized !== "ada@example.com") {
    throw new Error(\`unexpected normalized token: \${normalized}\`);
  }
}
`,
};

export const PARSER_HELPERS_FILES = {
  ...TOKEN_FILES,

  "src/parser.ts": `import { normalizeToken } from "./token";

export function splitRecordLine(line: string): string[] {
  return line.split(",").map((part) => normalizeToken(part));
}
`,
};

export const PARSER_PIPELINE_FILES = {
  ...PARSER_HELPERS_FILES,

  "src/parser.ts": `import { normalizeToken } from "./token";

export interface CustomerRecord {
  email: string;
  name: string;
}

export function splitRecordLine(line: string): string[] {
  return line.split(",").map((part) => normalizeToken(part));
}

export function parseCustomerRecord(line: string): CustomerRecord {
  const [email, name] = splitRecordLine(line);
  return { email, name };
}
`,

  "tests/parser.test.ts": `import { parseCustomerRecord } from "../src/parser";

export function testParseCustomerRecord(): void {
  const record = parseCustomerRecord(" ADA@EXAMPLE.COM , Ada Lovelace ");

  if (record.email !== "ada@example.com" || record.name !== "ada lovelace") {
    throw new Error("customer record was not parsed");
  }
}
`,
};

export const EXPORT_FILES = {
  ...PARSER_PIPELINE_FILES,

  "src/exporter.ts": `import { CustomerRecord } from "./parser";

export function exportRecords(records: CustomerRecord[]): string {
  return records.map((record) => \`\${record.email}|\${record.name}\`).join("\\n");
}
`,

  "tests/exporter.test.ts": `import { exportRecords } from "../src/exporter";

export function testExportRecords(): void {
  const output = exportRecords([{ email: "ada@example.com", name: "ada lovelace" }]);

  if (output !== "ada@example.com|ada lovelace") {
    throw new Error("records were not exported");
  }
}
`,
};

export const RETRY_OPTION_FILES = {
  ...EXPORT_FILES,

  "src/retry.ts": `export interface RetryOption {
  attempts: number;
  delayMs: number;
}

export function parseRetryOption(value: string): RetryOption {
  const attempts = Number.parseInt(value, 10);
  return {
    attempts,
    delayMs: attempts * 500,
  };
}
`,
};

export const RETRY_TEST_FILES = {
  ...RETRY_OPTION_FILES,

  "tests/retry.test.ts": `import { parseRetryOption } from "../src/retry";

export function testParseRetryOption(): void {
  const option = parseRetryOption("4");

  if (option.attempts !== 4 || option.delayMs !== 2_000) {
    throw new Error("retry option was not parsed");
  }
}
`,
};

export const RETRY_DOC_FILES = {
  ...RETRY_TEST_FILES,

  "README.md": `# Import Pipeline

Tiny TypeScript repo used by the squash-commit benchmark pilot.

Retry options are documented in docs/retry-options.md.
`,

  "docs/retry-options.md": `# Retry Options

Import jobs can specify retry attempts. Each retry attempt waits 500 milliseconds longer than the previous schedule slot.
`,
};

export const INITIAL_COMMIT_STATES = [
  {
    subject: "add parser token model",
    files: TOKEN_FILES,
  },
  {
    subject: "extract parser helpers",
    files: PARSER_HELPERS_FILES,
  },
  {
    subject: "wire parser helpers",
    files: PARSER_PIPELINE_FILES,
  },
  {
    subject: "add export endpoint",
    files: EXPORT_FILES,
  },
  {
    subject: "add retry option",
    files: RETRY_OPTION_FILES,
  },
  {
    subject: "test retry option",
    files: RETRY_TEST_FILES,
  },
  {
    subject: "document retry option",
    files: RETRY_DOC_FILES,
  },
];

export const EXPECTED_COMMIT_STATES = [
  {
    subject: "add parser token model",
    files: TOKEN_FILES,
  },
  {
    subject: "add parser pipeline",
    files: PARSER_PIPELINE_FILES,
  },
  {
    subject: "add export endpoint",
    files: EXPORT_FILES,
  },
  {
    subject: "add retry support",
    files: RETRY_DOC_FILES,
  },
];

export const EXPECTED_COMMIT_SUBJECTS = EXPECTED_COMMIT_STATES.map((state) => state.subject);

export const SQUASHED_SOURCE_SUBJECTS = [
  "extract parser helpers",
  "wire parser helpers",
  "add retry option",
  "test retry option",
  "document retry option",
];

export const EXPECTED_BRANCH_FILES = RETRY_DOC_FILES;

export const ALL_KNOWN_PATHS = [...new Set([
  ...Object.keys(MAIN_FILES),
  ...Object.keys(RETRY_DOC_FILES),
])].sort();
