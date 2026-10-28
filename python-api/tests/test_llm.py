import pytest

from app import llm

SCORES = [
    {"key": "a", "name": "朝食", "weight": 50, "score": 50},
    {"key": "b", "name": "運動", "weight": 50, "score": 0},
]


@pytest.fixture(autouse=True)
def clear_key(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)


def test_no_key_fallback():
    fb, src = llm.generate_feedback(50, SCORES, {}, "")
    assert src == "fallback" and "朝食" in fb and "運動" in fb


def test_placeholder_key_fallback(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "ここにAPIキーを入力")
    assert llm.generate_feedback(50, SCORES, {}, "")[1] == "fallback"


def test_success(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "k")
    fb, src = llm.generate_feedback(50, SCORES, {}, "memo", caller=lambda p, k, m: "OK")
    assert (fb, src) == ("OK", "gemini")


def test_caller_receives_prompt_with_note(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "k")
    seen = {}

    def caller(p, k, m):
        seen.update(p=p, k=k, m=m)
        return "x"

    llm.generate_feedback(50, SCORES, {"a": "はい"}, "だるい", caller=caller)
    assert "だるい" in seen["p"] and "50/100" in seen["p"] and seen["k"] == "k"


def test_exception_fallback(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "k")

    def boom(p, k, m):
        raise TimeoutError

    assert llm.generate_feedback(50, SCORES, {}, "", caller=boom)[1] == "fallback"


@pytest.mark.parametrize("total,word", [(100, "とても健康的"), (80, "とても健康的"), (79, "まずまず"), (50, "まずまず"), (49, "お疲れ"), (0, "お疲れ")])
def test_fallback_tiers_boundaries(total, word):
    assert word in llm.fallback_feedback(total, SCORES)


def test_fallback_zero_weight_safe():
    assert llm.fallback_feedback(0, [{"key": "a", "name": "A", "weight": 0, "score": 0}])
