import Link from "next/link";

import { CONTRACT_ADDRESS, CONTRACT_SET, NETWORK_NAME, explorerAddress } from "@/lib/chain";
import { shortAddress } from "@/lib/format";
import { STATUS_PROSE, VERDICT_PROSE } from "@/lib/verdict";
import type { FindingStatus, Verdict } from "@/lib/types";

import { Section, StatusMark, VerdictBadge } from "@/components/ui";

const MOVES = [
  {
    label: "freeze",
    title: "The requirement is frozen first",
    body:
      "A specification is registered with the exact bytes of its baseline, then pinned with the " +
      "requirements it must keep. Freezing seals both. From then on the criteria are not the " +
      "author's to move — not during an assessment, not after one.",
  },
  {
    label: "submit",
    title: "Anyone may submit a proposed version",
    body:
      "No permission, no review queue. A proposal is the whole document as it should read, " +
      "offered against the requirements that were frozen before it was written. A submission may " +
      "not name criteria other than the frozen ones.",
  },
  {
    label: "read",
    title: "Validators read both, requirement by requirement",
    body:
      "Independent models read the baseline, the requirement and the proposal separately, and " +
      "answer SATISFIED, VIOLATED or UNCLEAR for that one requirement. Each answer must quote the " +
      "proposal; a quotation that is not found there cannot stand.",
  },
  {
    label: "record",
    title: "Deterministic code records the verdict",
    body:
      "The answers are aggregated by fixed rules, not by a model: a violation is a breaking " +
      "change, an unclear answer is inconclusive, and only a clean sweep is compatible. " +
      "Uncertainty fails closed.",
  },
];

const RULES = [
  {
    title: "Requirements cannot move after the freeze",
    body: "Adding, rewording or removing a requirement is refused once a specification is frozen.",
  },
  {
    title: "No self-certification",
    body:
      "A submission and its evaluation are one transaction. There is no state in which an " +
      "assessment exists without an answer, and no party can certify its own change.",
  },
  {
    title: "Disagreement writes nothing",
    body:
      "If the validators do not agree, the specification is left exactly as it was and anyone " +
      "may ask again. An assessment that was never agreed never happened.",
  },
  {
    title: "Evidence is checked, not just read",
    body:
      "An answer's quotation is looked for in the documents. A decisive answer the evidence does " +
      "not carry is held to UNCLEAR.",
  },
  {
    title: "The documents cannot instruct the judge",
    body:
      "Text inside a baseline or a proposal is data, never a rule. Injected directions are " +
      "detected and reported, and the contract asks for no verdict the documents could dictate.",
  },
  {
    title: "No owner, no admin, no upgrade",
    body:
      "There is no privileged address in the contract. Every transition is visible in a write " +
      "transaction and its resulting views.",
  },
];

export default function Landing() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
      <section className="pt-16 pb-4 sm:pt-24">
        <p className="marginal">GenLayer · {NETWORK_NAME}</p>
        <h1 className="display mt-6 text-[2.6rem] leading-[1.03] sm:text-[3.6rem]">
          Freeze the requirement.
          <br />
          Submit the change.
          <br />
          Validators read both.
          <br />
          Code records the verdict.
        </h1>
        <p className="lede measure mt-8">
          Dev answers one question about a specification and a change to it: does the change still
          satisfy what was frozen? A diff says what moved. Dev says whether what moved still holds —
          requirement by requirement, with the evidence quoted and the answer recorded on chain.
        </p>
        <div className="mt-9 flex flex-wrap items-center gap-3">
          <Link className="press press-filled" href="/new">
            register a specification
          </Link>
          <Link className="press" href="/specs">
            read the record
          </Link>
          <Link className="press" href="/verify">
            verify a verdict
          </Link>
        </div>
        <p className="tabular mt-6 text-bone-ghost">
          contract{" "}
          {CONTRACT_SET ? (
            explorerAddress(CONTRACT_ADDRESS) ? (
              <a
                className="link"
                href={explorerAddress(CONTRACT_ADDRESS)}
                target="_blank"
                rel="noreferrer"
              >
                {shortAddress(CONTRACT_ADDRESS)}
              </a>
            ) : (
              shortAddress(CONTRACT_ADDRESS)
            )
          ) : (
            "not deployed"
          )}
        </p>
      </section>

      <Section label="a diff, and a verdict">
        <div className="grid gap-px overflow-hidden border border-rule bg-rule sm:grid-cols-2">
          <div className="bg-ink-900 px-5 py-6">
            <p className="marginal">what a diff answers</p>
            <p className="mt-4 text-lg text-bone">Did the text change?</p>
            <p className="measure mt-3 text-sm text-bone-dim">
              A diff reports the moved lines. It cannot tell you whether the change kept the promise
              the original made to the things that depend on it, and it has no memory of which
              promises were the ones that mattered.
            </p>
            <pre className="inset mt-5 overflow-x-auto px-3 py-3 text-[0.75rem] leading-relaxed text-bone-faint">
{`- retries: 3
+ retries: 1
- header: X-Signature
+ header: X-Legacy-Signature`}
            </pre>
          </div>
          <div className="bg-ink-900 px-5 py-6">
            <p className="marginal">what Dev answers</p>
            <p className="mt-4 text-lg text-bone">
              Does it still satisfy R-DEL-004?
            </p>
            <p className="measure mt-3 text-sm text-bone-dim">
              Dev reads the frozen requirement, the baseline and the proposal together, and records
              which of them the change kept. The answer is about the requirement, not about the
              text: the same edit can be a compatible rewrite in one place and a breaking change in
              another.
            </p>
            <ul className="mt-5 space-y-2 text-sm">
              <li className="flex items-baseline gap-3">
                <span className="ruleid w-16 flex-none">R-DEL-004</span>
                <StatusMark status={"SATISFIED" as FindingStatus} />
                <span className="text-bone-faint">“a delivery is retried three times…”</span>
              </li>
              <li className="flex items-baseline gap-3">
                <span className="ruleid w-16 flex-none">R-DEL-003</span>
                <StatusMark status={"VIOLATED" as FindingStatus} />
                <span className="text-bone-faint">the signature header was renamed</span>
              </li>
            </ul>
          </div>
        </div>
      </Section>

      <Section label="the four moves">
        <ol className="grid gap-px overflow-hidden border border-rule bg-rule sm:grid-cols-2 lg:grid-cols-4">
          {MOVES.map((move, index) => (
            <li key={move.label} className="bg-ink-900 px-5 py-6">
              <p className="marginal">
                {String(index + 1).padStart(2, "0")} · {move.label}
              </p>
              <p className="mt-4 text-bone">{move.title}</p>
              <p className="mt-3 text-sm text-bone-dim">{move.body}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section label="three verdicts, and nothing in between">
        <div className="space-y-5">
          {(Object.keys(VERDICT_PROSE) as Verdict[]).map((verdict) => (
            <div key={verdict} className="flex flex-wrap items-baseline gap-x-6 gap-y-2 border-t border-rule pt-5">
              <div className="w-52 flex-none">
                <VerdictBadge verdict={verdict} />
              </div>
              <p className="measure text-sm text-bone-dim">{VERDICT_PROSE[verdict]}</p>
            </div>
          ))}
        </div>
        <p className="measure mt-8 text-sm text-bone-faint">
          {STATUS_PROSE.UNCLEAR} An unsettled requirement does not become a pass by default, and it
          does not become a violation either: it makes the whole verdict inconclusive, which is the
          only honest answer when the documents do not settle it.
        </p>
      </Section>

      <Section label="what it refuses to do">
        <div className="grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {RULES.map((rule) => (
            <div key={rule.title}>
              <p className="text-bone">{rule.title}</p>
              <p className="mt-2 text-sm text-bone-dim">{rule.body}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section label="begin">
        <div className="flex flex-wrap gap-3">
          <Link className="press press-filled" href="/new">
            freeze a specification
          </Link>
          <Link className="press" href="/specs">
            see what is frozen today
          </Link>
        </div>
      </Section>
    </div>
  );
}
