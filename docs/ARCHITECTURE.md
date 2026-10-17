# Architecture

Dev is three things and no more: a contract that holds the record, a panel that reads documents
under rules, and a console that shows the record without being able to change it. There is no
server, no database, no indexer and no key anywhere in the application.

```
   ┌───────────────┐        reads (views)        ┌──────────────────────────┐
   │  web/ console │ ──────────────────────────► │                          │
   │  (Next.js)    │                             │   contracts/dev.py       │
   │               │ ◄──── signed writes ─────── │   on GenLayer Studionet  │
   └──────┬────────┘     (user's own wallet)     └────────────┬─────────────┘
          │                                                   │
          │ recomputes digests locally                        │ gl.vm.run_nondet
          ▼                                                   ▼
   canonical JSON + sha256                        leader + validators reading
   (web/lib/canon.ts)                             one requirement at a time
```

## The one boundary that matters

Everything inside the contract is either **deterministic** or **nondeterministic**, and the contract
is written so the boundary is one function wide.

- `contracts/dev.py` §1–§4 (codes, pure helpers, the deterministic core, the prompt) are pure
  functions on plain Python values. No storage, no message, no clock, no network. The verdict, the
  digests, the grounding rule and the injection detector all live here.
- `Dev._evaluate` is the only place a model is consulted. It calls `gl.vm.run_nondet(leader_fn,
  validator_fn)`, and everything a consequence depends on comes back through that call as a dict.

That is what makes the core provable without a validator: the pytest suite calls the very same
functions the panel calls, and the live run re-derives the verdict off chain from the recorded
findings and compares.

### Why the reading loop is written inline

`leader_fn` repeats the loop rather than delegating to a helper beside it. This is not style. The
GenVM linter follows the call graph into the equivalence block and would not follow a sibling
closure, so the naive refactor makes the nondeterministic call look unreachable and the contract
fails `genvm-lint`. The comment in `contracts/dev.py` says so at the point it matters.

## What each part owns

| Part | Owns | Never does |
| --- | --- | --- |
| `register_specification` | baseline bytes, baseline hash check, the creator | fetch a URL, trust a supplied hash |
| `add_requirement` | id shape, uniqueness, severity, count | allow a change after the freeze |
| `freeze_specification` | the one-way transition, the criteria digest | permit a second freeze |
| `submit_assessment` | the criteria match, the panel round, the record | write anything a round did not agree about |
| `_evaluate` | one prompt per requirement, the validator's own reading | read a document as an instruction |
| `derive_findings` · `settle` | refusing malformed answers, grounding both directions | repair an answer, invent a status |
| `derive_verdict` | the verdict, from settled statuses | consult a model, hold state |
| views | the record, and a recomputed digest to compare it against | mutate anything |

## The panel

One assessment is one `run_nondet` round:

1. **Leader.** For each frozen requirement, in id order: build the prompt, call
   `gl.nondet.exec_prompt(..., response_format="json")`, and take the object out of whatever came
   back. Then `derive_findings` refuses anything malformed, grounding holds decisive answers that
   the documents do not carry, and the leader returns the answers plus the **decisive digest** of
   the settled findings.
2. **Validator.** Does not look at the leader's prose. It re-reads the same requirements against the
   same documents, reaches its own findings, and compares only the decisive digest. Disagreement is
   logged as `[DISSENT]`.
3. **Leader failure.** The validator re-runs the leader's work and compares the *kind* of failure
   (the bracket class). A deterministic refusal must match; an unreadable model answer always
   rotates (`R-ASM-8`).
4. **After agreement.** The contract rebuilds the findings from the agreed answers, settles them,
   derives the verdict, and hashes again. If that is not the agreed digest, it refuses. Only then
   does anything write.

The design consequence: **what crosses consensus is a digest over the answers, not prose.** Two
honest readers never write the same sentence about the same clause, so a design that made prose
decisive would fail every round without making anything safer.

## The client

`web/` is a Next.js App Router application. It is read-only in the strict sense: it holds no key,
has no backend, and every write is *proposed* to the user's wallet, which signs it.

- **Reads** go through `genlayer-js` against `NEXT_PUBLIC_DEV_RPC`, one `readContract` per view.
- **Writes** build a client with the connected address and the EIP-1193 provider, so the SDK routes
  `eth_sendTransaction` to the wallet. The application never sees a private key.
- **Digests** are recomputed in the browser (`web/lib/canon.ts`) from the documents the contract
  returned, so `/verify` can disagree with the chain out loud.
- **Refusals** are classified by bracket prefix and shown with the contract's own sentence.

### Deciding, versus submitting

A Studio transaction is `ACCEPTED` when validators reached a result and `MAJORITY_AGREE` when they
agreed. Neither says the method returned. The leader receipt does: `execution_result` is `SUCCESS`
when the method returned and `ERROR` when it raised, and an error's payload carries the
`[CODE] message`. So `web/lib/dev.ts` treats a submission as successful only when the round is
decided, agreed, **and** the leader did not error, and it shows the difference between *submitted*
and *decided* everywhere. That distinction is the difference between a proposal that was assessed
and one that was merely sent.

## Where the record lives

Everything is in `gl.storage.TreeMap` string maps:

```
counters          "spec" | "assessment"          -> the next id
specs             specification id               -> canonical JSON of the specification
spec_index        "n"                            -> specification id, newest last
creator_specs     "<address>|n"                  -> specification id, per creator
requirements      "<spec id>|<requirement id>"   -> canonical JSON of the requirement
spec_requirements <spec id>                      -> JSON list of ids, sorted
assessments       assessment id                  -> canonical JSON of the assessment
assessment_index  "n"                            -> assessment id
spec_assessments  <spec id>                      -> JSON list of assessment ids
content           "baseline|<spec id>"           -> the baseline bytes
content           "proposed|<assessment id>"     -> the proposed bytes
```

Every stored object is written through `_canon` (sorted keys, no whitespace, ASCII), so the bytes
on chain are reproducible and a client can recompute a digest over them and get the same answer.

## Deliberate omissions

- **No owner, no admin, no upgrade path.** `deployer` is recorded and never consulted. `scripts/schema.mjs`
  asserts that no method is privileged.
- **No delete, no edit.** A frozen requirement cannot be removed or reworded, by anyone, ever.
- **No contract event log.** The runner this contract pins exposes none, so transitions are recorded
  in state and in the transaction. Every write's effect is readable through a view, and the live run
  checks that inverse after each write (`docs/PROTOCOL.md` §12).
- **No off-chain cache or indexer.** A page that cannot read the chain shows the refusal instead of
  a stale copy.
