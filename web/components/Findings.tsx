"use client";

import { SeverityMark, StatusMark } from "./ui";
import type { Finding } from "@/lib/types";

/**
 * The findings, requirement by requirement. Each one shows the status the
 * panel answered and the status grounding made of it, whether the quotation was
 * found in the documents, and the quotation itself. The two statuses are shown
 * side by side because they can differ: a decisive answer the evidence does not
 * carry becomes UNCLEAR, and hiding that would hide the only thing that kept a
 * wrong answer out of the verdict.
 */
export function Findings({ items }: { items: readonly Finding[] }) {
  if (!items || items.length === 0) {
    return <p className="marginal">no findings</p>;
  }
  return (
    <ol className="space-y-8">
      {items.map((item) => (
        <li key={item.requirement_id} className="sheet px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
            <span className="ruleid text-bone-dim">{item.requirement_id}</span>
            <StatusMark status={item.effective_status} held={item.held_for_grounding} />
            {item.held_for_grounding && (
              <span className="marginal">
                answered {item.status} · not grounded
              </span>
            )}
            {item.grounded_in.length > 0 && (
              <span className="marginal ml-auto">grounded in {item.grounded_in.join(" + ")}</span>
            )}
          </div>

          <p className="mt-3 text-sm text-bone">{item.statement}</p>

          {item.evidence && (
            <blockquote className="inset mt-3 px-3 py-2 text-sm text-bone-dim">
              <span className="marginal block">quoted</span>
              <span className="mt-1 block">{item.evidence}</span>
            </blockquote>
          )}
          {item.reasoning && (
            <p className="mt-3 text-sm text-bone-faint">{item.reasoning}</p>
          )}
        </li>
      ))}
    </ol>
  );
}

/** The requirement list as it is stored, before any change is proposed. */
export function RequirementList({
  items,
}: {
  items: ReadonlyArray<{ requirement_id: string; statement: string; severity: string }>;
}) {
  if (!items || items.length === 0) {
    return <p className="marginal">no requirements yet</p>;
  }
  return (
    <ol className="space-y-4">
      {items.map((item) => (
        <li key={item.requirement_id} className="flex gap-4 border-t border-rule pt-4">
          <span className="ruleid w-20 flex-none pt-0.5 text-bone-dim">{item.requirement_id}</span>
          <span className="flex-1 text-sm text-bone">{item.statement}</span>
          <span className="flex-none">
            <SeverityMark severity={item.severity} />
          </span>
        </li>
      ))}
    </ol>
  );
}
