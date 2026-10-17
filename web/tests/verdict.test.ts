// The words, held to the contract's vocabularies.
//
// Nothing here invents a value: every verdict, status and severity the app can
// show is one the contract can store, and tests/fixtures.json is the contract's
// own list. A page that could render a word the contract cannot produce would be
// a page describing a state that does not exist.

import { describe, expect, it } from "vitest";

import { bytes, moment, plural, shortAddress, shortHash } from "@/lib/format";
import {
  SEVERITY_PROSE,
  STATE_PROSE,
  STATUS_PROSE,
  STATUS_TONE,
  VERDICT_PROSE,
  VERDICT_TONE,
  isVerdict,
  verdictProse,
  verdictTone,
} from "@/lib/verdict";

import fixture from "./fixtures.json";

describe("the vocabularies", () => {
  it("cover exactly the verdicts the contract can record", () => {
    expect(Object.keys(VERDICT_PROSE).sort()).toEqual([...fixture.vocabulary.verdicts].sort());
    expect(Object.keys(VERDICT_TONE).sort()).toEqual([...fixture.vocabulary.verdicts].sort());
  });

  it("cover exactly the finding statuses the contract can record", () => {
    expect(Object.keys(STATUS_PROSE).sort()).toEqual([...fixture.vocabulary.finding_statuses].sort());
    expect(Object.keys(STATUS_TONE).sort()).toEqual([...fixture.vocabulary.finding_statuses].sort());
  });

  it("cover exactly the states and severities the contract can store", () => {
    expect(Object.keys(STATE_PROSE).sort()).toEqual([...fixture.vocabulary.states].sort());
    expect(Object.keys(SEVERITY_PROSE).sort()).toEqual([...fixture.vocabulary.severities].sort());
  });
});

describe("verdict helpers", () => {
  it("recognise the three verdicts and nothing else", () => {
    expect(isVerdict("COMPATIBLE")).toBe(true);
    expect(isVerdict("BREAKING_CHANGE")).toBe(true);
    expect(isVerdict("INCONCLUSIVE")).toBe(true);
    expect(isVerdict("COMPATIBLE ")).toBe(false);
    expect(isVerdict("PASS")).toBe(false);
    expect(isVerdict("")).toBe(false);
  });

  it("fall back to the inconclusive wording for anything unrecognised", () => {
    expect(verdictTone("PASS")).toBe(VERDICT_TONE.INCONCLUSIVE);
    expect(verdictProse("PASS")).toBe("");
  });
});

describe("formatting", () => {
  it("shortens an address without shortening a short one into nonsense", () => {
    expect(shortAddress("")).toBe("—");
    expect(shortAddress("0x4184bc5E5444F250767E8D33A49817A9B4FB0df3")).toBe("0x4184…0df3");
    expect(shortAddress("0x1234")).toBe("0x1234");
  });

  it("shortens a hash to the requested head", () => {
    expect(shortHash("")).toBe("—");
    expect(shortHash("0".repeat(64), 10)).toBe(`${"0".repeat(10)}…`);
    expect(shortHash("0x1234", 10)).toBe("0x1234");
  });

  it("says a timestamp the way the contract writes one", () => {
    expect(moment("2026-10-17T14:25:04Z")).toBe("2026-10-17 14:25:04 UTC");
    expect(moment("")).toBe("—");
  });

  it("counts bytes and plurals plainly", () => {
    expect(bytes(20000)).toBe("20,000 bytes");
    expect(bytes("not a number")).toBe("—");
    expect(plural(1, "requirement")).toBe("1 requirement");
    expect(plural(3, "requirement")).toBe("3 requirements");
    expect(plural(0, "requirement")).toBe("0 requirements");
  });
});
