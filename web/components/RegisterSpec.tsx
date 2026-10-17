"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { baselineHash } from "@/lib/canon";
import { submit, type WalletSession } from "@/lib/dev";
import { MAX_CONTENT, complaintFor, checkSpecification, type Complaint } from "@/lib/validation";
import type { Submission } from "@/lib/types";

import { TransactionLine } from "./Transaction";
import { Complaints, Field } from "./ui";

const EXAMPLE = {
  name: "Webhook Delivery Specification",
  description:
    "The delivery contract an event receiver depends on, frozen before any change to it is proposed.",
  version: "1.0.0",
  source: "https://example.test/webhooks/v1",
  content: [
    "# Webhook Delivery Specification, version 1.0.0",
    "Every delivery attempt carries an idempotency key in the X-Idempotency-Key header.",
    "A delivery that fails is retried three times with exponential backoff.",
    "The receiver acknowledges a delivery by returning HTTP 200 with an empty body.",
    "Payloads are signed with HMAC-SHA256 and the signature travels in the X-Signature header.",
  ].join("\n\n"),
};

export function RegisterSpec({ session }: { session: WalletSession | null }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [version, setVersion] = useState("1.0.0");
  const [source, setSource] = useState("");
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
    () => checkSpecification({ name, description, version, content, source }),
    [name, description, version, content, source],
  );
  const blocking = complaints.length > 0;
  const settled = submission?.stage === "accepted" || submission?.stage === "finalized";

  async function run() {
    setTouched(true);
    if (!session || blocking) return;
    setBusy(true);
    const result = await submit(
      session,
      "register_specification",
      [name.trim(), description.trim(), version.trim(), content, digest, source.trim()],
      setSubmission,
    );
    setBusy(false);
    if (result.stage === "accepted" || result.stage === "finalized") {
      router.push("/specs");
    }
  }

  return (
    <div className="sheet mt-6 px-4 py-6 sm:px-6">
      <button
        type="button"
        className="press"
        onClick={() => {
          setName(EXAMPLE.name);
          setDescription(EXAMPLE.description);
          setVersion(EXAMPLE.version);
          setSource(EXAMPLE.source);
          setContent(EXAMPLE.content);
        }}
      >
        fill the example
      </button>

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <Field
          label="name"
          complaint={touched ? complaintFor(complaints, "name") : undefined}
        >
          <input
            className="field"
            value={name}
            placeholder="Webhook Delivery Specification"
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        <Field
          label="baseline version"
          complaint={touched ? complaintFor(complaints, "version") : undefined}
        >
          <input
            className="field"
            value={version}
            placeholder="1.0.0"
            onChange={(event) => setVersion(event.target.value)}
          />
        </Field>
      </div>

      <div className="mt-6">
        <Field
          label="what the specification covers"
          complaint={touched ? complaintFor(complaints, "description") : undefined}
        >
          <textarea
            className="field"
            rows={2}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </Field>
      </div>

      <div className="mt-6">
        <Field
          label="source reference"
          hint="optional — a URL is not the baseline; the bytes below are"
          complaint={touched ? complaintFor(complaints, "source") : undefined}
        >
          <input
            className="field"
            value={source}
            placeholder="https://example.test/webhooks/v1"
            onChange={(event) => setSource(event.target.value)}
          />
        </Field>
      </div>

      <div className="mt-6">
        <Field
          label="the baseline, exactly as it will be frozen"
          hint={`stored on chain, hashed, never re-fetched from a URL — up to ${MAX_CONTENT} characters`}
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
          {busy ? "submitting…" : settled ? "registered" : "register the specification"}
        </button>
        {!session && (
          <span className="marginal">connect a wallet to register</span>
        )}
      </div>

      <TransactionLine submission={submission} />
    </div>
  );
}

export type { Complaint };
