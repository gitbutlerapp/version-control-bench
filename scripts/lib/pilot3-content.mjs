export const TASK_BRANCH = "split-workflow";

export const MAIN_FILES = {
  "README.md": `# Lead Routing Service

Small TypeScript service used by the split-commit benchmark pilot.
`,

  "package.json": `{
  "name": "lead-routing-service",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "test": "node tests/lead.test.ts && node tests/handler.test.ts"
  },
  "dependencies": {},
  "devDependencies": {}
}
`,
};

export const CONFIG_FILES = {
  ...MAIN_FILES,

  "src/config.ts": `export interface ServiceConfig {
  region: string;
  defaultSource: string;
  retryLimit: number;
}

export const config: ServiceConfig = {
  region: "local",
  defaultSource: "web",
  retryLimit: 2,
};
`,
};

export const HANDLER_FILES = {
  ...CONFIG_FILES,

  "src/lead.ts": `export interface LeadPayload {
  name: string;
  email: string;
  message?: string;
}

export type ScoreBand = "cold" | "warm" | "hot";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function hasContactName(payload: LeadPayload): boolean {
  return payload.name.trim().length > 0;
}

export function hasEmail(payload: LeadPayload): boolean {
  return normalizeEmail(payload.email).length > 0;
}

export function isValidLead(payload: LeadPayload): boolean {
  return hasContactName(payload) && hasEmail(payload);
}

export function scoreLead(payload: LeadPayload): number {
  const email = normalizeEmail(payload.email);
  let score = 10;

  if (email.endsWith("@example.com")) {
    score += 5;
  }

  if (payload.message && payload.message.length > 80) {
    score += 10;
  }

  return Math.min(score, 100);
}

export function scoreBand(score: number): ScoreBand {
  if (score >= 70) return "hot";
  if (score >= 30) return "warm";
  return "cold";
}
`,

  "src/handler.ts": `import { config } from "./config";
import { isValidLead, LeadPayload, normalizeEmail, scoreBand, scoreLead } from "./lead";

export interface LeadResponse {
  accepted: boolean;
  id: string | null;
  score: number;
  band: string;
  source: string;
}

export function handleLead(payload: LeadPayload): LeadResponse {
  if (!isValidLead(payload)) {
    return {
      accepted: false,
      id: null,
      score: 0,
      band: "cold",
      source: config.defaultSource,
    };
  }

  const email = normalizeEmail(payload.email);
  const score = scoreLead(payload);

  return {
    accepted: true,
    id: \`\${payload.name}:\${email}\`,
    score,
    band: scoreBand(score),
    source: \`\${config.region}:\${config.defaultSource}\`,
  };
}
`,

  "tests/lead.test.ts": `import { isValidLead, normalizeEmail, scoreBand, scoreLead } from "../src/lead";

export function testNormalizeEmail(): void {
  const email = normalizeEmail(" ADA@EXAMPLE.COM ");

  if (email !== "ada@example.com") {
    throw new Error(\`unexpected email: \${email}\`);
  }
}

export function testIsValidLeadRequiresName(): void {
  const valid = isValidLead({ name: "", email: "ada@example.com" });

  if (valid) {
    throw new Error("missing name should be rejected");
  }
}

export function testIsValidLeadRequiresEmail(): void {
  const valid = isValidLead({ name: "Ada", email: "" });

  if (valid) {
    throw new Error("missing email should be rejected");
  }
}

export function testScoreLeadRewardsDetailedMessage(): void {
  const score = scoreLead({
    name: "Ada",
    email: "ada@example.com",
    message: "We are evaluating the product for a larger rollout across the sales team.",
  });

  if (score <= 10) {
    throw new Error(\`score was not increased: \${score}\`);
  }
}

export function testScoreBand(): void {
  if (scoreBand(75) !== "hot") {
    throw new Error("expected hot score band");
  }
}
`,

  "tests/handler.test.ts": `import { handleLead } from "../src/handler";

export function testHandleLeadAcceptsValidPayload(): void {
  const result = handleLead({ name: "Ada", email: "ada@example.com" });

  if (!result.accepted || result.id !== "Ada:ada@example.com") {
    throw new Error("valid payload should be accepted");
  }
}
`,
};

export const VALIDATION_FILES = {
  ...HANDLER_FILES,

  "src/lead.ts": `export interface LeadPayload {
  name: string;
  email: string;
  message?: string;
}

export type ScoreBand = "cold" | "warm" | "hot";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function hasContactName(payload: LeadPayload): boolean {
  return payload.name.trim().length > 0;
}

export function hasEmail(payload: LeadPayload): boolean {
  return normalizeEmail(payload.email).length > 0;
}

export function isLikelyEmail(email: string): boolean {
  const normalized = normalizeEmail(email);
  return normalized.includes("@") && normalized.includes(".");
}

export function isValidLead(payload: LeadPayload): boolean {
  return hasContactName(payload) && hasEmail(payload) && isLikelyEmail(payload.email);
}

export function scoreLead(payload: LeadPayload): number {
  const email = normalizeEmail(payload.email);
  let score = 10;

  if (email.endsWith("@example.com")) {
    score += 5;
  }

  if (payload.message && payload.message.length > 80) {
    score += 10;
  }

  return Math.min(score, 100);
}

export function scoreBand(score: number): ScoreBand {
  if (score >= 70) return "hot";
  if (score >= 30) return "warm";
  return "cold";
}
`,

  "tests/lead.test.ts": `import { isValidLead, normalizeEmail, scoreBand, scoreLead } from "../src/lead";

export function testNormalizeEmail(): void {
  const email = normalizeEmail(" ADA@EXAMPLE.COM ");

  if (email !== "ada@example.com") {
    throw new Error(\`unexpected email: \${email}\`);
  }
}

export function testIsValidLeadRequiresName(): void {
  const valid = isValidLead({ name: "", email: "ada@example.com" });

  if (valid) {
    throw new Error("missing name should be rejected");
  }
}

export function testIsValidLeadRequiresEmail(): void {
  const valid = isValidLead({ name: "Ada", email: "" });

  if (valid) {
    throw new Error("missing email should be rejected");
  }
}

export function testIsValidLeadRejectsMalformedEmail(): void {
  const valid = isValidLead({ name: "Ada", email: "not-an-email" });

  if (valid) {
    throw new Error("malformed email should be rejected");
  }
}

export function testScoreLeadRewardsDetailedMessage(): void {
  const score = scoreLead({
    name: "Ada",
    email: "ada@example.com",
    message: "We are evaluating the product for a larger rollout across the sales team.",
  });

  if (score <= 10) {
    throw new Error(\`score was not increased: \${score}\`);
  }
}

export function testScoreBand(): void {
  if (scoreBand(75) !== "hot") {
    throw new Error("expected hot score band");
  }
}
`,
};

export const SCORING_FILES = {
  ...VALIDATION_FILES,

  "src/lead.ts": `export interface LeadPayload {
  name: string;
  email: string;
  message?: string;
}

export type ScoreBand = "cold" | "warm" | "hot";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function hasContactName(payload: LeadPayload): boolean {
  return payload.name.trim().length > 0;
}

export function hasEmail(payload: LeadPayload): boolean {
  return normalizeEmail(payload.email).length > 0;
}

export function isLikelyEmail(email: string): boolean {
  const normalized = normalizeEmail(email);
  return normalized.includes("@") && normalized.includes(".");
}

export function isValidLead(payload: LeadPayload): boolean {
  return hasContactName(payload) && hasEmail(payload) && isLikelyEmail(payload.email);
}

export function scoreLead(payload: LeadPayload): number {
  const email = normalizeEmail(payload.email);
  let score = 10;

  if (email.endsWith("@example.com")) {
    score += 5;
  }

  if (email.endsWith("@enterprise.example")) {
    score += 25;
  }

  if (payload.message && payload.message.length > 80) {
    score += 15;
  }

  return Math.min(score, 100);
}

export function scoreBand(score: number): ScoreBand {
  if (score >= 70) return "hot";
  if (score >= 30) return "warm";
  return "cold";
}
`,

  "tests/lead.test.ts": `import { isValidLead, normalizeEmail, scoreBand, scoreLead } from "../src/lead";

export function testNormalizeEmail(): void {
  const email = normalizeEmail(" ADA@EXAMPLE.COM ");

  if (email !== "ada@example.com") {
    throw new Error(\`unexpected email: \${email}\`);
  }
}

export function testIsValidLeadRequiresName(): void {
  const valid = isValidLead({ name: "", email: "ada@example.com" });

  if (valid) {
    throw new Error("missing name should be rejected");
  }
}

export function testIsValidLeadRequiresEmail(): void {
  const valid = isValidLead({ name: "Ada", email: "" });

  if (valid) {
    throw new Error("missing email should be rejected");
  }
}

export function testIsValidLeadRejectsMalformedEmail(): void {
  const valid = isValidLead({ name: "Ada", email: "not-an-email" });

  if (valid) {
    throw new Error("malformed email should be rejected");
  }
}

export function testScoreLeadRewardsDetailedMessage(): void {
  const score = scoreLead({
    name: "Ada",
    email: "ada@example.com",
    message: "We are evaluating the product for a larger rollout across the sales team.",
  });

  if (score <= 10) {
    throw new Error(\`score was not increased: \${score}\`);
  }
}

export function testScoreLeadRewardsEnterpriseDomain(): void {
  const score = scoreLead({
    name: "Grace",
    email: "grace@enterprise.example",
    message: "Interested in a broader rollout.",
  });

  if (score < 35) {
    throw new Error(\`enterprise score was too low: \${score}\`);
  }
}

export function testScoreBand(): void {
  if (scoreBand(75) !== "hot") {
    throw new Error("expected hot score band");
  }
}
`,
};

export const TARGET_FILES = {
  ...SCORING_FILES,

  "README.md": `# Lead Routing Service

Small TypeScript service used by the split-commit benchmark pilot.

## Lead Workflow

- Validate contact information before scoring leads.
- Score accepted leads with email-domain and message-depth signals.
- Workflow details live in docs/lead-workflow.md.
`,

  "docs/lead-workflow.md": `# Lead Workflow

Incoming leads are validated before scoring.
Enterprise email domains receive an extra score boost.
Detailed messages improve the score but do not override validation failures.
`,
};

export const PRESERVED_TOP_FILES = {
  ...TARGET_FILES,

  "src/handler.ts": `import { config } from "./config";
import { isValidLead, LeadPayload, normalizeEmail, scoreBand, scoreLead } from "./lead";

export interface LeadResponse {
  accepted: boolean;
  id: string | null;
  score: number;
  band: string;
  source: string;
  routingKey: string;
}

export function handleLead(payload: LeadPayload): LeadResponse {
  if (!isValidLead(payload)) {
    return {
      accepted: false,
      id: null,
      score: 0,
      band: "cold",
      source: config.defaultSource,
      routingKey: config.defaultSource,
    };
  }

  const email = normalizeEmail(payload.email);
  const score = scoreLead(payload);
  const band = scoreBand(score);

  return {
    accepted: true,
    id: \`\${payload.name}:\${email}\`,
    score,
    band,
    source: \`\${config.region}:\${config.defaultSource}\`,
    routingKey: \`\${config.defaultSource}:\${band}\`,
  };
}
`,

  "tests/handler.test.ts": `import { handleLead } from "../src/handler";

export function testHandleLeadAcceptsValidPayload(): void {
  const result = handleLead({ name: "Ada", email: "ada@example.com" });

  if (!result.accepted || result.id !== "Ada:ada@example.com") {
    throw new Error("valid payload should be accepted");
  }
}

export function testHandleLeadIncludesRoutingMetadata(): void {
  const result = handleLead({ name: "Ada", email: "ada@example.com" });

  if (result.source !== "local:web" || result.routingKey !== "web:cold") {
    throw new Error("routing metadata should be populated");
  }
}
`,
};

export const BROAD_FILES = {
  ...TARGET_FILES,

  "src/config.ts": `export interface ServiceConfig {
  region: string;
  defaultSource: string;
  retryLimit: number;
  logLevel: "debug" | "info" | "warn";
}

export const config: ServiceConfig = {
  region: "local",
  defaultSource: "web",
  retryLimit: 2,
  logLevel: "debug",
};
`,

  "src/lead.ts": `${TARGET_FILES["src/lead.ts"]}
export function debugLeadSummary(payload: LeadPayload): string {
  return \`\${payload.name}:\${normalizeEmail(payload.email)}:\${payload.message ?? "none"}\`;
}
`,

  "notes/investigation.md": `# Investigation Notes

- Capture sample payloads for the next logging cleanup pass.
- Do not keep this investigation note in the split commits.
`,
};

export const PRESERVED_TOP_BROAD_FILES = {
  ...BROAD_FILES,
  "src/handler.ts": PRESERVED_TOP_FILES["src/handler.ts"],
  "tests/handler.test.ts": PRESERVED_TOP_FILES["tests/handler.test.ts"],
};

export const INITIAL_COMMIT_STATES = [
  {
    subject: "add app configuration",
    files: CONFIG_FILES,
  },
  {
    subject: "add API handler",
    files: HANDLER_FILES,
  },
  {
    subject: "add lead workflow",
    files: BROAD_FILES,
  },
  {
    subject: "add handler routing metadata",
    files: PRESERVED_TOP_BROAD_FILES,
  },
];

export const SPLIT_COMMIT_STATES = [
  {
    subject: "add app configuration",
    files: CONFIG_FILES,
  },
  {
    subject: "add API handler",
    files: HANDLER_FILES,
  },
  {
    subject: "refactor validation helpers",
    files: VALIDATION_FILES,
  },
  {
    subject: "tune lead scoring",
    files: SCORING_FILES,
  },
  {
    subject: "document lead workflow",
    files: TARGET_FILES,
  },
  {
    subject: "add handler routing metadata",
    files: PRESERVED_TOP_FILES,
  },
];

export const EXPECTED_BRANCH_FILES = PRESERVED_TOP_FILES;

export const DIRTY_FILES = PRESERVED_TOP_BROAD_FILES;

export const ALL_KNOWN_PATHS = [
  ...new Set([
    ...Object.keys(MAIN_FILES),
    ...INITIAL_COMMIT_STATES.flatMap((state) => Object.keys(state.files)),
    ...SPLIT_COMMIT_STATES.flatMap((state) => Object.keys(state.files)),
    ...Object.keys(BROAD_FILES),
    ...Object.keys(PRESERVED_TOP_FILES),
    ...Object.keys(PRESERVED_TOP_BROAD_FILES),
    ...Object.keys(TARGET_FILES),
    ...Object.keys(DIRTY_FILES),
  ]),
].filter(Boolean);
