# Security

Dev's security claim is narrow and testable:

> No party — author, operator, model or validator — can produce a verdict that the frozen criteria,
> the recorded answers, and the contract's own rules do not derive. Where it cannot tell, it says
> so and fails closed.

This document states the properties that carry that claim, the mechanisms behind each, and what is
explicitly out of scope. The adversarial catalogue — every attack and its mitigation, including the
ones nothing stops — is in [THREAT_MODEL.md](THREAT_MODEL.md).

---

## Properties

### 1. The criteria cannot move

A specification's requirements and baseline are sealed by `freeze_specification` (`R-FRZ-1`).
`add_requirement` refuses on a frozen specification (`R-REQ-2`), and no method edits, reorders or
deletes a requirement. There is no unfreeze.

**Why it matters:** every verdict is "compatible *with respect to* these requirements". If the
requirements could move, the verdict would be unfalsifiable.

**Asserted by:** `tests/test_registry.py` (freeze is one-way, adding after freeze is refused),
`tests/test_adversarial.py` (criteria drift).

### 2. A verdict cannot be re-parented

`submit_assessment` requires `expected_criteria_digest` to equal the frozen digest, or it refuses
with `[CRITERIA_MISMATCH]` before reading either document (`R-ASM-2`). The digest is recomputed on
chain from the stored baseline hash and the stored requirement rows (`R-FRZ-3`), and re-checked
after consensus (`R-ASM-9`). An assessment therefore always names exactly the criteria that produced
it.

**Asserted by:** `tests/test_registry.py`, and the live run's wrong-criteria refusal
(`docs/END-TO-END.md`).

### 3. The verdict is derived, never spoken

No method accepts a verdict. `derive_verdict` maps the settled finding statuses to
`COMPATIBLE` / `BREAKING_CHANGE` / `INCONCLUSIVE` (`R-VRD-1`), and it is pure. A violation outranks
an unsettled requirement, so resolving an ambiguity can never turn a violation into a pass.
`decisive_digest` is taken over requirement id, answered status, and effective status — **not** over
reasoning or the wording of a quotation, so a validator must independently reproduce the *answers*,
not repeat a sentence.

**Asserted by:** `tests/test_rules.py` (aggregation edge cases), `tests/test_panel.py`.

### 4. Answers must be grounded

`derive_findings` accepts an answer only if it carries a run of `QUOTE_WORDS = 6` consecutive words
that really appears in the right document (`R-GRD-3`, `R-GRD-4`). A `SATISFIED` answer must quote the
**proposed** document. A decisive answer that fails grounding is held to `UNCLEAR`
(`R-GRD-5`), and the floor applies to `SATISFIED` exactly as to `VIOLATED`, so it cannot be used to
favour one side.

**Asserted by:** `tests/test_rules.py` (grounding, non-contiguous citations, markup,
`transaction_id` vs `transactionid`), `tests/test_adversarial.py` (a decisive wrong answer held).

### 5. Documents are data, never instructions

- Three or more angle brackets in a row are replaced with a space, never deleted (`R-INJ-1`), so a
  document cannot close the fence it is read inside and a reader can still see that something was
  there.
- Instruction-shaped text is recorded as a signal and otherwise ignored (`R-INJ-2`).
- The prompt fences both documents as evidence and says so in as many words.
- **Nothing in a document can reach a status or a verdict**: statuses must be grounded against the
  documents, and the verdict is derived from statuses.

**Asserted by:** `tests/test_adversarial.py` (injected prose changes nothing; signals recorded), and
the live run's poisoned-rewrite case.

### 6. Disagreement writes nothing

A round that does not agree writes nothing at all (`R-ASM-9`). The specification is left exactly as
it was and anyone may ask again. There is no state in which an assessment exists without an answer,
so an unagreed proposal cannot be cited later as if it had been evaluated.

**Asserted by:** `tests/test_panel.py` (validator dissent → no storage change).

### 7. Nobody certifies themselves

- Submission and evaluation are one transaction, so the submitter's own claim is never stored.
- The creator's authority ends at the freeze (`R-FRZ-1`).
- Creator-only operations check `gl.message.sender_address`, never an argument (`R-REQ-1`).
- There is no owner, admin or upgrade path; `deployer` is recorded and never consulted (`R-REG-4`).

**Asserted by:** `tests/test_registry.py` (a stranger is `[UNAUTHORIZED]`), and
`scripts/schema.mjs` against the deployed code.

### 8. Input is bounded

Every field has a declared ceiling checked before storage (`docs/PROTOCOL.md` §8). Listings cap at
`MAX_PAGE = 100`. The evidence and reasoning fields are truncated to their maxima, so no answer can
bloat the record.

### 9. Refusals are classified, not prose-matched

Every refusal begins with a bracketed class (`R-LIM-4`), so a client branches on the kind of refusal
and is not coupled to the wording of a message. The console's error surface and the scripts'
expected-refusal checks both use this.

---

## Reading a verdict honestly

A verdict is an assertion about *documents*, and the record is built so a reader can check it rather
than believe it:

- `get_assessment` returns every finding with **both** the answered `status` and the
  `effective_status` grounding made of it, plus `held_for_grounding` and `grounded_in`;
- `get_findings` returns the `decisive_digest`, so an answers-set can be rehashed independently;
- `get_criteria` returns `criteria_digest` **and** `computed_digest`, so the recorded criteria can be
  compared against a fresh recomputation;
- `/verify` does all of that in the browser, from the documents the contract returned.

## Cryptography

`sha256` only, over UTF-8, with one canonical spelling of JSON (`json.dumps` with sorted keys, no
whitespace, `ensure_ascii=True`). The same spelling is implemented in Python (the contract), in
Node (`scripts/canon.mjs`) and in the browser (`web/lib/canon.ts`), and the browser's is held to the
contract's by `web/tests/canon.test.ts` against fixtures generated by the contract itself.

Digests here are used for **binding and comparison**, not for secrecy or authentication. There are
no keys, no signatures inside the contract, and no secrets in the repository.

## Out of scope

- **Truth of a document.** Dev cannot know whether a service behaves as written. The scope string is
  stored in every assessment to say so.
- **Authorship, ownership or publication** of a document.
- **Document quality.** A well-formed verdict about a vague requirement is still a verdict about a
  vague requirement.
- **Model correctness in general.** Dev constrains what a wrong model answer can *become* (refused or
  held), not whether a model reads well.
- **Confidentiality.** Everything submitted is public and permanent.
- **Liveness.** A round may fail; the protocol is fail-closed, not fail-proof.

## Secrets

The repository contains none. `.env` holds `DEV_PRIVATE_KEY` for local scripting and is ignored;
`.env.local` for the console is ignored. The console never receives a key: it builds a
`genlayer-js` client with the connected address and the EIP-1193 provider so signing happens in the
wallet.

## Reporting a vulnerability

Attack the properties above. [REVIEW_TARGET.md](REVIEW_TARGET.md) lists, in order, what a reviewer
should try to break, and the `tests/` tree is the executable statement of what is already claimed.
