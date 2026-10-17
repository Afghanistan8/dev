"use client";

import { CONTRACT_SET } from "@/lib/chain";

import { RegisterSpec } from "@/components/RegisterSpec";
import { useWallet } from "@/components/Wallet";
import { Section } from "@/components/ui";

export default function NewSpecification() {
  const { session } = useWallet();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
      <section className="pt-14">
        <p className="marginal">step one</p>
        <h1 className="display mt-5 text-[2rem] sm:text-[2.6rem]">Register a specification</h1>
        <p className="lede measure mt-5">
          Give the document a name, and paste the exact version that later changes will be measured
          against. What is stored is these bytes — hashed, on chain, and never re-fetched from the
          source you cite. The source reference is a courtesy for readers; the bytes are the
          baseline.
        </p>
        {!CONTRACT_SET && (
          <p className="mt-6 border border-breaking/40 bg-breaking/10 px-3 py-2 text-sm text-breaking">
            No contract address is configured, so this page cannot reach Dev. Deploy the contract
            and set NEXT_PUBLIC_DEV_CONTRACT.
          </p>
        )}
      </section>

      <RegisterSpec session={session} />

      <Section label="what happens next">
        <p className="measure text-sm text-bone-dim">
          The specification is registered in DRAFT: a baseline and nothing to hold it to. Add the
          requirements next — each one a sentence a reader can answer — and freeze when they are the
          ones you mean. A signature lands on every one of those steps, and each is a separate
          record on the chain.
        </p>
      </Section>
    </div>
  );
}
