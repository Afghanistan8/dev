# Threat Model

Dev adjudicates compatibility claims. The things worth attacking are therefore: the criteria, the
panel, the record, and the reader's belief in any of them. This document names the adversaries, the
attacks, and what actually stops them — including the ones nothing stops.

## Assets

| Asset | Why an attacker wants it |
| --- | --- |
| The frozen criteria | Moving them changes what a verdict means. |
| A verdict | A false `COMPATIBLE` clears a breaking change. A false `BREAKING_CHANGE` blocks a good one. |
| The evidence | An ungrounded answer is a status nobody checked. |
| The record's integrity | A digest that can be re-parented makes every verdict unverifiable. |
| The reader | A page that shows a comfortable summary of a hostile document. |

## Adversaries

| Adversary | Capability |
| --- | --- |
| **A malicious submitter** | Authors the proposal. Wants `COMPATIBLE` for a breaking change. |
| **A careless or adversarial creator** | Wants to move the criteria after seeing a proposal, or to make an unanswerable requirement look satisfied. |
| **A document that talks to the judge** | The proposal (or baseline) contains text shaped like instructions to the reader. |
| **The model itself** | Hallucinates an answer, quotes text that is not there, answers about the wrong requirement, or returns prose where JSON was asked for. |
| **A dissenting validator** | Returns a result honestly different from the leader's. |
| **A network observer / replayer** | Reads everything; may resubmit a transaction. |
| **An operator or host** | Controls infrastructure but not the contract. |
| **A future maintainer** | "Just add an admin escape hatch." |

## Attacks and what stops them

| # | Attack | Mitigation | Rule |
| --- | --- | --- | --- |
| 1 | Move a requirement after a proposal exists | Freeze is one-way; `add_requirement` refuses on `FROZEN`; there is no removal method at all | `R-REQ-2`, `R-FRZ-1` |
| 2 | Assess against criteria you chose | `submit_assessment` must name the frozen `criteria_digest`; anything else is refused before a document is read | `R-ASM-2` |
| 3 | Re-parent a verdict to different criteria later | The digest is recomputed on chain from the stored baseline and requirements, and re-checked after consensus | `R-FRZ-3`, `R-ASM-9` |
| 4 | Claim a hash for content that does not cover it | Supplied hashes are checked against the bytes; the stored digest is always the computed one | `R-REG-3` |
| 5 | Submit a "compatible" verdict yourself | No method accepts a verdict. It is derived from settled findings by `derive_verdict` | `R-VRD-1` |
| 6 | Write a half-assessment (record without an answer) | Submission and evaluation are one transaction; a round that does not agree writes nothing | `R-ASM-9` |
| 7 | Poison the reader with instructions in the document | Documents are fenced as evidence; angle runs are neutralised; instruction-shaped text is recorded as a signal and otherwise ignored; no status is ever taken from a document | `R-INJ-1`, `R-INJ-2` |
| 8 | Quote words that are not in the document | A decisive answer grounds only if a 6-word run really appears; otherwise the status becomes `UNCLEAR` | `R-GRD-3`, `R-GRD-5` |
| 9 | Quote the baseline to claim a requirement survives | A `SATISFIED` answer must quote the **proposed** document | `R-GRD-4` |
| 10 | Claim a survival the proposal dropped | Grounding applies to `SATISFIED` as strictly as to `VIOLATED` | `R-GRD-5` |
| 11 | Get a broken model answer written as state | Malformed, duplicated, unknown, missing or wrongly-labelled answers are refused, never repaired | `R-ASM-4`, `R-ASM-5` |
| 12 | Slip a wrong answer past the validators via prose | Validators re-derive the answers themselves and compare only the decisive digest | `R-ASM-7` |
| 13 | Make every round fail so nothing is ever recorded | A deterministic refusal must be reproduced by the validator; an unreadable model answer rotates to a new leader | `R-ASM-8` |
| 14 | Act as the creator from another account | Creator checks are on `gl.message.sender_address`, never an argument | `R-REQ-1` |
| 15 | Act as another account generally | Every recorded account comes from the message sender | `R-REG-2` |
| 16 | Oversized input as a denial of service | Declared ceilings on every field, checked before storage | §8 of `docs/PROTOCOL.md` |
| 17 | Replay a transaction | Standard chain semantics (nonce); the contract keeps no idempotency shortcut that would let a replay change anything | — |
| 18 | Hide a rail-thin evidence trail from a reader | Findings carry both the answered status and the effective status, plus `grounded_in`; the console shows both and marks held answers | `R-GRD-5` |
| 19 | Get an admin backdoor added later | There is no privileged address; `scripts/schema.mjs` asserts it against the deployed code | `R-REG-4` |

## Attacks that are **not** stopped, and why that is stated

| Attack | Why it stands | What Dev does instead |
| --- | --- | --- |
| A creator freezes a requirement that is subtly wrong, or trivially satisfied | The protocol takes the creator's requirement as authoritative | It is *recorded*, and the criteria digest pins exactly the words that were frozen, so a reader can see who froze what and when |
| A creator freezes a requirement the documents can never settle | Nobody can settle it | The panel answers `UNCLEAR`, the verdict is `INCONCLUSIVE`, and nothing is cleared |
| A model reading is wrong but plausible, and the validators agree with it | Consensus is agreement, not truth | Answers must be quoted from the documents, and the quote is checked; a mismatch is visible in the record and recheckable at `/verify` |
| A document asserts something false about the world | Dev judges compatibility, not truth | The scope string is stored in every assessment: not proof of authorship, not a guarantee the service behaves as written |
| A reader does not look at the findings | Nothing can force reading | The console shows the findings behind every verdict by default, never only the verdict |
| Denial of service by exhaustion of rounds | A model is not a function | A failed round writes nothing and anyone may ask again; the cost is transaction fees, not state |

## Trust boundaries

1. **Wallet → contract.** Trusted for *identity only*: the sender address. Nothing else the client
   sends is trusted — digests are recomputed, lengths are re-checked, criteria are re-derived.
2. **Contract → model.** The model is trusted for **nothing**. It is consulted; its answers are
   refused when malformed, held when ungrounded, and never allowed to name a verdict.
3. **Validators → each other.** Trusted only to be honest *and disagreeable*: one honest validator
   disagreeing is enough to make the round write nothing.
4. **Contract → reader.** The console does not summarise away the evidence, and `/verify` recomputes
   every digest in the browser so a reader need not trust the console either.

## Reporting

This is a reference implementation on a test network. If you find a way to make a verdict that the
rules do not derive, make the criteria move after a freeze, get an ungrounded answer recorded, or get
a document's instructions obeyed, that is a bug worth writing down — see
[docs/REVIEW_TARGET.md](REVIEW_TARGET.md) for exactly what to attack and how to report it.
