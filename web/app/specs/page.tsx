"use client";

import Link from "next/link";
import { useState } from "react";

import { useRead } from "@/lib/hooks";
import { bytes, moment, shortAddress, shortHash } from "@/lib/format";
import type { Page, Specification } from "@/lib/types";
import { STATE_PROSE } from "@/lib/verdict";

import { StateTrack, Waiting } from "@/components/ui";

const PAGE = 10;

export default function Specifications() {
  const [offset, setOffset] = useState(0);
  const { value, busy, error } = useRead<Page<Specification>>("list_specifications", [offset, PAGE]);

  const items = value?.items ?? [];
  const total = value?.total ?? 0;
  const from = total === 0 ? 0 : offset + 1;
  const to = offset + items.length;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
      <section className="pt-14">
        <p className="marginal">the record</p>
        <h1 className="display mt-5 text-[2rem] sm:text-[2.6rem]">Specifications</h1>
        <p className="lede measure mt-5">
          Every specification registered with Dev, newest first, with the state it is in. A
          specification in REGISTERED still carries the creator&rsquo;s to change; one that is
          FROZEN does not.
        </p>
      </section>

      {busy && <Waiting what="reading the register" />}

      {error && (
        <p className="mt-8 border border-breaking/40 bg-breaking/10 px-3 py-2 text-sm text-breaking">
          {error}
        </p>
      )}

      {!busy && !error && items.length === 0 && (
        <p className="measure mt-10 text-sm text-bone-dim">
          Nothing is registered yet.{" "}
          <Link className="link" href="/new">
            Register the first specification.
          </Link>
        </p>
      )}

      {items.length > 0 && (
        <>
          <ul className="mt-10 border-t border-rule">
            {items.map((spec) => (
              <li key={spec.specification_id} className="border-b border-rule">
                <Link
                  href={`/spec/${spec.specification_id}`}
                  className="block px-1 py-6 transition-colors hover:bg-ink-850"
                >
                  <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
                    <span className="ruleid">{spec.specification_id}</span>
                    <span className="text-lg text-bone">{spec.name}</span>
                    <span className="ml-auto">
                      <StateTrack state={spec.state} />
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-bone-dim">{STATE_PROSE[spec.state]}</p>
                  <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2">
                    <div className="flex items-baseline gap-2">
                      <dt className="marginal">requirements</dt>
                      <dd className="tabular text-bone-dim">{spec.requirement_count}</dd>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <dt className="marginal">assessments</dt>
                      <dd className="tabular text-bone-dim">{spec.assessment_count}</dd>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <dt className="marginal">baseline</dt>
                      <dd className="tabular text-bone-dim">
                        {spec.baseline_version} · {bytes(spec.baseline_bytes)}
                      </dd>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <dt className="marginal">creator</dt>
                      <dd className="tabular text-bone-dim" title={spec.creator}>
                        {shortAddress(spec.creator)}
                      </dd>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <dt className="marginal">frozen</dt>
                      <dd className="tabular text-bone-dim">
                        {spec.frozen ? moment(spec.frozen_at) : "—"}
                      </dd>
                    </div>
                  </dl>
                  {spec.criteria_digest && (
                    <p className="tabular mt-3 text-bone-ghost">
                      criteria {shortHash(spec.criteria_digest, 24)}
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>

          <div className="mt-6 flex items-center justify-between gap-4">
            <span className="marginal">{`showing ${from}–${to} of ${total}`}</span>
            <div className="flex gap-2">
              <button
                type="button"
                className="press"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - PAGE))}
              >
                newer
              </button>
              <button
                type="button"
                className="press"
                disabled={to >= total}
                onClick={() => setOffset(offset + PAGE)}
              >
                older
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
