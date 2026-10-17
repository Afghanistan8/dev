"""Fixtures and a small driver for calling the contract like a wallet would.

`App` sets the message sender and clock and then calls the contract exactly as
a client would. `Panel` is the scripted model: it reads the requirement id out
of the prompt the contract built and answers, one call at a time, so a test can
give the leader one reading and the validator another.
"""

import hashlib
import json
import re

import genlayer

# Accounts. Twenty bytes each, legible on sight in a failure message.
CREATOR = "0x" + "a1" * 20
STRANGER = "0x" + "b2" * 20
REVIEWER = "0x" + "c3" * 20

START = 1_777_000_000

REQUIREMENT_IN_PROMPT = re.compile(r"^Id:\s*([A-Z][A-Z0-9]{1,11}-[0-9]{1,4})\s*$", re.M)


def digest(text: str) -> str:
    """The digest the contract computes, so a test can predict it."""
    return hashlib.sha256(str(text).encode("utf-8")).hexdigest()


# -- documents --------------------------------------------------------------
#
# The same four assertions, written as a specification reads. Each one is a
# sentence long enough that quoting it is a real quotation rather than four
# common words that happen to sit next to each other.

LINE_CREATE = "An order is created by calling create_order with an amount and a currency."
LINE_ID = "Every successful order response includes a required transaction identifier."
LINE_SYNC = "The service confirms the order synchronously before it returns the response."
LINE_ERROR = "When a request is rejected the service returns an error with a description."

BASELINE_V1 = "\n\n".join([
    "# Checkout Service API, version 1",
    LINE_CREATE,
    LINE_ID,
    LINE_SYNC,
    LINE_ERROR,
])

# A compatible rewrite: adds a field and reorders nothing that was promised.
PROPOSED_V2 = "\n\n".join([
    "# Checkout Service API, version 2",
    LINE_CREATE,
    LINE_ID,
    LINE_SYNC,
    LINE_ERROR,
    "The response also includes a created_at timestamp in RFC 3339 form.",
])

# A breaking change: the required identifier is gone.
PROPOSED_DROPS_ID = "\n\n".join([
    "# Checkout Service API, version 2",
    LINE_CREATE,
    LINE_SYNC,
    LINE_ERROR,
])

# A version that is silent about synchronous confirmation.
PROPOSED_SILENT_SYNC = "\n\n".join([
    "# Checkout Service API, version 2",
    LINE_CREATE,
    LINE_ID,
    LINE_ERROR,
])

REQUIREMENTS = [
    ("PAY-001", LINE_ID, "BLOCKING"),
    ("PAY-002", LINE_SYNC, "MAJOR"),
    ("ERR-001", LINE_ERROR, "MINOR"),
]


class App:
    """Drives the contract: sets the message and the clock, then calls."""

    def __init__(self, module):
        self.module = module
        genlayer.gl.set_message(CREATOR)
        self.contract = module.Dev()
        self.now = START
        genlayer.gl.set_clock(self.now)

    # -- calls --------------------------------------------------------------

    def send(self, method, *args, sender=CREATOR, **kwargs):
        genlayer.gl.set_message(sender)
        genlayer.gl.set_clock(self.now)
        return getattr(self.contract, method)(*args, **kwargs)

    def read(self, method, *args, **kwargs):
        genlayer.gl.set_clock(self.now)
        return getattr(self.contract, method)(*args, **kwargs)

    # -- set-up shorthands --------------------------------------------------

    def register(self, name="Checkout Service", baseline=BASELINE_V1, **over):
        fields = dict(
            description="The HTTP contract an order client depends on.",
            baseline_version="1.0.0",
            baseline_hash=digest(baseline),
            source_reference="https://example.test/checkout/v1",
        )
        fields.update(over)
        return self.send("register_specification", name, fields.pop("description"),
                         fields.pop("baseline_version"), baseline,
                         fields.pop("baseline_hash"), fields.pop("source_reference"))

    def add(self, spec_id, requirement_id, statement, severity="MAJOR", sender=CREATOR):
        return self.send("add_requirement", spec_id, requirement_id, statement,
                         severity, sender=sender)

    def criteria(self, spec_id, requirements=None, sender=CREATOR):
        """Add the three default requirements and freeze. Returns the digest."""
        for rid, statement, severity in (requirements or REQUIREMENTS):
            self.add(spec_id, rid, statement, severity, sender=sender)
        return self.send("freeze_specification", spec_id, sender=sender)

    def frozen(self, **over):
        """A frozen specification with the default criteria. Returns (id, digest)."""
        sid = self.register(**over)
        return sid, self.criteria(sid)

    def assess(self, spec_id, criteria_digest, proposed=PROPOSED_V2, version="2.0.0",
               sender=REVIEWER, **over):
        fields = dict(proposed_hash=digest(proposed))
        fields.update(over)
        return self.send("submit_assessment", spec_id, version, proposed,
                         fields.pop("proposed_hash"), criteria_digest,
                         sender=sender, **fields)


class Panel:
    """A scripted panel. Answers a prompt by the requirement id inside it.

    `answers` maps a requirement id to `(status, evidence, reasoning)`. `by_call`
    is a callable `(rid, n, prompt) -> dict | str` for the cases the mapping
    cannot express: a malformed answer, a different reading on the validator's
    turn, or a raw string that is not JSON at all.
    """

    def __init__(self, answers=None, by_call=None):
        self.answers = dict(answers or {})
        self.by_call = by_call
        self.seen = []

    def install(self):
        genlayer.gl.nondet.answer = self
        return self

    def with_(self, requirement_id, status, evidence="", reasoning="because"):
        self.answers[requirement_id] = (status, evidence, reasoning)
        return self

    def __call__(self, prompt, n):
        found = REQUIREMENT_IN_PROMPT.search(prompt)
        rid = found.group(1) if found else ""
        self.seen.append((rid, n))
        if self.by_call is not None:
            return self.by_call(rid, n, prompt)
        entry = self.answers[rid]
        status, evidence = entry[0], entry[1]
        reasoning = entry[2] if len(entry) > 2 else "because the documents say so"
        return json.dumps({
            "requirement_id": rid,
            "status": status,
            "evidence": evidence,
            "reasoning": reasoning,
        })


def graded(pairs):
    """Turn `{rid: (status, evidence, reasoning)}` into a Panel."""
    return Panel(pairs).install()


def compatible_panel():
    """Every requirement held, each quoting the proposed document."""
    return graded({
        "PAY-001": ("SATISFIED", LINE_ID),
        "PAY-002": ("SATISFIED", LINE_SYNC),
        "ERR-001": ("SATISFIED", LINE_ERROR),
    })


def breaking_panel():
    """PAY-001 shown violated by what the baseline promised and the proposal dropped."""
    return graded({
        "PAY-001": ("VIOLATED", LINE_ID),
        "PAY-002": ("SATISFIED", LINE_SYNC),
        "ERR-001": ("SATISFIED", LINE_ERROR),
    })


def inconclusive_panel():
    """PAY-002 unsettled: the proposal is silent, and the panel says so."""
    return graded({
        "PAY-001": ("SATISFIED", LINE_ID),
        "PAY-002": ("UNCLEAR", "the proposal does not mention confirmation at all",
                    "no statement settles this"),
        "ERR-001": ("SATISFIED", LINE_ERROR),
    })
