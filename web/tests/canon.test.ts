// The client's digests against the contract's own.
//
// tests/fixtures.json is produced by loading contracts/dev.py against the test
// runtime double and calling the contract's own `_canon`, `criteria_digest` and
// `decisive_digest`. So these assertions are not "two hand-written copies
// agree" -- they are the browser and the chain agreeing about the same bytes.

import { describe, expect, it } from "vitest";

import { baselineHash, canon, criteriaDigest, decisiveDigest, sha256Hex } from "@/lib/canon";

import fixture from "./fixtures.json";

describe("canon", () => {
  it("spells values exactly as the contract's json.dumps does", () => {
    for (const sample of fixture.canon_samples) {
      expect(canon(sample.value)).toBe(sample.canonical);
    }
  });

  it("sorts keys and drops all whitespace", () => {
    expect(canon({ b: 1, a: [1, 2] })).toBe('{"a":[1,2],"b":1}');
  });

  it("escapes non-ASCII and control characters rather than emitting them raw", () => {
    expect(canon("café")).toBe('"caf\\u00e9"');
    expect(canon("a\nb")).toBe('"a\\nb"');
    expect(canon("😀")).toBe('"\\ud83d\\ude00"');
  });

  it("treats a Map as the object it stands for", () => {
    const held = new Map<string, unknown>([
      ["b", 1],
      ["a", 2],
    ]);
    expect(canon(held)).toBe('{"a":2,"b":1}');
  });
});

describe("sha256", () => {
  it("hashes the empty string and 'abc' the way sha256 does", async () => {
    expect(await sha256Hex("")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
    expect(await sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});

describe("the baseline hash", () => {
  it("matches the contract, byte for byte", async () => {
    expect(await baselineHash(fixture.baseline)).toBe(fixture.baseline_hash);
  });
});

describe("the criteria digest", () => {
  it("matches the contract for a real set of frozen requirements", async () => {
    const held = await criteriaDigest(
      fixture.baseline_hash,
      fixture.requirements,
      fixture.rules,
    );
    expect(held).toBe(fixture.criteria_digest);
  });

  it("does not depend on the order the requirements arrive in", async () => {
    const forward = await criteriaDigest(fixture.baseline_hash, fixture.requirements, fixture.rules);
    const backward = await criteriaDigest(
      fixture.baseline_hash,
      [...fixture.requirements].reverse(),
      fixture.rules,
    );
    expect(backward).toBe(forward);
  });

  it("moves when a requirement's wording moves", async () => {
    const tampered = fixture.requirements.map((requirement, index) =>
      index === 0 ? { ...requirement, statement: `${requirement.statement} (amended)` } : requirement,
    );
    const held = await criteriaDigest(fixture.baseline_hash, tampered, fixture.rules);
    expect(held).not.toBe(fixture.criteria_digest);
  });

  it("moves when the rules move", async () => {
    const held = await criteriaDigest(
      fixture.baseline_hash,
      fixture.requirements,
      `${fixture.rules}\n(a rule nobody agreed to)`,
    );
    expect(held).not.toBe(fixture.criteria_digest);
  });
});

describe("the decisive digest", () => {
  it("matches the contract for a settled set of findings", async () => {
    expect(await decisiveDigest(fixture.findings)).toBe(fixture.decisive_digest);
  });

  it("covers the answered and the effective status, so a held answer is visible", async () => {
    const held = await decisiveDigest(
      fixture.findings.map((finding) =>
        finding.requirement_id === "PAY-002"
          ? { ...finding, status: "SATISFIED" }
          : finding,
      ),
    );
    expect(held).not.toBe(fixture.decisive_digest);
  });

  it("ignores the order the answers arrive in", async () => {
    const reversed = await decisiveDigest([...fixture.findings].reverse());
    expect(reversed).toBe(fixture.decisive_digest);
  });
});
