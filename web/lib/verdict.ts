// The words for the contract's three vocabularies, in one place.
//
// A verdict, a finding status and a severity are all derived or frozen in
// contracts/dev.py; nothing here invents a value, it only says what one means.

import type { FindingStatus, Severity, SpecificationState, Verdict } from "./types";

export const VERDICT_TONE: Record<Verdict, string> = {
  COMPATIBLE: "text-compatible border-compatible/40 bg-compatible/10",
  BREAKING_CHANGE: "text-breaking border-breaking/40 bg-breaking/10",
  INCONCLUSIVE: "text-doubt border-rule-bright bg-bone/5",
};

export const VERDICT_PROSE: Record<Verdict, string> = {
  COMPATIBLE: "every frozen requirement is still satisfied by the proposal.",
  BREAKING_CHANGE: "at least one frozen requirement is violated by the proposal.",
  INCONCLUSIVE: "at least one requirement could not be settled by the evidence.",
};

export const STATUS_TONE: Record<FindingStatus, string> = {
  SATISFIED: "text-compatible",
  VIOLATED: "text-breaking",
  UNCLEAR: "text-doubt",
};

export const STATUS_PROSE: Record<FindingStatus, string> = {
  SATISFIED: "the proposal still meets this requirement, and the words are quoted from it.",
  VIOLATED: "the proposal contradicts this requirement, or dropped what the baseline promised.",
  UNCLEAR: "the documents do not settle this requirement.",
};

export const SEVERITY_PROSE: Record<Severity, string> = {
  BLOCKING: "must hold; this is what the integration cannot lose.",
  MAJOR: "must hold; a change here breaks a caller.",
  MINOR: "should hold; a change here is worth knowing about.",
};

export const STATE_PROSE: Record<SpecificationState, string> = {
  DRAFT: "registered, no requirements yet.",
  REGISTERED: "carries requirements; the creator may still add more or freeze.",
  FROZEN: "the criteria are sealed and cannot move; proposals may be assessed.",
};

export function isVerdict(value: string): value is Verdict {
  return value === "COMPATIBLE" || value === "BREAKING_CHANGE" || value === "INCONCLUSIVE";
}

export function verdictTone(verdict: string): string {
  return isVerdict(verdict) ? VERDICT_TONE[verdict] : VERDICT_TONE.INCONCLUSIVE;
}

export function verdictProse(verdict: string): string {
  return isVerdict(verdict) ? VERDICT_PROSE[verdict] : "";
}
