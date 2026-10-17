"use client";

// Submitting a proposed version.
//
// A proposal is not a patch and is not a diff. It is a whole version of the
// document, offered as the thing that should still satisfy the frozen
// requirements. The panel reads it beside the baseline, requirement by
// requirement, and the answer is recorded with the digest of the criteria it
// was reached against.
//
// This panel shows the digest it will name before the submit button, because
// the contract refuses a submission whose named criteria are not the frozen
// ones. A client that guessed would spend a transaction learning nothing.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { baselineHash } from "@/lib/canon";
import { submit, tryRead, type WalletSession } from "@/lib/dev";
import type { Assessment, Page, Submission } from "@/lib/types";
import { MAX_CONTENT, checkProposal, complaintFor } from "@/lib/validation";

import { TransactionLine } from "./Transaction";
import { Complaints, Field } from "./ui";

export function Propose({
  specificationId,
  specificationName,
  session,
  frozen,
  criteriaDigest,
  baselineVersion,
}: {
  specificationId: string;
  specificationName: string;
  session: WalletSession | null;
  frozen: boolean;
  criteriaDigest: string;
  baselineVersion: string;
}) {
  const router = useRouter();
  const [version, setVersion] = useState("");
  const [content, setContent] = useState("");
  const [digest, setDigest] = useState("");
  const [touched, setTouched] = useState(false);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    baselineHash(content)
      .then((held) => {
        if (live) setDigest(held);
      })
      .catch(() => {
        if (live) setDigest("");
      });
    return () => {
      live = false;
    };
  }, [content]);

  const complaints = useMemo(
    () => checkProposal({ version, content, frozen, criteriaDigest }),
    [version, content, frozen, criteriaDigest],
  );
  const blocking = complaints.length > 0;
  const settled = submission?.stage === "accepted" || submission?.stage === "finalized";

  async function run() {
    setTouched(true);
    if (!session || blocking) return;
    setBusy(true);
    const result = await submit(
      session,
      "submit_assessment",
      [specificationId, version.trim(), content, digest, criteriaDigest],
      setSubmission,
    );
    setBusy(false);
    if (result.stage !== "accepted" && result.stage !== "finalized") return;

    // The write returns a transaction, not the assessment id. The newest
    // assessment of this specification is the one this transaction wrote, so
    // read it back and go there.
    const held = await tryRead<Page<Assessment>>(
      "list_specification_assessments",
      [specificationId, 0, 1],
    );
    const newest = held.ok ? held.value.items[0]?.assessment_id : undefined;
    if (newest) router.push(`/assessment/${newest}`);
  }

  return (
    <div className="sheet mt-6 px-4 py-6 sm:px-6">
      <div className="inset px-3 py-3">
        <p className="marginal">the proposal is judged against</p>
        <p className="tabular mt-2 break-all text-bone-dim">{criteriaDigest || "—"}</p>
        <p className="mt-2 text-xs text-bone-ghost">
          the frozen criteria digest of {specificationName || specificationId}. The
          contract refuses a submission that names anything else.
        </p>
      </div>

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <Field
          label="proposed version"
          hint={baselineVersion ? `the baseline is ${baselineVersion}` : undefined}
          complaint={touched ? complaintFor(complaints, "version") : undefined}
        >
          <input
            className="field"
            value={version}
            placeholder="1.1.0"
            onChange={(event) => setVersion(event.target.value)}
          />
        </Field>
        <div className="flex items-end">
          <p className="text-sm text-bone-faint">
            A proposal is the whole document, not the changed lines.
          </p>
        </div>
      </div>

      <div className="mt-6">
        <Field
          label="the proposed version, in full"
          hint={`stored on chain beside the baseline, hashed, up to ${MAX_CONTENT} characters`}
          complaint={touched ? complaintFor(complaints, "content") : undefined}
        >
          <textarea
            className="field monoarea"
            value={content}
            spellCheck={false}
            onChange={(event) => setContent(event.target.value)}
          />
        </Field>
      </div>

      <p className="tabular mt-3 text-bone-ghost">
        sha256 {digest ? `${digest.slice(0, 24)}…` : "—"}
      </p>

      {touched && <Complaints found={complaints} />}

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <button
          type="button"
          className="press press-filled"
          disabled={busy || settled || !session || blocking}
          onClick={() => void run()}
        >
          {busy ? "submitting…" : settled ? "assessed" : "submit the proposal"}
        </button>
        {!session && <span className="marginal">connect a wallet to submit a proposal</span>}
      </div>

      <TransactionLine submission={submission} />
    </div>
  );
}
