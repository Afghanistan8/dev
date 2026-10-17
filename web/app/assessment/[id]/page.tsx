"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { decisiveDigest } from "@/lib/canon";
import { CONTRACT_SET } from "@/lib/chain";
import { bytes, moment, shortAddress } from "@/lib/format";
import { useRead } from "@/lib/hooks";
import type { Assessment, Proposed } from "@/lib/types";
import { verdictProse } from "@/lib/verdict";

import { Findings } from "@/components/Findings";
import {
  Datum,
  InjectionSignals,
  Refusal,
  Section,
  VerdictBadge,
  Waiting,
} from "@/components/ui";

export default function AssessmentRecord() {
  const params = useParams();
  const raw = params?.id;
  const id = typeof raw === "string" ? raw : Array.isArray(raw) ? (raw[0] ?? "") : "";
  const aid = id || null;

  const record = useRead<Assessment>(aid ? "get_assessment" : null, [id]);
  const proposed = useRead<Proposed>(aid ? "get_proposed" : null, [id]);

  const [recomputed, setRecomputed] = useState("");

  const held = record.value;
  const findingsKey = held ? held.findings.map((f) => f.requirement_id).join(",") : "";

  useEffect(() => {
    if (!held) {
      setRecomputed("");
      return;
    }
    let live = true;
    decisiveDigest(
      held.findings.map((f) => ({
        requirement_id: f.requirement_id,
        status: f.status,
        effective_status: f.effective_status,
      })),
    )
      .then((value) => {
        if (live) setRecomputed(value);
      })
      .catch(() => {
        if (live) setRecomputed("");
      });
    return () => {
      live = false;
    };
    // foundingsKey/held change together; recompute when the record or its
    // findings change.
  }, [held, findingsKey]);

  if (!CONTRACT_SET) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <Section label="unavailable">
          <p className="measure text-sm text-bone-dim">
            No contract address is configured, so Dev cannot be read.
          </p>
        </Section>
      </div>
    );
  }

  if (record.error) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <section className="pt-14">
          <Link className="marginal link" href="/specs">
            ← specifications
          </Link>
          <h1 className="display mt-5 text-[2rem]">Not found</h1>
          <Refusal>{record.error}</Refusal>
        </section>
      </div>
    );
  }

  if (!held) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <Waiting what={`reading assessment ${id || ""}`} />
      </div>
    );
  }

  const digestAgrees =
    recomputed !== "" && held.decisive_digest === recomputed;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
      <section className="pt-14">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link className="marginal link" href={`/spec/${held.specification_id}`}>
            ← {held.specification_id}
          </Link>
          <span className="ruleid">{held.assessment_id}</span>
        </div>

        <div className="mt-6">
          <VerdictBadge verdict={held.verdict} size="large" />
        </div>

        <p className="lede measure mt-6">{held.summary}</p>
        <p className="measure mt-3 text-sm text-bone-faint">{verdictProse(held.verdict)}</p>

        <dl className="mt-8 grid grid-cols-2 gap-6 border-t border-rule pt-6 sm:grid-cols-4">
          <Datum term="specification">
            <Link className="link" href={`/spec/${held.specification_id}`}>
              {held.specification_name || held.specification_id}
            </Link>
          </Datum>
          <Datum term="proposed version">{held.proposed_version}</Datum>
          <Datum term="baseline version">{held.baseline_version}</Datum>
          <Datum term="submitted by" title={held.submitted_by}>
            {shortAddress(held.submitted_by)}
          </Datum>
          <Datum term="submitted">{moment(held.submitted_at)}</Datum>
          <Datum term="proposed size">{bytes(held.proposed_bytes)}</Datum>
          <Datum term="requirement answers">{held.findings.length}</Datum>
          <Datum term="decided against criteria">
            <span className="tabular">{held.criteria_digest.slice(0, 20)}…</span>
          </Datum>
        </dl>
      </section>

      <Section label="the requirement, answered">
        <Findings items={held.findings} />
      </Section>

      <Section label="the proposed version, as assessed">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
          <span className="marginal">sha256</span>
          <span className="tabular break-all text-bone-dim">{held.proposed_hash}</span>
        </div>
        <InjectionSignals signals={held.injection_signals ?? []} where="the proposal" />
        <pre className="inset monoarea mt-4 overflow-auto px-3 py-3 text-[0.8125rem] leading-relaxed whitespace-pre-wrap text-bone-dim">
          {proposed.value?.content ?? "…"}
        </pre>
      </Section>

      <Section label="the decision, as recorded">
        <div className="grid gap-6 sm:grid-cols-2">
          <Datum term="criteria the panel was held to">
            <span className="tabular break-all">{held.criteria_digest}</span>
          </Datum>
          <Datum term="digest of the answers">
            <span className="tabular break-all">{held.decisive_digest}</span>
            {recomputed !== "" && (
              <span className={`ml-2 marginal ${digestAgrees ? "text-compatible" : "text-breaking"}`}>
                {digestAgrees ? "recomputed — agrees" : "recompute disagrees"}
              </span>
            )}
          </Datum>
        </div>
        {recomputed !== "" && !digestAgrees && (
          <p className="mt-4 text-sm text-breaking">
            These findings do not hash to the digest the contract recorded. Recompute it yourself
            below before trusting this record.
          </p>
        )}
        <p className="measure mt-6 text-sm text-bone-faint">
          The digest above is taken over the requirement id, the answered status and the status
          grounding made of it — and nothing else. It is the thing the validators had to agree
          about, so anyone can recheck that these answers are the ones that were agreed.
        </p>

        {held.rules && (
          <details className="mt-8">
            <summary className="marginal cursor-pointer">the aggregation rules, as frozen</summary>
            <pre className="inset mt-3 overflow-auto px-3 py-3 text-[0.8125rem] leading-relaxed whitespace-pre-wrap text-bone-faint">
              {held.rules}
            </pre>
          </details>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          <Link className="press" href={`/spec/${held.specification_id}`}>
            the specification
          </Link>
          <Link className="press" href="/verify">
            verify this verdict
          </Link>
        </div>
      </Section>
    </div>
  );
}
