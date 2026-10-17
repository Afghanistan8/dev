"""Loads `contracts/dev.py` against the runtime double in tests/glfake."""

import importlib.util
import pathlib
import sys

import pytest

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(HERE / "glfake"))
sys.path.insert(0, str(HERE))


def _load_contract():
    spec = importlib.util.spec_from_file_location(
        "dev_contract", ROOT / "contracts" / "dev.py"
    )
    module = importlib.util.module_from_spec(spec)
    sys.modules["dev_contract"] = module
    spec.loader.exec_module(module)
    return module


dev = _load_contract()


@pytest.fixture
def mod():
    """The contract module, with the double reset between tests."""
    import genlayer

    genlayer.gl.nondet = genlayer._Nondet()
    genlayer.gl.set_message("0x" + "00" * 20)
    return dev


@pytest.fixture
def app(mod):
    from helpers import App

    return App(mod)
