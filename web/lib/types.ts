// The shapes the contract's views return.
//
// Digests and timestamps come back as strings because that is what calldata
// carries; nothing here is money, so nothing here is a bigint.

export type SpecificationState = "DRAFT" | "REGISTERED" | "FROZEN";
export type FindingStatus = "SATISFIED" | "VIOLATED" | "UNCLEAR";
export type Verdict = "COMPATIBLE" | "BREAKING_CHANGE" | "INCONCLUSIVE";
export type Severity = "BLOCKING" | "MAJOR" | "MINOR";

export type InjectionSignal = { signal: string; excerpt: string };

export type Requirement = {
  requirement_id: string;
  specification_id: string;
  statement: string;
  severity: Severity;
  frozen: boolean;
  added_at: string;
};

export type Specification = {
  specification_id: string;
  creator: string;
  name: string;
  description: string;
  baseline_version: string;
  baseline_hash: string;
  baseline_bytes: number;
  source_reference: string;
  state: SpecificationState;
  frozen: boolean;
  requirement_count: number;
  assessment_count: number;
  created_at: string;
  updated_at: string;
  frozen_at: string;
  criteria_digest: string;
  rules: string;
  schema: string;
  baseline_injection_signals: InjectionSignal[];
};

export type SpecificationWithRequirements = Specification & {
  requirements: Requirement[];
};

export type Criteria = {
  specification_id: string;
  rules: string;
  frozen: boolean;
  baseline_hash: string;
  criteria_digest: string;
  computed_digest: string;
  requirements: [string, string, string][];
};

export type Baseline = {
  specification_id: string;
  baseline_version: string;
  baseline_hash: string;
  content: string;
};

export type RequirementsView = {
  specification_id: string;
  frozen: boolean;
  state: SpecificationState;
  items: Requirement[];
};

export type Finding = {
  requirement_id: string;
  statement: string;
  status: FindingStatus;
  effective_status: FindingStatus;
  held_for_grounding: boolean;
  grounded_in: string[];
  evidence: string;
  reasoning: string;
};

export type Assessment = {
  assessment_id: string;
  specification_id: string;
  specification_name: string;
  criteria_digest: string;
  baseline_version: string;
  baseline_hash: string;
  proposed_version: string;
  proposed_hash: string;
  proposed_bytes: number;
  submitted_by: string;
  submitted_at: string;
  verdict: Verdict;
  summary: string;
  findings: Finding[];
  decisive_digest: string;
  scope: string;
  rules: string;
  schema: string;
  injection_signals: InjectionSignal[];
};

export type FindingsView = {
  assessment_id: string;
  verdict: Verdict;
  summary: string;
  items: Finding[];
  criteria_digest: string;
  decisive_digest: string;
  injection_signals: InjectionSignal[];
  scope: string;
  rules: string;
};

export type Proposed = {
  assessment_id: string;
  proposed_version: string;
  proposed_hash: string;
  content: string;
};

export type Page<T> = {
  items: T[];
  total: number;
  offset: number;
  limit: number;
};

export type ProtocolInfo = {
  rules: string;
  schema: string;
  scope: string;
  specification_states: SpecificationState[];
  finding_statuses: FindingStatus[];
  verdicts: Verdict[];
  severities: Severity[];
  provider: string;
  network: string;
  specification_count: number;
  assessment_count: number;
  quote_words: number;
  limits: Record<string, number>;
};

/** What a write is doing, as the panel and consensus carry it along. */
export type SubmissionStage =
  | "signing"
  | "submitted"
  | "waiting"
  | "accepted"
  | "finalized"
  | "no-decision"
  | "refused"
  | "failed";

export type Submission = {
  stage: SubmissionStage;
  hash: string;
  status: string;
  result: string;
  execution: string;
  refusal: string;
  detail: string;
};
