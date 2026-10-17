"use client";

// The two things only the creator can do, and only before the freeze: state one
// more requirement, and seal the criteria.
//
// Both are writes to Dev, signed by the wallet. Neither is a formality: the
// requirement list is what every later proposal is judged against, and the
// freeze is the moment it stops being the creator's to change. That is why the
// freeze panel is worded as a warning rather than as a button.

import { useMemo, useState } from "react";

import { submit, type WalletSession } from "@/lib/dev";
import type { Submission } from "@/lib/types";
import {
  MAX_REQUIREMENTS,
  SEVERITIES,
  checkRequirement,
  complaintFor,
  type Complaint,
  type Severity,
} from "@/lib/validation";

import { TransactionLine } from "./Transaction";
import { Complaints, Field } from "./ui";

export function AddRequirement({
  specificationId,
  session,
  existing,
  count,
  onChanged,
}: {
  specificationId: string;
  session: WalletSession | null;
  existing: readonly string[];
  count: number;
  onChanged: () => void;
}) {
  const [id, setId] = useState("");
  const [statement, setStatement] = useState("");
  const [severity, setSeverity] = useState<Severity>("MAJOR");
  const [touched, setTouched] = useState(false);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [busy, setBusy] = useState(false);

  const complaints = useMemo(
    () => checkRequirement({ id, statement, severity, existing, count }),
    [id, statement, severity, existing, count],
  );
  const full = count >= MAX_REQUIREMENTS;

  async function add() {
    setTouched(true);
    if (!session || complaints.length > 0) return;
    setBusy(true);
    const result = await submit(
      session,
      "add_requirement",
      [specificationId, id.trim().toUpperCase(), statement.trim(), severity],
      setSubmission,
    );
    setBusy(false);
    if (result.stage === "accepted" || result.stage === "finalized") {
      setId("");
      setStatement("");
      setSeverity("MAJOR");
      setTouched(false);
      onChanged();
    }
  }

  return (
    <div className="sheet mt-6 px-4 py-6 sm:px-6">
      <div className="grid gap-6 sm:grid-cols-[10rem_1fr]">
        <Field
          label="requirement id"
          hint="PAY-001"
          complaint={touched ? complaintFor(complaints, "id") : undefined}
        >
          <input
            className="field font-mono uppercase"
            value={id}
            placeholder="PAY-001"
            spellCheck={false}
            onChange={(event) => setId(event.target.value)}
          />
        </Field>
        <Field
          label="severity"
          hint="what a violation of this requirement costs"
          complaint={touched ? complaintFor(complaints, "severity") : undefined}
        >
          <div className="flex flex-wrap gap-2">
            {SEVERITIES.map((option) => (
              <button
                key={option}
                type="button"
                className={`press ${severity === option ? "press-filled" : ""}`}
                onClick={() => setSeverity(option)}
              >
                {option}
              </button>
            ))}
          </div>
        </Field>
      </div>

      <div className="mt-6">
        <Field
          label="the requirement, stated so an answer is possible"
          hint="one sentence a reader can hold a proposal against"
          complaint={touched ? complaintFor(complaints, "statement") : undefined}
        >
          <textarea
            className="field"
            rows={3}
            value={statement}
            onChange={(event) => setStatement(event.target.value)}
          />
        </Field>
      </div>

      {touched && <Complaints found={complaints} />}

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <button
          type="button"
          className="press press-filled"
          disabled={busy || !session || full}
          onClick={() => void add()}
        >
          {busy ? "submitting…" : "add the requirement"}
        </button>
        {!session && <span className="marginal">connect the creator wallet to add</span>}
        {session && full && (
          <span className="marginal">this specification holds its maximum of {MAX_REQUIREMENTS}</span>
        )}
      </div>

      <TransactionLine submission={submission} />
    </div>
  );
}

/**
 * The freeze. After this the requirements, their ids, their statements and the
 * baseline cannot move -- not for the creator, not for anyone -- and the digest
 * printed here is what every assessment points back at. So the panel names the
 * digest before the button, not after.
 */
export function FreezeSpecification({
  specificationId,
  session,
  count,
  onChanged,
}: {
  specificationId: string;
  session: WalletSession | null;
  count: number;
  onChanged: () => void;
}) {
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [busy, setBusy] = useState(false);
  const [digest, setDigest] = useState("");
  const settled = submission?.stage === "accepted" || submission?.stage === "finalized";

  async function freeze() {
    if (!session) return;
    setBusy(true);
    const result = await submit(
      session,
      "freeze_specification",
      [specificationId],
      setSubmission,
    );
    setBusy(false);
    if (result.stage === "accepted" || result.stage === "finalized") {
      setDigest("");
      onChanged();
    }
  }

  return (
    <div className="sheet mt-6 px-4 py-6 sm:px-6">
      <p className="measure text-sm text-bone-dim">
        Freezing seals the requirements above. They cannot be added to, reworded
        or removed afterwards, and the baseline cannot be replaced. Do this when
        the criteria are the ones you mean to be held to — a proposal submitted
        after the freeze is judged against exactly these.
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <button
          type="button"
          className="press press-filled"
          disabled={busy || settled || !session || count === 0}
          onClick={() => void freeze()}
        >
          {busy ? "freezing…" : settled ? "frozen" : "freeze the criteria"}
        </button>
        {count === 0 && <span className="marginal">a specification needs a requirement before it can freeze</span>}
        {!session && <span className="marginal">connect the creator wallet to freeze</span>}
      </div>
      {digest && <p className="tabular mt-3 text-bone-dim">criteria digest {digest}</p>}
      <TransactionLine submission={submission} />
    </div>
  );
}

export type { Complaint };
