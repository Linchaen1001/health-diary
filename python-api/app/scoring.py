"""採点ロジック(純関数)。

項目タイプ:
  bool   : True/False
  scale3 : 1〜3 の整数
  scale5 : 1〜5 の整数
  water  : 水分量(L) 0〜20。1.5L で満点
  steps  : 歩数 0〜100000。8000歩で満点
  time   : "HH:MM"。target(目標時刻)との差 0分=満点、60分以上=0点(線形)
"""
from __future__ import annotations

import math
import re

ITEM_TYPES = ("bool", "scale3", "scale5", "water", "steps", "time")

WATER_FULL_L = 1.5
WATER_MAX_L = 20.0
STEPS_FULL = 8000
STEPS_MAX = 100000
TIME_ZERO_DIFF_MIN = 60

_TIME_RE = re.compile(r"^([01]\d|2[0-3]):([0-5]\d)$")


class ScoringError(ValueError):
    """入力値が不正なときに送出する。"""


def _is_number(v) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v)


def _to_minutes(s: str) -> int:
    m = _TIME_RE.match(s) if isinstance(s, str) else None
    if not m:
        raise ScoringError(f"時刻は HH:MM 形式で指定してください: {s!r}")
    return int(m.group(1)) * 60 + int(m.group(2))


def normalize(item_type: str, value, target: str | None = None) -> float:
    """値を 0.0〜1.0 に正規化する。"""
    if item_type == "bool":
        if not isinstance(value, bool):
            raise ScoringError("bool 項目には true/false を指定してください")
        return 1.0 if value else 0.0

    if item_type in ("scale3", "scale5"):
        top = 3 if item_type == "scale3" else 5
        if isinstance(value, bool) or not isinstance(value, int) or not 1 <= value <= top:
            raise ScoringError(f"{item_type} は 1〜{top} の整数で指定してください")
        return (value - 1) / (top - 1)

    if item_type == "water":
        if not _is_number(value) or not 0 <= value <= WATER_MAX_L:
            raise ScoringError(f"水分量は 0〜{WATER_MAX_L:g}L の数値で指定してください")
        return min(value / WATER_FULL_L, 1.0)

    if item_type == "steps":
        if not _is_number(value) or not 0 <= value <= STEPS_MAX:
            raise ScoringError(f"歩数は 0〜{STEPS_MAX} の数値で指定してください")
        return min(value / STEPS_FULL, 1.0)

    if item_type == "time":
        diff = abs(_to_minutes(value) - _to_minutes(target or "07:00"))
        diff = min(diff, 1440 - diff)  # 日付をまたぐ差を考慮
        return max(0.0, 1.0 - diff / TIME_ZERO_DIFF_MIN)

    raise ScoringError(f"未知の項目タイプです: {item_type!r}")


def allocate_weights(n: int) -> list[int]:
    """n 項目に合計が厳密に 100 になるよう按分する。余りは先頭から 1 点ずつ。"""
    if not isinstance(n, int) or n < 1:
        raise ScoringError("項目数は 1 以上である必要があります")
    base, rem = divmod(100, n)
    return [base + (1 if i < rem else 0) for i in range(n)]


def score_items(items: list[dict]) -> tuple[int, list[dict]]:
    """items: [{key,name,type,weight,value,target?}] → (総合点, 項目別結果)。"""
    if not items:
        raise ScoringError("採点項目がありません")
    keys = [i["key"] for i in items]
    if len(set(keys)) != len(keys):
        raise ScoringError("項目キーが重複しています")
    if sum(i["weight"] for i in items) != 100:
        raise ScoringError("重みの合計は 100 である必要があります")

    results = []
    total = 0.0
    for i in items:
        if i["weight"] < 0:
            raise ScoringError("重みは 0 以上である必要があります")
        ratio = normalize(i["type"], i["value"], i.get("target"))
        score = ratio * i["weight"]
        total += score
        results.append(
            {"key": i["key"], "name": i["name"], "weight": i["weight"], "score": round(score, 1)}
        )
    return max(0, min(100, round(total))), results
