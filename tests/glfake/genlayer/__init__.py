"""A stand-in for the GenVM runtime, enough of it to drive Dev in pytest.

This is a test double, not a simulator. The deterministic rules in
`contracts/dev.py` are the part that has to be provable without a validator,
and the only honest way to prove them is to run the contract itself rather
than a copy of its arithmetic.

What it is faithful about, because the tests lean on it:

  * storage fields are zero-initialised from their annotations, as GenVM
    does, so `__init__` can leave them alone
  * `run_nondet` actually runs the leader and then makes the validator judge
    the leader's own return value, and fails the round when it disagrees, so
    a validator that reads the documents differently really does write nothing
  * a `UserError` raised by the leader is handed to the validator as the
    failure it is, exactly as the runtime does, so the "did this node fail the
    same way" branch is exercised rather than assumed
  * `exec_prompt` answers from a script the test installs, one call at a time,
    so leader and validator can be given different readings on purpose

What it does not do: consensus over several validators, gas, rotation, or
anything about the chain beyond one transaction's message.
"""

import copy
import datetime

__all__ = [
    "gl",
    "Address",
    "DynArray",
    "TreeMap",
    "bigint",
    "u8",
    "u16",
    "u32",
    "u64",
    "u128",
    "u256",
    "i8",
    "i16",
    "i32",
    "i64",
    "i128",
    "i256",
]


# -- fixed-width integers ---------------------------------------------------


class _Int:
    def __init__(self, name: str, bits: int, signed: bool):
        self.name = name
        self.bits = bits
        self.signed = signed
        self.low = -(1 << (bits - 1)) if signed else 0
        self.high = (1 << (bits - 1)) - 1 if signed else (1 << bits) - 1

    def __call__(self, value=0):
        held = int(value)
        if held < self.low or held > self.high:
            raise OverflowError(
                self.name + " holds " + str(self.low) + ".." + str(self.high)
                + ", got " + str(held)
            )
        return held

    def __repr__(self):
        return self.name


u8 = _Int("u8", 8, False)
u16 = _Int("u16", 16, False)
u32 = _Int("u32", 32, False)
u64 = _Int("u64", 64, False)
u128 = _Int("u128", 128, False)
u256 = _Int("u256", 256, False)
i8 = _Int("i8", 8, True)
i16 = _Int("i16", 16, True)
i32 = _Int("i32", 32, True)
i64 = _Int("i64", 64, True)
i128 = _Int("i128", 128, True)
i256 = _Int("i256", 256, True)
bigint = int


# -- storage containers -----------------------------------------------------


class _Spec:
    def __init__(self, kind, args):
        self.kind = kind
        self.args = args

    def __repr__(self):
        return self.kind + "[" + repr(self.args) + "]"


class DynArray(list):
    def __class_getitem__(cls, item):
        return _Spec("DynArray", item)


class TreeMap(dict):
    """`TreeMap[str, str]`, and the `str` variant storage is declared with."""

    def __class_getitem__(cls, item):
        return _Spec("TreeMap", item)


class Address:
    __slots__ = ("_hex",)

    def __init__(self, value):
        if isinstance(value, Address):
            value = value.as_hex
        if isinstance(value, (bytes, bytearray)):
            value = "0x" + bytes(value).hex()
        text = str(value)
        if not text.startswith("0x") or len(text) != 42:
            raise ValueError("not an address: " + repr(value))
        int(text, 16)
        self._hex = text

    @property
    def as_hex(self) -> str:
        return self._hex

    def __str__(self):
        return self._hex

    def __eq__(self, other):
        return isinstance(other, Address) and other._hex.lower() == self._hex.lower()

    def __hash__(self):
        return hash(self._hex.lower())

    def __repr__(self):
        return "Address(" + self._hex + ")"


# -- the gl.vm, gl.storage, gl.contract namespaces --------------------------


class UserError(Exception):
    """What a contract raises to refuse a call."""


class Return:
    """A leader result that came back rather than raised."""

    def __init__(self, calldata):
        self.calldata = calldata


class Rollback(Exception):
    """A round the validator would not sign."""


def _mark(kind):
    def decorate(fn):
        fn.genlayer_kind = kind
        return fn

    return decorate


class _WriteMarkers:
    def __call__(self, fn):
        return _mark("write")(fn)

    payable = staticmethod(_mark("write.payable"))


class _PublicMarkers:
    view = staticmethod(_mark("view"))
    write = _WriteMarkers()


class _Nondet:
    """exec_prompt, answered by a script a test installs.

    The script is called with `(prompt, n)` where `n` is the 1-based number of
    the call in this round, so a test can give the leader one reading and the
    validator another without reaching into the contract.
    """

    def __init__(self):
        self.answer = None
        self.calls = []

    def exec_prompt(self, prompt, images=None, response_format=None, **kwargs):
        frames = list(images or [])
        if len(frames) > 2:
            raise UserError(
                "exec_prompt takes at most two images, got " + str(len(frames))
            )
        self.calls.append({"prompt": prompt, "images": frames,
                           "response_format": response_format})
        if self.answer is None:
            raise UserError("no prompt script is installed on the double")
        return self.answer(prompt, len(self.calls))


class _Vm:
    UserError = UserError
    Return = Return
    Rollback = Rollback

    @staticmethod
    def run_nondet(leader_fn, validator_fn, **kwargs):
        """Run the leader, then make the validator sign it or reject it.

        A leader that raises is passed to the validator as the failure, which
        is what the real runtime does and what the contract's "did this node
        fail the same way" branch is written against. A validator that will not
        sign raises Rollback, and the caller's transaction writes nothing --
        which is the whole point of testing the panel here rather than on a
        mock that always agrees.
        """
        try:
            value = leader_fn()
        except Exception as leader_error:  # the leader fell over
            if not validator_fn(leader_error):
                raise Rollback("the round did not agree on the leader's failure")
            raise
        if not validator_fn(Return(value)):
            raise Rollback("the round did not agree with the leader")
        return value

    # The older spelling, kept because a linter rule wants one of the two.
    run_nondet_unsafe = run_nondet


class _Storage:
    TreeMap = TreeMap
    DynArray = DynArray

    @staticmethod
    def copy_to_memory(value):
        return copy.deepcopy(value)

    @staticmethod
    def inmem_allocate(kind, *args, **kwargs):
        if isinstance(kind, _Spec):
            return DynArray() if kind.kind == "DynArray" else TreeMap()
        return kind(*args, **kwargs)


class _Contract:
    """Base for an intelligent contract. Zero-initialises declared storage."""

    def __init_subclass__(cls, **kwargs):
        super().__init_subclass__(**kwargs)
        written = cls.__dict__.get("__init__")
        if written is None or getattr(written, "genlayer_wrapped", False):
            return

        def start(self, *args, **kwargs):
            for base in reversed(cls.__mro__):
                for field, annotation in getattr(base, "__annotations__", {}).items():
                    if field.startswith("_"):
                        continue
                    setattr(self, field, _zero_for(annotation))
            return written(self, *args, **kwargs)

        start.genlayer_wrapped = True
        cls.__init__ = start


class _ContractNS:
    """`gl.contract.Contract`, which is how the contract declares its base."""

    Contract = _Contract
    Address = Address
    TreeMap = TreeMap
    DynArray = DynArray


class _EqPrinciple:
    @staticmethod
    def strict_eq(fn):
        return fn()


class _Message:
    def __init__(self):
        self.sender_address = Address("0x" + "00" * 20)
        self.origin_address = self.sender_address
        self.contract_address = Address("0x" + "ee" * 20)
        self.value = 0
        self.chain_id = 61999


# -- the module is the gl namespace -----------------------------------------
#
# A contract writes `import genlayer as gl` and then reaches for `gl.contract`,
# `gl.storage`, `gl.vm`, `gl.message` and `gl.nondet`. Those resolve as
# attributes of this module, so the module itself is the namespace the contract
# sees and `gl` is simply this module. `message` and `nondet` are module globals
# on purpose: a test reassigns them between rounds.

# The contract base is reached as `gl.Contract` on the legacy SDK Studionet
# runs; `gl.contract.Contract` is the older spelling kept for symmetry.
Contract = _Contract
BaseContract = _Contract
contract = _ContractNS()
storage = _Storage()
vm = _Vm()
public = _PublicMarkers()
eq_principle = _EqPrinciple()

message = _Message()
nondet = _Nondet()


def set_message(sender: str, value: int = 0) -> None:
    global message
    message = _Message()
    message.sender_address = Address(sender)
    message.origin_address = Address(sender)
    message.value = int(value)


def set_clock(epoch: int) -> None:
    """Accepted for symmetry; the contract reads real UTC time."""
    global _clock
    _clock = datetime.datetime.fromtimestamp(
        int(epoch), datetime.timezone.utc
    ).strftime("%Y-%m-%dT%H:%M:%S")


_ZEROES = {
    str: "",
    bytes: b"",
    bool: False,
    float: 0.0,
    int: 0,
}


def _zero_for(annotation):
    if isinstance(annotation, _Spec):
        return DynArray() if annotation.kind == "DynArray" else TreeMap()
    if isinstance(annotation, _Int):
        return 0
    if annotation in _ZEROES:
        return _ZEROES[annotation]
    if annotation is Address:
        return Address("0x" + "00" * 20)
    raise TypeError("no zero value for a storage field of " + repr(annotation))


import sys as _sys  # noqa: E402

gl = _sys.modules[__name__]

