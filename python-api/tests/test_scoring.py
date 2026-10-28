import pytest

from app.scoring import ScoringError, allocate_weights, normalize, score_items


def mk(key, type_, weight, value, target=None):
    d = {"key": key, "name": key, "type": type_, "weight": weight, "value": value}
    if target:
        d["target"] = target
    return d


# ---------- 正常系 ----------
def test_all_max_is_100():
    items = [mk("a", "bool", 50, True), mk("b", "scale5", 50, 5)]
    total, res = score_items(items)
    assert total == 100
    assert [r["score"] for r in res] == [50, 50]


def test_all_zero_is_0():
    items = [mk("a", "bool", 50, False), mk("b", "scale5", 50, 1)]
    assert score_items(items)[0] == 0


def test_mixed():
    items = [mk("a", "bool", 40, True), mk("b", "scale3", 30, 2), mk("c", "water", 30, 0.75)]
    total, _ = score_items(items)
    assert total == 40 + 15 + 15


def test_time_exact_and_scale_midpoints():
    assert normalize("time", "07:00", "07:00") == 1.0
    assert normalize("scale5", 3) == 0.5
    assert normalize("scale3", 2) == 0.5


# ---------- 異常系 ----------
@pytest.mark.parametrize(
    "t,v",
    [
        ("bool", 1),
        ("bool", "yes"),
        ("scale5", "3"),
        ("scale5", True),
        ("scale3", 2.5),
        ("water", "1.5"),
        ("water", float("nan")),
        ("steps", None),
        ("time", "7:00"),
        ("time", "25:00"),
        ("time", 700),
        ("unknown", 1),
    ],
)
def test_invalid_values_raise(t, v):
    with pytest.raises(ScoringError):
        normalize(t, v, "07:00")


def test_weight_sum_not_100():
    with pytest.raises(ScoringError):
        score_items([mk("a", "bool", 50, True)])


def test_duplicate_keys():
    with pytest.raises(ScoringError):
        score_items([mk("a", "bool", 50, True), mk("a", "bool", 50, True)])


def test_empty_items():
    with pytest.raises(ScoringError):
        score_items([])


def test_negative_weight():
    with pytest.raises(ScoringError):
        score_items([mk("a", "bool", -10, True), mk("b", "bool", 110, True)])


# ---------- 境界値 ----------
@pytest.mark.parametrize(
    "v,expected",
    [(0, 0.0), (0.75, 0.5), (1.5, 1.0), (2.0, 1.0), (20, 1.0)],
)
def test_water_boundaries(v, expected):
    assert normalize("water", v) == pytest.approx(expected)


@pytest.mark.parametrize("v", [-0.1, 20.1])
def test_water_out_of_range(v):
    with pytest.raises(ScoringError):
        normalize("water", v)


@pytest.mark.parametrize("v,expected", [(0, 0.0), (4000, 0.5), (8000, 1.0), (100000, 1.0)])
def test_steps_boundaries(v, expected):
    assert normalize("steps", v) == pytest.approx(expected)


@pytest.mark.parametrize("v", [-1, 100001])
def test_steps_out_of_range(v):
    with pytest.raises(ScoringError):
        normalize("steps", v)


@pytest.mark.parametrize("t,v", [("scale5", 0), ("scale5", 6), ("scale3", 0), ("scale3", 4)])
def test_scale_out_of_range(t, v):
    with pytest.raises(ScoringError):
        normalize(t, v)


@pytest.mark.parametrize("v", [1, 5])
def test_scale5_ends(v):
    assert normalize("scale5", v) == (0.0 if v == 1 else 1.0)


@pytest.mark.parametrize(
    "actual,expected",
    [("07:00", 1.0), ("07:30", 0.5), ("07:59", pytest.approx(1 / 60)), ("08:00", 0.0), ("08:01", 0.0), ("06:00", 0.0)],
)
def test_wake_time_diff(actual, expected):
    assert normalize("time", actual, "07:00") == expected


def test_time_wraps_midnight():
    assert normalize("time", "23:50", "00:10") == pytest.approx(1 - 20 / 60)


@pytest.mark.parametrize("n", [1, 2, 3, 7, 11, 13, 15, 100])
def test_weights_always_sum_100(n):
    w = allocate_weights(n)
    assert len(w) == n and sum(w) == 100
    assert max(w) - min(w) <= 1


@pytest.mark.parametrize("n", [0, -1, 1.5])
def test_allocate_invalid(n):
    with pytest.raises(ScoringError):
        allocate_weights(n)


def test_total_rounding_and_clamp():
    items = [mk("a", "scale5", 50, 2), mk("b", "scale5", 50, 2)]  # 25 + 25
    assert score_items(items)[0] == 25
    items = [mk(f"k{i}", "bool", w, True) for i, w in enumerate(allocate_weights(7))]
    assert score_items(items)[0] == 100
