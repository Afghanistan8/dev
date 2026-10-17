"use client";

// Verification, done from the reader's own machine.
//
// Nothing here trusts a server or an explorer. Every digest the contract
// recorded is recomputed in the browser from the documents the contract also
// returned, and the two are compared. If they agree, the record is the one the
// contract holds and the answers are the ones the validators agreed about. If
// they do not, the page says so.

import { useState } from "react";

import { baselineHash, criteriaDigest, decisiveDigest, sha256Hex } from "@/lib/canon";
import { read, describeRefusal } from "@/lib/dev";
import type { Assessment, Baseline, Criteria, Proposed } from "@/lib/types";

import { Field } from "./ui";

type Check = { label: string; recorded: string; recomputed: string; agree: boolean };

function Row({ check }: { check: Check }) {
  return (
    <div className="border-t border-rule py-4">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
        <span className="text-sm text-bone">{check.label}</span>
        <span className={`marginal ${check.agree ? "text-compatible" : "text-breaking"}`}>
          {check.agree ? "agrees" : "disagrees"}
        </span>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="marginal">recorded on chain</p>
          <p className="tabular mt-1 break-all text-bone-dim">{check.recorded || "—"}</p>
        </div>
        <div>
          <p className="marginal">recomputed here</p>
          <p className="tabular mt-1 break-all text-bone-dim">{check.recomputed || "—"}</p>
        </div>
      </div>
    </div>
  );
}

function Panel({
  label,
  hint,
  placeholder,
  run,
}: {
  label: string;
  hint: string;
  placeholder: string;
  run: (value: string) => Promise<Check[]>;
}) {
  const [value, setValue] = useState("");
  const [checks, setChecks] = useState<Check[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function go() {
    const wanted = value.trim();
    if (!wanted) return;
    setBusy(true);
    setError("");
    setChecks(null);
    try {
      setChecks(await run(wanted));
    } catch (trouble) {
      setError(describeRefusal(trouble));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sheet mt-6 px-4 py-6 sm:px-6">
      <Field label={label} hint={hint}>
        <div className="flex flex-wrap gap-3">
          <input
            className="field max-w-xs flex-1 font-mono"
            value={value}
            placeholder={placeholder}
            spellCheck={false}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void go();
            }}
          />
          <button
            type="button"
            className="press press-filled"
            disabled={busy || value.trim() === ""}
            onClick={() => void go()}
          >
            {busy ? "reading…" : "recompute"}
          </button>
        </div>
      </Field>

      {error && <p className="mt-4 text-sm text-breaking">{error}</p>}

      {checks && checks.length > 0 && (
        <div className="mt-6">
          {checks.map((check) => (
            <Row key={check.label} check={check} />
          ))}
          <p className="mt-4 text-sm text-bone-faint">
            {checks.every((check) => check.agree)
              ? "Everything recomputed here matches what the contract recorded."
              : "Something does not match. Treat the record as unverified until it does."}
          </p>
        </div>
      )}
    </div>
  );
}

export function VerifySpecification() {
  return (
    <Panel
      label="a specification"
      hint="the criteria digest and the baseline hash, recomputed from the requirements and the stored baseline"
      placeholder="S1"
      run={async (specificationId) => {
        const criteria = await read<Criteria>("get_criteria", [specificationId]);
        const baseline = await read<Baseline>("get_baseline", [specificationId]);
        const recomputedBaseline = await baselineHash(baseline.content);
        const recomputedCriteria = await criteriaDigest(
          criteria.baseline_hash,
          criteria.requirements,
          criteria.rules,
        );
        return [
          {
            label: "the baseline hashes to the baseline hash it was registered with",
            recorded: criteria.baseline_hash,
            recomputed: recomputedBaseline,
            agree: recomputedBaseline === criteria.baseline_hash,
          },
          {
            label: "the frozen criteria digest covers exactly these requirements",
            recorded: criteria.criteria_digest,
            recomputed: recomputedCriteria,
            agree: recomputedCriteria === criteria.criteria_digest,
          },
        ];
      }}
    />
  );
}

export function VerifyAssessment() {
  return (
    <Panel
      label="an assessment"
      hint="the digest over the answers, and the proposed document's hash, recomputed from the record"
      placeholder="A1"
      run={async (assessmentId) => {
        const record = await read<Assessment>("get_assessment", [assessmentId]);
        const proposed = await read<Proposed>("get_proposed", [assessmentId]);
        const recomputedDecisive = await decisiveDigest(record.findings);
        const recomputedProposed = await sha256Hex(proposed.content);
        return [
          {
            label: "the proposed content hashes to the proposed hash it was assessed under",
            recorded: record.proposed_hash,
            recomputed: recomputedProposed,
            agree: recomputedProposed === record.proposed_hash,
          },
          {
            label: "the answers hash to the digest the validators had to agree about",
            recorded: record.decisive_digest,
            recomputed: recomputedDecisive,
            agree: recomputedDecisive === record.decisive_digest,
          },
        ];
      }}
    />
  );
}
