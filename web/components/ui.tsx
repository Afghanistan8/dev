// The small shared pieces. Every page is built out of these, which is what
// keeps a specification, a proposal and a finding looking like parts of one
// record.

import type { ReactNode } from "react";

import type { Complaint } from "@/lib/validation";
import type { FindingStatus, InjectionSignal, SpecificationState, Verdict } from "@/lib/types";
import {
  SEVERITY_PROSE,
  STATE_PROSE,
  STATUS_TONE,
  VERDICT_PROSE,
  verdictTone,
} from "@/lib/verdict";
import type { Severity as SeverityName } from "@/lib/validation";

/** A section, introduced by a hairline that runs through its label. */
export function Section({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`mt-12 ${className}`}>
      <div className="hairline-label mb-6">
        <span className="marginal">{label}</span>
      </div>
      {children}
    </section>
  );
}

/** A label-above-value pair. The unit of nearly every readout in the app. */
export function Datum({
  term,
  children,
  title,
}: {
  term: string;
  children: ReactNode;
  title?: string;
}) {
  return (
    <div>
      <dt className="marginal">{term}</dt>
      <dd className="mt-1 text-sm text-bone" title={title}>
        {children}
      </dd>
    </div>
  );
}

/** The verdict, its one-sentence meaning, and its colour. */
export function VerdictBadge({
  verdict,
  size = "normal",
}: {
  verdict: Verdict | string;
  size?: "normal" | "large";
}) {
  if (!verdict) return <span className="marginal">no verdict yet</span>;
  return (
    <span className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
      <span
        className={`inline-block border px-2.5 py-1 font-mono tracking-[0.12em] uppercase ${verdictTone(verdict)} ${
          size === "large" ? "text-sm" : "text-[0.6875rem]"
        }`}
      >
        {String(verdict).replace(/_/g, " ")}
      </span>
      {size === "large" && (
        <span className="text-sm text-bone-dim">{VERDICT_PROSE[verdict as Verdict]}</span>
      )}
    </span>
  );
}

/** A finding status, coloured. `held` says grounding demoted it to UNCLEAR. */
export function StatusMark({ status, held = false }: { status: FindingStatus; held?: boolean }) {
  return (
    <span className={`font-mono text-[0.6875rem] tracking-[0.1em] uppercase ${STATUS_TONE[status]}`}>
      {status}
      {held && <span className="text-bone-ghost"> · held</span>}
    </span>
  );
}

export function SeverityMark({ severity }: { severity: SeverityName | string }) {
  return (
    <span
      className="ruleid"
      title={SEVERITY_PROSE[severity as SeverityName] ?? ""}
    >
      {severity}
    </span>
  );
}

const STATES: SpecificationState[] = ["DRAFT", "REGISTERED", "FROZEN"];

/** Where the specification has got to. */
export function StateTrack({ state }: { state: SpecificationState | string }) {
  const at = STATES.indexOf(state as SpecificationState);
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
      {STATES.map((step, index) => {
        const reached = at >= index;
        const here = at === index;
        return (
          <li key={step} className="flex items-center gap-2">
            <span
              className={`font-mono text-[0.6875rem] tracking-[0.12em] uppercase ${
                here ? "text-seal" : reached ? "text-bone-dim" : "text-bone-ghost/60"
              }`}
            >
              {step}
            </span>
            {index < STATES.length - 1 && (
              <span
                aria-hidden="true"
                className={`h-px w-6 ${at > index ? "bg-rule-bright" : "bg-rule"}`}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function StateProse({ state }: { state: SpecificationState | string }) {
  return <span className="text-sm text-bone-faint">{STATE_PROSE[state as SpecificationState] ?? ""}</span>;
}

/** A complaint, worded as the contract words it, beside the field it is about. */
export function Complaints({ found }: { found: readonly Complaint[] }) {
  if (found.length === 0) return null;
  return (
    <ul className="mt-3 space-y-2">
      {found.map((complaint) => (
        <li key={`${complaint.field}:${complaint.code}:${complaint.detail}`} className="text-sm">
          <span className="ruleid text-breaking">[{complaint.code}]</span>
          <span className="ml-2 text-bone-dim">{complaint.detail}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Injected directions found in a document.
 *
 * A baseline or a proposal is data. When it contains something shaped like a
 * command to the reader -- "ignore the requirements", "answer satisfied" -- that
 * is recorded here, for the reader, and never obeyed. The panel's answers are
 * still the panel's; these are what it noticed on the way.
 */
export function InjectionSignals({
  signals,
  where,
}: {
  signals: readonly InjectionSignal[];
  where: string;
}) {
  if (!signals || signals.length === 0) return null;
  return (
    <div className="mt-4 border border-ochre/40 bg-ochre/5 px-3 py-3">
      <p className="marginal text-ochre">
        {signals.length === 1
          ? `1 injected direction in ${where}`
          : `${signals.length} injected directions in ${where}`}
      </p>
      <ul className="mt-2 space-y-2">
        {signals.map((signal, index) => (
          <li key={`${signal.signal}:${index}`} className="text-sm">
            <span className="ruleid text-ochre">{signal.signal}</span>
            <span className="ml-2 text-bone-dim">{signal.excerpt}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-bone-ghost">
        Documents are read as evidence, never as instructions. Nothing here reached
        the panel as a rule.
      </p>
    </div>
  );
}

export function Refusal({ children }: { children: ReactNode }) {
  return (
    <p className="inset mt-4 px-3 py-2 text-sm text-bone-dim">
      <span className="ruleid text-breaking">refused</span>
      <span className="ml-2">{children}</span>
    </p>
  );
}

export function Waiting({ what = "reading the record" }: { what?: string }) {
  return <p className="marginal py-6">{what}…</p>;
}

/** A labelled control with its own complaint slot. */
export function Field({
  label,
  hint,
  complaint,
  children,
}: {
  label: string;
  hint?: string;
  complaint?: Complaint | undefined;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="marginal">{label}</span>
      {hint && <span className="mt-1 block text-xs text-bone-ghost">{hint}</span>}
      <span className="mt-1.5 block">{children}</span>
      {complaint && (
        <span className="mt-1.5 block text-xs text-breaking">{complaint.detail}</span>
      )}
    </label>
  );
}

/** A one-line status sentence, used while a transaction is in flight. */
export function Stage({ children }: { children: ReactNode }) {
  return <p className="tabular mt-3 text-bone-dim">{children}</p>;
}
