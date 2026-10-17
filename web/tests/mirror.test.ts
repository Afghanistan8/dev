// The form checks against the contract's.
//
// Every rule in lib/validation.ts is also enforced in contracts/dev.py, which is
// the only place it counts. The point of the copy is that nobody spends a
// transaction to be told their requirement id is malformed. tests/fixtures.json
// carries the contract's own limits, vocabulary and id pattern, so this file
// fails the moment the mirror drifts.

import { describe, expect, it } from "vitest";

import {
  MAX_CONTENT,
  MAX_DESCRIPTION,
  MAX_ID,
  MAX_NAME,
  MAX_REQUIREMENTS,
  MAX_SOURCE,
  MAX_STATEMENT,
  MAX_VERSION,
  MIN_CONTENT,
  REQUIREMENT_ID,
  SEVERITIES,
  checkProposal,
  checkRequirement,
  checkSpecification,
  complaintFor,
} from "@/lib/validation";

import fixture from "./fixtures.json";

describe("the numbers", () => {
  it("are the contract's", () => {
    expect(MAX_NAME).toBe(fixture.limits.MAX_NAME);
    expect(MAX_DESCRIPTION).toBe(fixture.limits.MAX_DESCRIPTION);
    expect(MAX_VERSION).toBe(fixture.limits.MAX_VERSION);
    expect(MAX_SOURCE).toBe(fixture.limits.MAX_SOURCE);
    expect(MAX_CONTENT).toBe(fixture.limits.MAX_CONTENT);
    expect(MIN_CONTENT).toBe(fixture.limits.MIN_CONTENT);
    expect(MAX_REQUIREMENTS).toBe(fixture.limits.MAX_REQUIREMENTS);
    expect(MAX_STATEMENT).toBe(fixture.limits.MAX_STATEMENT);
    expect(MAX_ID).toBe(fixture.limits.MAX_ID);
  });

  it("lists the severities the contract accepts, in its order", () => {
    expect([...SEVERITIES]).toEqual(fixture.vocabulary.severities);
  });
});

describe("the requirement id pattern", () => {
  it("is the contract's pattern", () => {
    expect(REQUIREMENT_ID.source).toBe(fixture.requirement_id.pattern);
  });

  it("accepts exactly what the contract accepts", () => {
    for (const id of fixture.requirement_id.accept) {
      expect(REQUIREMENT_ID.test(id), `${id} should be accepted`).toBe(true);
    }
    for (const id of fixture.requirement_id.reject) {
      expect(REQUIREMENT_ID.test(id), `${id} should be rejected`).toBe(false);
    }
  });
});

describe("checkSpecification", () => {
  const good = {
    name: "Webhook Delivery Specification",
    description: "The delivery contract an event receiver depends on.",
    version: "1.0.0",
    source: "https://example.test/webhooks/v1",
    content: "A delivery attempt carries an idempotency key.",
  };

  it("passes a specification the contract would accept", () => {
    expect(checkSpecification(good)).toEqual([]);
  });

  it("requires a name, a description and a version", () => {
    expect(complaintFor(checkSpecification({ ...good, name: "  " }), "name")?.code).toBe(
      "INVALID_INPUT",
    );
    expect(
      complaintFor(checkSpecification({ ...good, description: "" }), "description")?.code,
    ).toBe("INVALID_INPUT");
    expect(complaintFor(checkSpecification({ ...good, version: "" }), "version")?.code).toBe(
      "INVALID_INPUT",
    );
  });

  it("holds the length limits", () => {
    expect(
      complaintFor(checkSpecification({ ...good, name: "x".repeat(MAX_NAME + 1) }), "name")?.code,
    ).toBe("LIMIT");
    expect(
      complaintFor(checkSpecification({ ...good, content: "x".repeat(MAX_CONTENT + 1) }), "content")
        ?.code,
    ).toBe("LIMIT");
  });

  it("refuses three angle brackets in a row", () => {
    expect(complaintFor(checkSpecification({ ...good, name: "a<<<b" }), "name")?.code).toBe(
      "INVALID_INPUT",
    );
    expect(
      complaintFor(checkSpecification({ ...good, content: "a<<<b" }), "content")?.code,
    ).toBe("INVALID_INPUT");
  });

  it("lets an empty source reference through", () => {
    expect(checkSpecification({ ...good, source: "" })).toEqual([]);
  });
});

describe("checkRequirement", () => {
  const base = {
    id: "PAY-001",
    statement: "Every successful response includes a transaction identifier.",
    severity: "BLOCKING",
    existing: [] as string[],
    count: 0,
  };

  it("passes a requirement the contract would accept", () => {
    expect(checkRequirement(base)).toEqual([]);
  });

  it("uppercases the id, as the contract does", () => {
    expect(checkRequirement({ ...base, id: "pay-001" })).toEqual([]);
  });

  it("refuses an id the contract would refuse", () => {
    expect(complaintFor(checkRequirement({ ...base, id: "PAY_001" }), "id")?.code).toBe(
      "INVALID_REQUIREMENT",
    );
    expect(complaintFor(checkRequirement({ ...base, id: "" }), "id")?.code).toBe(
      "INVALID_REQUIREMENT",
    );
  });

  it("refuses an id already on the specification", () => {
    expect(
      complaintFor(checkRequirement({ ...base, existing: ["PAY-001"] }), "id")?.code,
    ).toBe("INVALID_REQUIREMENT");
  });

  it("refuses a severity the contract does not know", () => {
    expect(
      complaintFor(checkRequirement({ ...base, severity: "SEVERE" }), "severity")?.code,
    ).toBe("INVALID_REQUIREMENT");
  });

  it("holds the statement limit and the requirement count", () => {
    expect(
      complaintFor(checkRequirement({ ...base, statement: "x".repeat(MAX_STATEMENT + 1) }), "statement")
        ?.code,
    ).toBe("LIMIT");
    expect(
      complaintFor(checkRequirement({ ...base, count: MAX_REQUIREMENTS }), "id")?.code,
    ).toBe("LIMIT");
  });
});

describe("checkProposal", () => {
  const base = {
    version: "1.1.0",
    content: "A delivery attempt carries an idempotency key.",
    frozen: true,
    criteriaDigest: "a".repeat(64),
  };

  it("passes a proposal against frozen criteria", () => {
    expect(checkProposal(base)).toEqual([]);
  });

  it("refuses a proposal against unfrozen criteria", () => {
    expect(complaintFor(checkProposal({ ...base, frozen: false }), "content")?.code).toBe(
      "WRONG_STATE",
    );
  });

  it("refuses a proposal that names no criteria digest", () => {
    expect(complaintFor(checkProposal({ ...base, criteriaDigest: "" }), "content")?.code).toBe(
      "CRITERIA_MISMATCH",
    );
  });

  it("holds the same content limits as the contract", () => {
    expect(complaintFor(checkProposal({ ...base, content: "  " }), "content")?.code).toBe(
      "INVALID_INPUT",
    );
    expect(
      complaintFor(checkProposal({ ...base, content: "x".repeat(MAX_CONTENT + 1) }), "content")?.code,
    ).toBe("LIMIT");
    expect(complaintFor(checkProposal({ ...base, content: "a<<<b" }), "content")?.code).toBe(
      "INVALID_INPUT",
    );
  });

  it("holds the proposed version limit", () => {
    expect(
      complaintFor(checkProposal({ ...base, version: "x".repeat(MAX_VERSION + 1) }), "version")?.code,
    ).toBe("LIMIT");
  });
});
