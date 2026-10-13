import json
from pathlib import Path

from eval.metrics import binary, per_type, prf, types_micro


def test_prf_and_binary():
    assert prf(8, 2, 2)["f1"] == 0.8
    b = binary([True, True, False, False], [True, False, True, False])
    assert (b["tp"], b["fp"], b["fn"], b["tn"], b["accuracy"]) == (1, 1, 1, 1, 0.5)
    assert prf(0, 0, 0)["f1"] == 0.0


def test_types():
    g, p = [{"a", "b"}, set()], [{"a"}, {"c"}]
    assert (types_micro(g, p)["tp"], types_micro(g, p)["fp"], types_micro(g, p)["fn"]) == (1, 1, 1)
    assert per_type(g, p)["c"]["fp"] == 1


def test_dataset_is_balanced_and_valid():
    rows = [json.loads(l) for l in (Path(__file__).parents[1] / "eval" / "dataset.jsonl").read_text().splitlines()]
    assert len(rows) == 100 and sum(r["ambiguous"] for r in rows) == 50
    assert all((r["types"] != []) == r["ambiguous"] for r in rows)
