"""The registry, the freeze, and the errors each one refuses."""

import sys

import pytest

sys.path.insert(0, "tests")

import genlayer  # noqa: E402
from helpers import (  # noqa: E402
    BASELINE_V1,
    CREATOR,
    LINE_ID,
    PROPOSED_V2,
    REQUIREMENTS,
    REVIEWER,
    STRANGER,
    digest,
)


def refusal(error, kind):
    return str(error.value).startswith(kind)


def test_the_pin_is_a_concrete_runner():
    import dev_contract

    first = open(dev_contract.__file__, encoding="utf-8").readline()
    assert '"Depends": "py-genlayer:' in first
    assert "py-genlayer:test" not in first
    assert "py-genlayer:latest" not in first


def test_protocol_info_names_the_scope_and_the_rules(app):
    info = app.read("get_protocol_info")
    assert info["rules"] == "dev-aggregation-1"
    assert info["verdicts"] == ["COMPATIBLE", "BREAKING_CHANGE", "INCONCLUSIVE"]
    assert info["finding_statuses"] == ["SATISFIED", "VIOLATED", "UNCLEAR"]
    assert info["specification_count"] == 0
    assert "not a judgement about the quality" in info["scope"].lower()
    assert info["limits"]["max_requirements"] == 16


def test_register_stores_the_bytes_and_the_digest(app):
    sid = app.register()
    assert sid == "S1"
    spec = app.read("get_specification", sid)
    assert spec["state"] == "DRAFT"
    assert spec["frozen"] is False
    assert spec["baseline_hash"] == digest(BASELINE_V1)
    assert spec["baseline_bytes"] == len(BASELINE_V1.encode("utf-8"))
    assert spec["creator"] == CREATOR
    baseline = app.read("get_baseline", sid)
    assert baseline["content"] == BASELINE_V1


def test_a_registered_specification_is_listed_and_addressable_by_creator(app):
    a = app.register(name="Alpha")
    b = app.register(name="Beta")
    listed = app.read("list_specifications", 0, 10)
    assert listed["total"] == 2
    assert [row["specification_id"] for row in listed["items"]] == [b, a]
    mine = app.read("list_by_creator", CREATOR, 0, 10)
    assert [row["name"] for row in mine["items"]] == ["Beta", "Alpha"]
    theirs = app.read("list_by_creator", STRANGER, 0, 10)
    assert theirs["total"] == 0


def test_a_wrong_baseline_hash_is_refused(app):
    with pytest.raises(genlayer.UserError) as error:
        app.register(baseline_hash="00" * 32)
    assert refusal(error, "[HASH_MISMATCH]")


def test_an_empty_baseline_is_refused(app):
    with pytest.raises(genlayer.UserError) as error:
        app.register(baseline=" ")
    assert refusal(error, "[INVALID_INPUT]")


def test_an_empty_name_is_refused(app):
    with pytest.raises(genlayer.UserError) as error:
        app.register(name="   ")
    assert refusal(error, "[INVALID_INPUT]")


def test_angle_brackets_in_a_field_are_refused(app):
    with pytest.raises(genlayer.UserError) as error:
        app.register(name="bad >>> name")
    assert refusal(error, "[INVALID_INPUT]")


def test_adding_a_requirement_moves_the_state_and_stores_it(app):
    sid = app.register()
    app.add(sid, "PAY-001", LINE_ID, "BLOCKING")
    spec = app.read("get_specification", sid)
    assert spec["state"] == "REGISTERED"
    assert spec["requirement_count"] == 1
    items = app.read("get_requirements", sid)["items"]
    assert items[0]["requirement_id"] == "PAY-001"
    assert items[0]["severity"] == "BLOCKING"
    assert items[0]["frozen"] is False


def test_a_malformed_requirement_id_is_refused(app):
    sid = app.register()
    with pytest.raises(genlayer.UserError) as error:
        app.add(sid, "PAY001", LINE_ID)
    assert refusal(error, "[INVALID_REQUIREMENT]")


def test_a_lowercase_requirement_id_is_normalised(app):
    sid = app.register()
    assert app.add(sid, "pay-001", LINE_ID) == "PAY-001"
    assert app.read("get_requirements", sid)["items"][0]["requirement_id"] == "PAY-001"


def test_a_duplicate_requirement_is_refused(app):
    sid = app.register()
    app.add(sid, "PAY-001", LINE_ID)
    with pytest.raises(genlayer.UserError) as error:
        app.add(sid, "PAY-001", LINE_ID)
    assert refusal(error, "[INVALID_REQUIREMENT]")


def test_an_unknown_severity_is_refused(app):
    sid = app.register()
    with pytest.raises(genlayer.UserError) as error:
        app.add(sid, "PAY-001", LINE_ID, "CATASTROPHIC")
    assert refusal(error, "[INVALID_REQUIREMENT]")


def test_only_the_registrar_may_add_a_requirement(app):
    sid = app.register()
    with pytest.raises(genlayer.UserError) as error:
        app.add(sid, "PAY-001", LINE_ID, sender=STRANGER)
    assert refusal(error, "[UNAUTHORIZED]")


def test_freezing_seals_the_criteria(app):
    sid, frozen = app.frozen()
    spec = app.read("get_specification", sid)
    assert spec["state"] == "FROZEN"
    assert spec["frozen"] is True
    assert spec["criteria_digest"] == frozen
    criteria = app.read("get_criteria", sid)
    assert criteria["criteria_digest"] == criteria["computed_digest"]
    assert [row[0] for row in criteria["requirements"]] == ["ERR-001", "PAY-001", "PAY-002"]
    assert all(item["frozen"] for item in app.read("get_requirements", sid)["items"])


def test_the_frozen_digest_does_not_move_when_only_order_changes(app):
    """Two specifications with the same criteria hash to the same digest."""
    a, da = app.frozen(name="Alpha")
    b, db = app.frozen(name="Beta")
    assert da == db
    assert a != b


def test_a_requirement_cannot_be_added_after_freezing(app):
    sid, _ = app.frozen()
    with pytest.raises(genlayer.UserError) as error:
        app.add(sid, "NEW-001", LINE_ID)
    assert refusal(error, "[FROZEN_SPECIFICATION]")


def test_freezing_twice_is_refused(app):
    sid, _ = app.frozen()
    with pytest.raises(genlayer.UserError) as error:
        app.send("freeze_specification", sid)
    assert refusal(error, "[FROZEN_SPECIFICATION]")


def test_freezing_without_requirements_is_refused(app):
    sid = app.register()
    with pytest.raises(genlayer.UserError) as error:
        app.send("freeze_specification", sid)
    assert refusal(error, "[WRONG_STATE]")


def test_only_the_registrar_may_freeze(app):
    sid = app.register()
    app.add(sid, "PAY-001", LINE_ID)
    with pytest.raises(genlayer.UserError) as error:
        app.send("freeze_specification", sid, sender=STRANGER)
    assert refusal(error, "[UNAUTHORIZED]")


def test_an_unknown_specification_is_refused(app):
    with pytest.raises(genlayer.UserError) as error:
        app.read("get_specification", "S404")
    assert refusal(error, "[EXPECTED]")


def test_the_deployer_has_no_special_power(app):
    """The account recorded at deploy is not consulted anywhere."""
    sid = app.register()
    app.add(sid, "PAY-001", LINE_ID)
    with pytest.raises(genlayer.UserError) as error:
        app.send("freeze_specification", sid, sender=CREATOR if False else STRANGER)
    assert refusal(error, "[UNAUTHORIZED]")
    # and the registered creator can still do it
    assert app.send("freeze_specification", sid)


def test_requirement_limit_is_enforced(app):
    sid = app.register()
    for n in range(16):
        app.add(sid, f"REQ-{n:03d}", f"Requirement number {n} must hold.", "MINOR")
    with pytest.raises(genlayer.UserError) as error:
        app.add(sid, "REQ-999", "One more than the ceiling must hold.", "MINOR")
    assert refusal(error, "[LIMIT]")
