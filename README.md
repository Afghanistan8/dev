# Dev

**Freeze the requirement. Submit the change. Validators read both. Code records the verdict.**

Dev is a GenLayer intelligent contract and a read-only console for one question about a
specification and a change to it:

> Does this change still satisfy what was frozen?

A diff tells you which lines moved. Dev tells you whether the promises the specification made to
the things that depend on it still hold — requirement by requirement, with the words that show it
quoted and checked, and the answer recorded on chain.

It is not a linter, not a test runner and not a code reviewer. It is a
*semantic compatibility* primitive: a frozen baseline, a frozen set of requirements, an open
submission of a proposed version, an independent panel that reads both, and deterministic code
that turns the panel's answers into a verdict.

---

## The idea, in one page

A creator registers a specification and pins it to exact bytes. They then state the handful of
standalone requirements the integration actually depends on — each one a sentence a reader can
answer — and **freeze** them. From that moment the criteria cannot move: not by the creator, not
during an assessment, not afterwards.

Anybody may then submit a proposed new version. Independent GenLayer validators each read the
baseline, one requirement, and the proposal together, and answer for that requirement:

- **SATISFIED** — the proposal still meets it, and the words are quoted from the proposal.
- **VIOLATED** — the proposal contradicts it, or dropped what the baseline promised.
- **UNCLEAR** — the documents do not settle it.

Every answer must carry a quotation. The contract looks for that quotation in the documents, and a
decisive answer the evidence does not carry is held to UNCLEAR. Ordinary deterministic code then
aggregates the settled answers:

| the settled answers                       | the verdict        |
| ----------------------------------------- | ------------------ |
| every requirement SATISFIED               | `COMPATIBLE`       |
| at least one VIOLATED                     | `BREAKING_CHANGE`  |
| no violation, at least one UNCLEAR        | `INCONCLUSIVE`     |

No party — author, operator or model — can certify its own change. **Uncertainty fails closed.**

---

## What is deployed

| | |
| --- | --- |
| Contract | [`0x605c579967C64B9b086B0Cf26ABb154Bc472f625`](https://explorer-studio.genlayer.com/address/0x605c579967C64B9b086B0Cf26ABb154Bc472f625) |
| Network | GenLayer Studio Network (`studionet`, chain id `61999`) |
| RPC | `https://studio.genlayer.com/api` |
| Deploy transaction | `0x1694a0393c99fb9c7469a12b5b9c6baf0dac6f2a588ccba6f69a1adcb95b2ee5` |
| Runner pin | `py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6` |
| Deployer | `0x4184bc5E5444F250767E8D33A49817A9B4FB0df3` |

Read it with any of the twelve views, e.g.:

```bash
genlayer call 0x605c579967C64B9b086B0Cf26ABb154Bc472f625 get_protocol_info
```

The address, the deploy transaction and the runner pin are also in
[`deploy/live-report.json`](deploy/live-report.json) and [`.dev-deploy.json`](.dev-deploy.json),
written by the deploy and end-to-end scripts rather than typed by hand.

---

## Quickstart

Requires Node 20+, Python 3.11+, and (for deploying) the GenLayer CLI.

```bash
# the contract's own test suite (no network)
python -m pytest

# the contract quality gate
npm run lint

# the console
cd web && npm install && npm run lint && npm run test && npm run build
```

To deploy your own instance and drive it end to end on Studio:

```bash
cp web/.env.example web/.env.local        # then put the deployed address in it
DEV_PRIVATE_KEY=0x... node scripts/deploy.mjs   # prints the address and writes .dev-deploy.json
DEV_PRIVATE_KEY=0x... node scripts/live.mjs     # every transition, on the network, with evidence
node scripts/verify.mjs                          # recheck the record from the chain's own views
```

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for the pin, the gas story and how to verify the
deployed code, and [docs/TESTING.md](docs/TESTING.md) for what each suite covers.

---

## Repository layout

```
contracts/dev.py          the contract: registry, freeze, the assessment panel, twelve views
tests/                    the contract's test suite, against a runtime double (tests/glfake)
tests/test_rules.py       the deterministic core: digests, grounding, aggregation, limits
tests/test_registry.py    register, add, freeze, and every refusal they owe
tests/test_panel.py       the panel: agreement, dissent, malformed answers, degenerate rounds
tests/test_adversarial.py injection, grounding attacks, criteria drift, self-certification
scripts/deploy.mjs        deploy, then verify via a view
scripts/schema.mjs        read the deployed schema back and prove no method is privileged
scripts/live.mjs          the live end-to-end run, one specification per verdict
scripts/verify.mjs        recompute every digest from the chain's own views
scripts/canon.mjs         canonical JSON and sha256, byte-for-byte the contract's
scripts/info.mjs          print what the deployed contract says about itself
scripts/wallet.mjs        read the CLI's cached signing key into .env
web/                      the console: Next.js App Router, TypeScript, read-only, no backend
web/lib/canon.ts          the same canonical JSON, in the browser
docs/                     PROTOCOL, ARCHITECTURE, SECURITY, THREAT_MODEL, TESTING, DEPLOYMENT, ...
```

---

## Continuous integration

```yaml
.github/workflows/ci.yml   contract tests, then the console's lint, tests and build
```

The contract lint gate (`npm run lint`) is run locally against `genvm-lint`; it is
not in CI because the linter is not on the PATH of a stock runner, and inventing an
install command for it would be worse than saying so.

---

## Documentation

| Document | For |
| --- | --- |
| [PROTOCOL.md](docs/PROTOCOL.md) | the specification of record: every rule id, state, digest, bound, refusal class |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | how the contract is put together, and where the deterministic boundary is |
| [SECURITY.md](docs/SECURITY.md) | the security properties, and what is out of scope |
| [THREAT_MODEL.md](docs/THREAT_MODEL.md) | every adversary and attack, with its mitigation — including the ones nothing stops |
| [TESTING.md](docs/TESTING.md) | the four suites and what each proves |
| [DEPLOYMENT.md](docs/DEPLOYMENT.md) | the pin, the live instance, and how to check the deployed code |
| [END-TO-END.md](docs/END-TO-END.md) | the deployed contract, read back, with the evidence |
| [REVIEW_TARGET.md](docs/REVIEW_TARGET.md) | what to attack, in order, if you are trying to break it |

---

## The contract bar

- **A real state machine.** `DRAFT → REGISTERED → FROZEN`, and assessments only against `FROZEN`.
- **All validation on chain.** Every rule a client can show is also enforced by the contract, and
  the contract is the only place it counts.
- **Machine-readable refusals.** Every failure wears a bracketed class
  (`[FROZEN_SPECIFICATION]`, `[CRITERIA_MISMATCH]`, `[UNAUTHORIZED]`, …) so a client can react to the
  kind of refusal and not to its prose.
- **A read-only frontend.** The console holds no key and has no backend: every write is signed by
  the visitor's own wallet, and every read is a view call.
- **No owner, no admin, no upgrade.** There is no privileged address in the contract. The deployer
  can do exactly what anybody else can, and that is asserted, not asserted-to.

## What makes a verdict hard to fake

Dev's whole value is that a verdict about a change cannot be produced cheaply, borrowed, or spoken
by the thing being judged. Six properties carry that, and each one is asserted in
`tests/` and re-checked against the deployed contract in `docs/END-TO-END.md`.

1. **The unit is the requirement, not the file.** A change is judged against named, standalone,
   severity-ranked requirements, so "compatible" is a claim about meaning rather than about which
   lines moved.
2. **The criteria cannot move.** Requirements are immutable after the freeze, and an assessment
   must name the frozen criteria digest or the submission is refused — a verdict can never be
   silently re-parented to a different set of requirements.
3. **The answers must be grounded.** A decisive answer whose quotation is not in the documents is
   held to UNCLEAR, so "the evidence does not settle this" is a first-class, recorded outcome
   instead of an unexamined pass or fail.
4. **Failure modes fail closed.** A round the validators do not agree about writes nothing at all,
   and a single unsettled requirement makes the whole verdict INCONCLUSIVE rather than a pass.
5. **The verdict cannot be spoken.** No document and no model can name a verdict: it is derived
   from the settled answers by code, and those answers are pinned by a digest the validators must
   independently reproduce.
6. **Nobody can certify themselves.** Submission and evaluation are one transaction, and the
   creator's authority ends at the freeze.

---

## Truthfulness

The console and the scripts print what the chain returned and nothing else. Digests are recomputed
in the browser from the documents the contract returned; a mismatch is shown as a mismatch. The
test suite asserts the contract's refusals as well as its successes, and the live run records a
verdict it did not expect rather than retrying until it likes the answer.

## Licence

MIT. See [LICENSE](LICENSE).
