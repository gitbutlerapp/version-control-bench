export const BASELINE_FILES = {
  "README.md": `# Lead Intake Service

Small TypeScript service used by the benchmark pilot.

## Behavior

- Normalizes lead email addresses before creating a lead id.
- Returns a stable id for each accepted lead.
`,

  "package.json": `{
  "name": "lead-intake-service",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "test": "node tests/handler.test.ts"
  },
  "dependencies": {},
  "devDependencies": {}
}
`,

  "src/config.ts": `export interface ServiceConfig {
  retryLimit: number;
  region: string;
}

export const config: ServiceConfig = {
  retryLimit: 2,
  region: "local",
};
`,

  "src/handler.ts": `export interface RequestPayload {
  name: string;
  email: string;
  message?: string;
}

export interface ResponsePayload {
  accepted: boolean;
  id: string;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function createLead(payload: RequestPayload): ResponsePayload {
  const email = normalizeEmail(payload.email);

  return {
    accepted: true,
    id: \`\${payload.name}:\${email}\`,
  };
}

export function responseStatus(result: ResponsePayload): string {
  return result.accepted ? "accepted" : "rejected";
}

export function formatAuditLabel(payload: RequestPayload): string {
  return \`\${payload.name} <\${normalizeEmail(payload.email)}>\`;
}
`,

  "tests/handler.test.ts": `import { createLead } from "../src/handler";

export function testCreateLeadNormalizesEmail(): void {
  const result = createLead({ name: "Ada", email: " ADA@EXAMPLE.COM " });

  if (result.id !== "Ada:ada@example.com") {
    throw new Error(\`unexpected id: \${result.id}\`);
  }
}
`,
};

export const TARGET_ONLY_FILES = {
  ...BASELINE_FILES,

  "README.md": `# Lead Intake Service

Small TypeScript service used by the benchmark pilot.

## Behavior

- Normalizes lead email addresses before creating a lead id.
- Rejects lead payloads when required input fields are missing or malformed.
- Returns a stable id for each accepted lead.
`,

  "src/handler.ts": `export interface RequestPayload {
  name: string;
  email: string;
  message?: string;
}

export interface ResponsePayload {
  accepted: boolean;
  id: string;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validateLeadInput(payload: RequestPayload): string[] {
  const errors: string[] = [];

  if (!payload.name.trim()) {
    errors.push("name is required");
  }

  if (!payload.email.includes("@")) {
    errors.push("email must be valid");
  }

  return errors;
}

export function createLead(payload: RequestPayload): ResponsePayload {
  const errors = validateLeadInput(payload);
  const email = normalizeEmail(payload.email);

  if (errors.length > 0) {
    return {
      accepted: false,
      id: \`invalid:\${errors.join(",")}\`,
    };
  }

  return {
    accepted: true,
    id: \`\${payload.name}:\${email}\`,
  };
}

export function responseStatus(result: ResponsePayload): string {
  return result.accepted ? "accepted" : "rejected";
}

export function formatAuditLabel(payload: RequestPayload): string {
  return \`\${payload.name} <\${normalizeEmail(payload.email)}>\`;
}
`,

  "tests/handler.test.ts": `import { createLead } from "../src/handler";

export function testCreateLeadNormalizesEmail(): void {
  const result = createLead({ name: "Ada", email: " ADA@EXAMPLE.COM " });

  if (result.id !== "Ada:ada@example.com") {
    throw new Error(\`unexpected id: \${result.id}\`);
  }
}

export function testCreateLeadRejectsInvalidEmail(): void {
  const result = createLead({ name: "Ada", email: "not-an-email" });

  if (result.accepted !== false) {
    throw new Error("invalid email should be rejected");
  }
}
`,
};

export const DIRTY_FILES = {
  ...TARGET_ONLY_FILES,

  "src/config.ts": `export interface ServiceConfig {
  retryLimit: number;
  region: string;
  logLevel: "debug" | "info" | "warn";
}

export const config: ServiceConfig = {
  retryLimit: 2,
  region: "local",
  logLevel: "debug",
};
`,

  "src/handler.ts": `export interface RequestPayload {
  name: string;
  email: string;
  message?: string;
}

export interface ResponsePayload {
  accepted: boolean;
  id: string;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validateLeadInput(payload: RequestPayload): string[] {
  const errors: string[] = [];

  if (!payload.name.trim()) {
    errors.push("name is required");
  }

  if (!payload.email.includes("@")) {
    errors.push("email must be valid");
  }

  return errors;
}

export function createLead(payload: RequestPayload): ResponsePayload {
  const errors = validateLeadInput(payload);
  const email = normalizeEmail(payload.email);

  if (errors.length > 0) {
    return {
      accepted: false,
      id: \`invalid:\${errors.join(",")}\`,
    };
  }

  return {
    accepted: true,
    id: \`\${payload.name}:\${email}\`,
  };
}

export function responseStatus(result: ResponsePayload): string {
  return result.accepted ? "accepted" : "rejected";
}

export function formatAuditLabel(payload: RequestPayload): string {
  return \`\${payload.name} <\${normalizeEmail(payload.email)}>\`;
}

export function logLeadCreation(payload: RequestPayload): void {
  console.info("creating lead", { label: formatAuditLabel(payload), hasMessage: Boolean(payload.message) });
}
`,

  "notes/debug-log.md": `# Debug Notes

- Capture sample payloads for the next logging cleanup pass.
- Do not commit these notes with the validation change.
`,
};

export const TARGET_TRACKED_PATHS = [
  "README.md",
  "src/handler.ts",
  "tests/handler.test.ts",
];

export const ALL_PATHS = Object.keys(DIRTY_FILES);
