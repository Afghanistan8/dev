"use client";

import { CONTRACT_SET } from "@/lib/chain";

import { Section } from "@/components/ui";
import { VerifyAssessment, VerifySpecification } from "@/components/Verify";

export default function Verify() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
      <section className="pt-14">
        <p className="marginal">check it yourself</p>
        <h1 className="display mt-5 text-[2rem] sm:text-[2.6rem]">Verify a record</h1>
        <p className="lede measure mt-5">
          A verdict is worth what its evidence is worth. Every digest Dev records can be recomputed
          here, in this browser, from the documents the contract itself returns — the criteria
          digest from the frozen requirements, the baseline hash from the stored baseline, the
          decisive digest from the panel&rsquo;s answers. If a recomputation disagrees with the
          record, the record is not verified, and this page says so.
        </p>
        {!CONTRACT_SET && (
          <p className="mt-6 border border-breaking/40 bg-breaking/10 px-3 py-2 text-sm text-breaking">
            No contract address is configured, so there is nothing to verify against.
          </p>
        )}
      </section>

      <Section label="the criteria a verdict was decided against">
        <VerifySpecification />
      </Section>

      <Section label="the answers a verdict was decided from">
        <VerifyAssessment />
      </Section>

      <Section label="why the digests are the point">
        <p className="measure text-sm text-bone-dim">
          An assessment names the criteria digest it was reached against, and the contract refuses a
          submission that names anything else. So a verdict cannot be quietly re-parented to a
          different set of requirements later. And because the decisive digest covers the answers
          and nothing else, the panel had to agree about the answers themselves — not about a
          summary that hides them.
        </p>
      </Section>
    </div>
  );
}
