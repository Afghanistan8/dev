"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import { CONTRACT_SET } from "@/lib/chain";
import { bytes, moment, shortAddress, shortHash } from "@/lib/format";
import { useRead } from "@/lib/hooks";
import type {
  Assessment,
  Baseline,
  Criteria,
  Page,
  SpecificationWithRequirements,
} from "@/lib/types";

import { AddRequirement, FreezeSpecification } from "@/components/AddRequirement";
import { RequirementList } from "@/components/Findings";
import { Propose } from "@/components/Propose";
import { useWallet } from "@/components/Wallet";
import {
  Datum,
  InjectionSignals,
  Refusal,
  Section,
  StateProse,
  StateTrack,
  VerdictBadge,
  Waiting,
} from "@/components/ui";

export default function Specification() {
  const params = useParams();
  const raw = params?.id;
  const id = typeof raw === "string" ? raw : Array.isArray(raw) ? (raw[0] ?? "") : "";
  const sid = id || null;

  const { address, session } = useWallet();
  const spec = useRead<SpecificationWithRequirements>(sid ? "get_specification" : null, [id]);
  const criteria = useRead<Criteria>(sid ? "get_criteria" : null, [id]);
  const baseline = useRead<Baseline>(sid ? "get_baseline" : null, [id]);
  const assessments = useRead<Page<Assessment>>(
    sid ? "list_specification_assessments" : null,
    [id, 0, 20],
  );

  function reloadAll() {
    spec.reload();
    criteria.reload();
    baseline.reload();
    assessments.reload();
  }

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

  if (spec.error) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <section className="pt-14">
          <Link className="marginal link" href="/specs">
            ← specifications
          </Link>
          <h1 className="display mt-5 text-[2rem]">Not found</h1>
          <Refusal>{spec.error}</Refusal>
        </section>
      </div>
    );
  }

  if (!spec.value) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <Waiting what={`reading ${id || "the specification"}`} />
      </div>
    );
  }

  const held = spec.value;
  const frozen = held.frozen;
  const isCreator = address !== null && address.toLowerCase() === held.creator.toLowerCase();
  const rows = assessments.value?.items ?? [];
  const digestAgrees =
    criteria.value !== null &&
    criteria.value.criteria_digest !== "" &&
    criteria.value.criteria_digest === criteria.value.computed_digest;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
      <section className="pt-14">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link className="marginal link" href="/specs">
            ← specifications
          </Link>
          <span className="ruleid">{held.specification_id}</span>
        </div>

        <div className="mt-5 flex flex-wrap items-baseline gap-x-6 gap-y-3">
          <h1 className="display text-[2rem] sm:text-[2.6rem]">{held.name}</h1>
          <StateTrack state={held.state} />
        </div>
        <p className="lede measure mt-4">{held.description}</p>
        <p className="mt-3">
          <StateProse state={held.state} />
        </p>

        <dl className="mt-8 grid grid-cols-2 gap-6 border-t border-rule pt-6 sm:grid-cols-4">
          <Datum term="creator" title={held.creator}>
            {shortAddress(held.creator)}
            {isCreator && <span className="ml-2 marginal text-seal">you</span>}
          </Datum>
          <Datum term="baseline version">{held.baseline_version}</Datum>
          <Datum term="requirements">{held.requirement_count}</Datum>
          <Datum term="assessments">{held.assessment_count}</Datum>
          <Datum term="registered">{moment(held.created_at)}</Datum>
          <Datum term="last change">{moment(held.updated_at)}</Datum>
          <Datum term="frozen">{frozen ? moment(held.frozen_at) : "not yet"}</Datum>
          <Datum term="baseline size">{bytes(held.baseline_bytes)}</Datum>
        </dl>

        {held.source_reference && (
          <p className="mt-6 text-sm text-bone-faint">
            source reference <span className="tabular">{held.source_reference}</span> — a courtesy
            for readers; the bytes below are what was frozen.
          </p>
        )}
      </section>

      <Section label="the baseline, as frozen">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
          <span className="marginal">sha256</span>
          <span className="tabular break-all text-bone-dim">{held.baseline_hash}</span>
        </div>
        <InjectionSignals signals={held.baseline_injection_signals ?? []} where="the baseline" />
        <pre className="inset monoarea mt-4 overflow-auto px-3 py-3 text-[0.8125rem] leading-relaxed whitespace-pre-wrap text-bone-dim">
          {baseline.value?.content ?? "…"}
        </pre>
      </Section>

      <Section label={`the frozen criteria${frozen ? "" : " (not yet frozen)"}`}>
        <div className="grid gap-6 sm:grid-cols-2">
          <Datum term="criteria digest recorded at the freeze">
            <span className="tabular break-all">
              {criteria.value?.criteria_digest || "—"}
            </span>
          </Datum>
          <Datum term="digest recomputed from the requirements">
            <span className="tabular break-all">{criteria.value?.computed_digest || "—"}</span>
            {criteria.value && criteria.value.criteria_digest !== "" && (
              <span className={`ml-2 marginal ${digestAgrees ? "text-compatible" : "text-breaking"}`}>
                {digestAgrees ? "agrees" : "disagrees"}
              </span>
            )}
          </Datum>
        </div>

        <div className="mt-8">
          <RequirementList
            items={
              held.requirements.length > 0
                ? held.requirements
                : (criteria.value?.requirements ?? []).map(([rid, statement, severity]) => ({
                    requirement_id: rid,
                    statement,
                    severity,
                  }))
            }
          />
        </div>

        {held.rules && (
          <details className="mt-8">
            <summary className="marginal cursor-pointer">the aggregation rules, as frozen</summary>
            <pre className="inset mt-3 overflow-auto px-3 py-3 text-[0.8125rem] leading-relaxed whitespace-pre-wrap text-bone-faint">
              {held.rules}
            </pre>
          </details>
        )}
      </Section>

      {!frozen && (
        <Section label={isCreator ? "add a requirement, then freeze" : "the criteria are not yet frozen"}>
          {isCreator ? (
            <>
              <p className="measure text-sm text-bone-dim">
                Only the creator wallet can do this, and only while the specification is unfrozen.
                Once frozen, nothing here can move.
              </p>
              <AddRequirement
                specificationId={held.specification_id}
                session={session}
                existing={held.requirements.map((r) => r.requirement_id)}
                count={held.requirement_count}
                onChanged={reloadAll}
              />
              <FreezeSpecification
                specificationId={held.specification_id}
                session={session}
                count={held.requirement_count}
                onChanged={reloadAll}
              />
            </>
          ) : (
            <p className="measure text-sm text-bone-dim">
              This specification is still the creator&rsquo;s to change, so a proposal submitted now
              could be judged against criteria that move. Dev assesses nothing until the criteria are
              frozen.
            </p>
          )}
        </Section>
      )}

      {frozen && (
        <Section label="submit a proposed version">
          <p className="measure text-sm text-bone-dim">
            Anyone may propose. The panel reads the baseline, each frozen requirement, and your
            proposal, and answers requirement by requirement. Nothing is written unless the
            validators agree.
          </p>
          <Propose
            specificationId={held.specification_id}
            specificationName={held.name}
            session={session}
            frozen={frozen}
            criteriaDigest={criteria.value?.criteria_digest ?? held.criteria_digest}
            baselineVersion={held.baseline_version}
          />
        </Section>
      )}

      <Section label={`assessments of ${held.specification_id}`}>
        {assessments.busy && <Waiting what="reading the assessments" />}
        {!assessments.busy && rows.length === 0 && (
          <p className="marginal">no proposal has been assessed yet</p>
        )}
        {rows.length > 0 && (
          <ul className="border-t border-rule">
            {rows.map((row) => (
              <li key={row.assessment_id} className="border-b border-rule">
                <Link
                  href={`/assessment/${row.assessment_id}`}
                  className="block px-1 py-5 transition-colors hover:bg-ink-850"
                >
                  <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
                    <span className="ruleid">{row.assessment_id}</span>
                    <VerdictBadge verdict={row.verdict} />
                    <span className="ml-auto tabular text-bone-ghost">
                      {row.proposed_version}
                    </span>
                  </div>
                  <p className="measure mt-3 text-sm text-bone-dim">{row.summary}</p>
                  <p className="tabular mt-2 text-bone-ghost" title={row.submitted_by}>
                    {shortAddress(row.submitted_by)} · {moment(row.submitted_at)} · criteria{" "}
                    {shortHash(row.criteria_digest, 16)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
