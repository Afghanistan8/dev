// Form validation, mirrored from the contract.
//
// Every rule here is also enforced in contracts/dev.py, which is the only place
// it counts. The point of the copy is that nobody should have to spend a
// transaction to be told their requirement id is malformed. tests/mirror.test.ts
// holds it to the same answers.

export const MAX_NAME = 120;
export const MAX_DESCRIPTION = 1200;
export const MAX_VERSION = 40;
export const MAX_SOURCE = 400;
export const MAX_CONTENT = 20000;
export const MIN_CONTENT = 2;
export const MAX_REQUIREMENTS = 16;
export const MIN_REQUIREMENTS = 1;
export const MAX_STATEMENT = 400;
export const MAX_ID = 24;

export const SEVERITIES = ["BLOCKING", "MAJOR", "MINOR"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const REQUIREMENT_ID = /^[A-Z][A-Z0-9]{1,11}-[0-9]{1,4}$/;
const ANGLE_RUN = /[<>]{3,}/;

/** One complaint, keyed by the field that caused it, so it can sit beside it. */
export type Complaint = { field: string; code: string; detail: string };

function say(field: string, code: string, detail: string): Complaint {
  return { field, code, detail };
}

function text(value: string, field: string, limit: number, least = 1): Complaint | null {
  const held = (value ?? "").trim();
  if (held.length < least) return say(field, "INVALID_INPUT", `${field} is required.`);
  if (held.length > limit) {
    return say(field, "LIMIT", `${field} is longer than ${limit} characters.`);
  }
  if (ANGLE_RUN.test(held)) {
    return say("_", "INVALID_INPUT", `${field} cannot contain three or more angle brackets in a row.`);
  }
  return null;
}

export type SpecificationFields = {
  name: string;
  description: string;
  version: string;
  content: string;
  source: string;
};

export function checkSpecification(fields: SpecificationFields): Complaint[] {
  const found: Complaint[] = [];
  const name = text(fields.name, "name", MAX_NAME);
  if (name) found.push({ ...name, field: "name" });
  const description = text(fields.description, "description", MAX_DESCRIPTION);
  if (description) found.push({ ...description, field: "description" });
  const version = text(fields.version, "baseline version", MAX_VERSION);
  if (version) found.push({ ...version, field: "version" });
  const source = text(fields.source, "source reference", MAX_SOURCE, 0);
  if (source) found.push({ ...source, field: "source" });

  const body = fields.content ?? "";
  if (body.trim().length < MIN_CONTENT) {
    found.push(say("content", "INVALID_INPUT", "the baseline content is empty."));
  } else if (body.length > MAX_CONTENT) {
    found.push(say("content", "LIMIT", `the baseline content is longer than ${MAX_CONTENT} characters.`));
  } else if (ANGLE_RUN.test(body)) {
    found.push(say("content", "INVALID_INPUT", "the baseline content cannot contain three or more angle brackets in a row."));
  }
  return found;
}

export type RequirementFields = {
  id: string;
  statement: string;
  severity: string;
  existing: readonly string[];
  count: number;
};

export function checkRequirement(fields: RequirementFields): Complaint[] {
  const found: Complaint[] = [];
  const id = (fields.id ?? "").trim().toUpperCase();
  if (!id) {
    found.push(say("id", "INVALID_REQUIREMENT", "a requirement needs an id."));
  } else if (!REQUIREMENT_ID.test(id)) {
    found.push(
      say("id", "INVALID_REQUIREMENT", "a requirement id looks like PAY-001: letters, a hyphen, then digits."),
    );
  } else if (fields.existing.includes(id)) {
    found.push(say("id", "INVALID_REQUIREMENT", `${id} is already a requirement of this specification.`));
  }

  const statement = text(fields.statement, "statement", MAX_STATEMENT);
  if (statement) found.push({ ...statement, field: "statement" });

  if (!SEVERITIES.includes(fields.severity as Severity)) {
    found.push(say("severity", "INVALID_REQUIREMENT", `severity is one of ${SEVERITIES.join(", ")}.`));
  }

  if (fields.count >= MAX_REQUIREMENTS) {
    found.push(say("id", "LIMIT", `a specification holds at most ${MAX_REQUIREMENTS} requirements.`));
  }
  return found;
}

export type ProposalFields = {
  version: string;
  content: string;
  frozen: boolean;
  criteriaDigest: string;
};

export function checkProposal(fields: ProposalFields): Complaint[] {
  const found: Complaint[] = [];
  if (!fields.frozen) {
    found.push(say("content", "WRONG_STATE", "a specification must be frozen before it can be assessed."));
  }
  if (!fields.criteriaDigest) {
    found.push(say("content", "CRITERIA_MISMATCH", "the frozen criteria digest is not known yet."));
  }
  const version = text(fields.version, "proposed version", MAX_VERSION);
  if (version) found.push({ ...version, field: "version" });

  const body = fields.content ?? "";
  if (body.trim().length < MIN_CONTENT) {
    found.push(say("content", "INVALID_INPUT", "the proposed content is empty."));
  } else if (body.length > MAX_CONTENT) {
    found.push(say("content", "LIMIT", `the proposed content is longer than ${MAX_CONTENT} characters.`));
  } else if (ANGLE_RUN.test(body)) {
    found.push(say("content", "INVALID_INPUT", "the proposed content cannot contain three or more angle brackets in a row."));
  }
  return found;
}

export function complaintFor(found: readonly Complaint[], field: string): Complaint | undefined {
  return found.find((c) => c.field === field);
}
