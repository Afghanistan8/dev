"use client";

import { explorerTx } from "@/lib/chain";
import type { Submission } from "@/lib/types";

const WORDS: Record<Submission["stage"], string> = {
  signing: "waiting for the wallet to sign",
  submitted: "submitted; the validators are reading the documents",
  waiting: "waiting for a decision",
  accepted: "accepted by the majority",
  finalized: "finalized",
  "no-decision": "the round reached no decision; nothing was written",
  refused: "refused",
  failed: "the wallet did not sign",
};

/**
 * Where a submission has got to. The distinction that matters is between the
 * point a transaction is *submitted* and the point consensus has *decided*: a
 * proposal is only assessed once the round is accepted, and the contract writes
 * nothing at all when the validators do not agree. So the line says which of
 * those it is, and why when it is neither.
 */
export function TransactionLine({ submission }: { submission: Submission | null }) {
  if (!submission) return null;
  const bad = submission.stage === "refused" || submission.stage === "failed" || submission.stage === "no-decision";
  return (
    <div className="inset mt-4 px-3 py-3 text-sm">
      <p className={bad ? "text-breaking" : "text-bone-dim"}>
        <span className="ruleid mr-2">{submission.stage}</span>
        {WORDS[submission.stage]}
      </p>
      {submission.hash && (
        <p className="tabular mt-2 text-bone-faint">
          tx{" "}
          {explorerTx(submission.hash) ? (
            <a className="link" href={explorerTx(submission.hash)} target="_blank" rel="noreferrer">
              {submission.hash.slice(0, 18)}…
            </a>
          ) : (
            submission.hash.slice(0, 18) + "…"
          )}
        </p>
      )}
      {(submission.status || submission.result) && (
        <p className="tabular mt-1 text-bone-ghost">
          {submission.status || "—"} / {submission.result || "—"}
          {submission.execution && submission.execution !== "unknown" ? ` / ${submission.execution}` : ""}
        </p>
      )}
      {submission.refusal && (
        <p className="mt-2 text-breaking">{submission.refusal}</p>
      )}
      {!submission.refusal && bad && submission.detail && (
        <p className="mt-2 text-bone-faint">{submission.detail}</p>
      )}
    </div>
  );
}
