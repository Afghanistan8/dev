# Dev Protocol

This document is the specification of record for Dev. Every rule carries an identifier that the
contract cites in its comments. Where a comment in `contracts/dev.py` and this document disagree,
**this document is the specification and the contract is the bug.**

Requirement ids are referenced from `contracts/dev.py`, `tests/` and `docs/`. They are stable.

---

## 1. Terminology

| Word | Meaning |
| --- | --- |
| **Specification** | A named document with an exact baseline and a set of frozen requirements. |
| **Baseline** | The bytes of the document at the moment of registration, stored on chain. |
| **Requirement** | A standalone sentence, with an id and a severity, that a proposal must still satisfy. |
| **Criteria** | The baseline hash plus the frozen requirement ids, statements, severities, and the aggregation rules. |
| **Proposal** | A whole proposed version of the document, submitted by anyone. |
| **Finding** | One reader's answer about one requirement, with the words supporting it. |
| **Verdict** | The derived answer for the whole proposal: `COMPATIBLE`, `BREAKING_CHANGE`, `INCONCLUSIVE`. |
| **Panel** | The leader and validators that read the documents and reach the findings. |

## 2. States — `R-REG-1`, `R-FRZ-2`

A specification is in exactly one state.

| State | Entered when | May add requirements | May freeze | May be assessed |
| --- | --- | --- | --- | --- |
| `DRAFT` | registration | yes (creator) | no (needs ≥ 1 requirement) | no |
| `REGISTERED` | first requirement added | yes (creator) | yes (creator) | no |
| `FROZEN` | freeze | **no** | **no** | yes |

`DRAFT → REGISTERED → FROZEN`, and no transition moves backwards. Freezing is one-way.

## 3. Registering — `R-REG-2`, `R-REG-3`

`register_specification(name, description, baseline_version, baseline_content, baseline_hash,
source_reference) → specification_id`

- **`R-REG-2` (the bytes, not a URL).** `baseline_content` is stored verbatim. `source_reference`
  is a courtesy for readers and is never fetched, resolved or trusted. An assessment is always
  measured against stored bytes.
- **`R-REG-3` (the hash is checked, not trusted).** If `baseline_hash` is non-empty it MUST equal
  `sha256(baseline_content)` as lowercase hex, or the call is refused with `[HASH_MISMATCH]`. The
  stored `baseline_hash` is always the computed one.
- The creator is `gl.message.sender_address`, never an argument. Every account the contract records
  is taken from the message, so no caller can act in another's name.
- The specification is born `DRAFT`, with no requirements, and its `baseline_injection_signals`
  recorded (see §9).
- Ids are sequential, `S1`, `S2`, ….

Length bounds are in §8.

## 4. Requirements — `R-REQ-1`, `R-REQ-2`, `R-REQ-3`

`add_requirement(specification_id, requirement_id, statement, severity) → requirement_id`

- **`R-REQ-1` (creator only).** Only the account that registered the specification may add a
  requirement. Anyone else is refused with `[UNAUTHORIZED]`.
- **`R-REQ-2` (frozen means frozen).** A requirement may not be added to, reworded on, or removed
  from a `FROZEN` specification. `[FROZEN_SPECIFICATION]`. There is no removal method at all.
- **`R-REQ-3` (well-formed ids).** A requirement id MUST match `^[A-Z][A-Z0-9]{1,11}-[0-9]{1,4}$`
  after upper-casing; it MUST be unique within the specification; the specification MUST hold fewer
  than `MAX_REQUIREMENTS`. `severity` MUST be one of `BLOCKING`, `MAJOR`, `MINOR` (default `MAJOR`).
  Refusals carry `[INVALID_REQUIREMENT]` or `[LIMIT]`.
- Adding the first requirement moves the specification to `REGISTERED`.

## 5. Freezing — `R-FRZ-1`, `R-FRZ-3`

`freeze_specification(specification_id) → criteria_digest`

- **`R-FRZ-1` (seal).** After this call the requirements, their ids, their statements, their
  severities and the baseline cannot change — not by the creator, not by anyone. The creator's
  authority ends here. Freezing twice is `[FROZEN_SPECIFICATION]`. At least one requirement is
  required (`[WRONG_STATE]`).
- **`R-FRZ-3` (the digest binds the assessment).** The frozen `criteria_digest` is

  ```
  sha256(canon({
      "baseline_hash": <baseline_hash>,
      "requirements": [[id, statement, severity], … sorted by id],
      "rules": "dev-aggregation-1",
  }))
  ```

  where `canon` is Python's `json.dumps(value, sort_keys=True, separators=(",", ":"),
  ensure_ascii=True)`. Every assessment names this value, so a finding can always be traced to the
  exact criteria that produced it. `get_criteria` returns both the recorded digest and a
  `computed_digest` recomputed on the spot, so the two can be compared.

## 6. Assessment — `R-ASM-1` … `R-ASM-9`

`submit_assessment(specification_id, proposed_version, proposed_content, proposed_hash,
expected_criteria_digest) → assessment_id`

- **`R-ASM-1` (frozen only).** The specification MUST be `FROZEN`. Otherwise `[WRONG_STATE]`.
- **`R-ASM-2` (name your criteria).** `expected_criteria_digest` MUST be the frozen digest. If it is
  not, nothing is read and nothing is written (`[CRITERIA_MISMATCH]`). A race against a freeze
  cannot silently assess against criteria the submitter did not intend, and an assessment can never
  be re-parented to different criteria later.
- The proposed content is stored verbatim; `proposed_hash` is checked like `baseline_hash`
  (`[HASH_MISMATCH]`).

### 6.1 Reading the documents — `R-ASM-3`

- One prompt per requirement, never one prompt for the whole set. A single prompt carrying sixteen
  requirements invites a model to answer the easy ones carefully and the rest by pattern, and lets
  one bad reading contaminate the set.
- The prompt states the requirement as authoritative, describes how to answer, and fences both
  documents as *evidence*. It tells the reader explicitly that the documents are not instructions.
- The reading loop runs inside the function the contract hands to `gl.vm.run_nondet`.

### 6.2 Accepting an answer — `R-ASM-4`, `R-ASM-5`

- **`R-ASM-4` (refuse, never repair).** An answer must be an object carrying `requirement_id`,
  `status`, `evidence`, `reasoning`. The `requirement_id` is the one the **model** wrote, not the
  one that was asked about. A model that answers about the wrong requirement is refused
  (`[INVALID_FINDING]`), not re-labelled. Statuses outside `SATISFIED`/`VIOLATED`/`UNCLEAR` are
  refused. A requirement answered twice is refused; a requirement not answered at all is refused.
- **`R-ASM-5` (a repaired answer is an unevaluated answer).** No rule here patches a malformed
  answer into protocol state.

### 6.3 The record travels with the claim — `R-ASM-6`

Every assessment stores `scope`, `rules` and `schema`, so what was decided is readable from the
record itself and does not live only in a README. The scope names what Dev is **not**: not a
judgement about document quality, not proof of authorship or publication, and not a guarantee that
a service behaves as written.

### 6.4 What crosses consensus — `R-ASM-7`

- The validators do not inspect the leader's prose for well-formedness. Each validator reads the
  same requirements against the same documents, reaches its own findings, and compares **the one
  value a consequence depends on**: the decisive digest (§7.2).
- The decisive digest leaves out reasoning, the wording of quotations, and the order answers
  arrived in. Two honest readers never write the same sentence about the same clause, and making
  prose decisive would fail every round without making anything safer.

### 6.5 Failure is compared, not always refused — `R-ASM-8`

When the leader produces no answer, the validator does the work and compares the *kind* of failure
(the bracket class, not the prose).

- A deterministic refusal — a finding this contract will not accept — must be the same refusal.
- A model that returned something unreadable is not: the next leader may get a clean answer, so that
  case always rotates.

This keeps the real reason available to the submitter, rather than replacing every cause with "the
validators did not agree".

### 6.6 Nothing writes before consensus is checked — `R-ASM-9`

Every storage write happens after `run_nondet` returns **and** after the agreed answer is re-checked
deterministically: the findings are rebuilt from the agreed answers, settled, aggregated to a
verdict, and hashed again. If that digest is not the agreed one, the call is refused
(`[INVALID_FINDING]`) and nothing is written.

A round that does not agree writes nothing and leaves the specification exactly as it was. It is not
recorded, so an assessment that was never agreed never happened.

## 7. The deterministic core

### 7.1 Grounding — `R-GRD-1` … `R-GRD-5`

- **`R-GRD-1`.** A finding's status is one of `SATISFIED`, `VIOLATED`, `UNCLEAR`.
- **`R-GRD-2` (words, not marks).** Before a quotation is matched, emphasis, fenced-code and
  quotation marks and backslashes are dropped from both sides and whitespace is collapsed.
  Underscores deliberately stay: an API specification is mostly `snake_case` identifiers, so
  `transaction_id` must not quietly become `transactionid`.
- **`R-GRD-3` (a run is a quotation).** A quotation grounds if it contains a run of
  `QUOTE_WORDS = 6` consecutive words that really appears in the document. This allows the most
  useful answer — "the baseline says X, the proposal says Y" — which is never a contiguous span of
  either.
- **`R-GRD-4` (a survival claim is a claim about the new text).** A `SATISFIED` answer must quote the
  **proposed** document. Words only in the baseline show what *used to be* promised. A `VIOLATED`
  answer may quote either document, because a violation is often shown by what the baseline required
  and the proposal dropped.
- **`R-GRD-5` (the floor cuts both ways).** A decisive answer the evidence does not carry becomes
  `UNCLEAR`, and this applies to `SATISFIED` exactly as it applies to `VIOLATED`. A held SATISFIED
  cannot clear a change any more than a held VIOLATED can block one; a floor that caught only one
  direction would quietly favour whoever benefits from the other.

The finding keeps both statuses: the answered `status` and the `effective_status` grounding made of
it, plus `held_for_grounding` and `grounded_in` (`proposed`, `baseline`, or both).

### 7.2 The decisive digest — `R-ASM-7`

```
decisive_digest = sha256(canon([[requirement_id, status, effective_status], … sorted by id]))
```

Requirement id, the answered status, and the status grounding made of it — **and nothing else**.

### 7.3 The verdict — `R-VRD-1`

```
if any effective_status == VIOLATED:  BREAKING_CHANGE
elif any effective_status == UNCLEAR: INCONCLUSIVE
else:                                 COMPATIBLE
```

A violation outranks an unsettled requirement deliberately: resolving the unsettled one cannot make
the change compatible, so the answer is already known. **No model ever names a verdict**; this
function is the only thing that does.

The `summary` is derived the same way, so the sentence a reader sees is a function of the settled
findings and not of any prose a model wrote.

## 8. Bounds

| Constant | Value | Applies to |
| --- | --- | --- |
| `MAX_NAME` | 120 | specification name |
| `MAX_DESCRIPTION` | 1200 | specification description |
| `MAX_VERSION` | 40 | baseline version, proposed version |
| `MAX_SOURCE` | 400 | source reference (optional, may be empty) |
| `MAX_CONTENT` | 20000 | baseline and proposed content |
| `MIN_CONTENT` | 2 | baseline and proposed content, after trimming |
| `MAX_REQUIREMENTS` | 16 | requirements per specification |
| `MIN_REQUIREMENTS` | 1 | requirements required to freeze |
| `MAX_STATEMENT` | 400 | requirement statement |
| `MAX_EVIDENCE` | 600 | a finding's quotation |
| `MAX_REASONING` | 900 | a finding's reasoning |
| `MAX_ID` | 24 | specification id, assessment id |
| `MAX_PAGE` | 100 | `limit` on any listing |
| `MAX_SIGNALS` | 16 | injection signals recorded per document |
| `QUOTE_WORDS` | 6 | words in a run that counts as a quotation |

## 9. Injection — `R-INJ-1`, `R-INJ-2`

- **`R-INJ-1` (neutralise the fence).** Three or more angle brackets in a row — how a document
  tries to close the fence its evidence is read inside — are replaced with a space, never removed.
  A reader must be able to see that something was there; a document that silently loses characters
  is a document nobody can audit.
- **`R-INJ-2` (record, never obey).** Text shaped like an instruction to the reader is recorded as
  an injection signal and otherwise ignored. Signals are `override`, `disregard`, `instruct`,
  `verdict-word`, `role-tag`, `chatml`, `no-rules`.

Injection signals are recorded for a baseline (at registration) and for an assessment (over the
baseline and the proposal together). They are **evidence for a reader**, never a rule, and never
reach a status or a verdict.

## 10. Refusals — `R-LIM-4`

Every refusal is a `gl.vm.UserError` whose message begins with a bracketed class. Clients branch on
the class, so the prose of a message may change without breaking anything.

| Class | Means |
| --- | --- |
| `[EXPECTED]` | a protocol rule said no (the default) |
| `[INVALID_INPUT]` | a field was empty, oversized or malformed |
| `[INVALID_REQUIREMENT]` | a requirement id, statement or severity the contract will not accept |
| `[INVALID_FINDING]` | a finding was malformed, duplicated, unknown, missing, or disagreed |
| `[HASH_MISMATCH]` | a digest does not cover the bytes it claims |
| `[CRITERIA_MISMATCH]` | assessed against criteria that are not the frozen ones |
| `[FROZEN_SPECIFICATION]` | the criteria are sealed |
| `[UNAUTHORIZED]` | the sender is not the creator of this specification |
| `[WRONG_STATE]` | the specification is not in a state that permits this |
| `[LIMIT]` | a declared ceiling was reached |
| `[LLM_ERROR]` | the panel's reading could not be used |

## 11. Records

### Specification (`get_specification`)

`specification_id`, `creator`, `name`, `description`, `baseline_version`, `baseline_hash`,
`baseline_bytes`, `source_reference`, `state`, `frozen`, `requirement_count`, `assessment_count`,
`created_at`, `updated_at`, `frozen_at`, `criteria_digest`, `rules`, `schema`,
`baseline_injection_signals`, `requirements`.

`created_at`, `updated_at` and `frozen_at` are UTC, `YYYY-MM-DDTHH:MM:SSZ`, taken from the
transaction's own clock so every node agrees.

### Assessment (`get_assessment`)

`assessment_id`, `specification_id`, `specification_name`, `criteria_digest`, `baseline_version`,
`baseline_hash`, `proposed_version`, `proposed_hash`, `proposed_bytes`, `submitted_by`,
`submitted_at`, `verdict`, `summary`, `findings`, `decisive_digest`, `scope`, `rules`, `schema`,
`injection_signals`.

### Finding

`requirement_id`, `statement`, `status`, `effective_status`, `held_for_grounding`, `grounded_in`,
`evidence`, `reasoning`.

## 12. Interface

### Writes (4)

`register_specification`, `add_requirement`, `freeze_specification`, `submit_assessment`.

### Views (12)

`get_protocol_info`, `get_specification`, `get_criteria`, `get_baseline`, `get_requirements`,
`list_specifications(offset, limit)`, `list_by_creator(creator, offset, limit)`, `get_assessment`,
`get_proposed`, `get_findings`, `list_assessments(offset, limit)`,
`list_specification_assessments(specification_id, offset, limit)`.

All listings return `{items, total, offset, limit}`.

### Visibility of a transition

The legacy runner this contract is pinned to exposes no contract event log, so Dev records
transitions in state and in the transaction itself rather than in emitted events:

- every transition is a **write transaction**, with the returning method's result as its payload;
- every resulting state is readable through a **view**;
- every view has an **inverse**: a write's effect is visible in the view it affects
  (`get_specification`, `get_criteria`, `get_assessment`, `get_findings`, `get_proposed`), and the
  live run in `docs/END-TO-END.md` checks exactly that inverse after every write.

`get_protocol_info` returns the vocabularies, the bounds, the scope, the rules token and the totals,
so a client can render Dev's own definitions rather than hard-coding them.

## 13. What Dev is not

- It does not prove authorship, ownership or publication of a document.
- It does not guarantee that a service behaves as its specification says.
- It does not judge the quality of either document.
- It does not decide "is this change good"; it decides whether the change still satisfies what was
  frozen, and it fails closed when it cannot tell.
