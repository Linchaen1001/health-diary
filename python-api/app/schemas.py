from typing import Any

from pydantic import BaseModel, Field

from .scoring import ITEM_TYPES

FREE_TEXT_MAX = 1000


class EvalItem(BaseModel):
    key: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=100)
    type: str = Field(pattern="^(" + "|".join(ITEM_TYPES) + ")$")
    weight: int = Field(ge=0, le=100)
    value: Any
    target: str | None = None


class EvaluateRequest(BaseModel):
    items: list[EvalItem] = Field(min_length=1, max_length=50)
    free_text: str = Field(default="", max_length=FREE_TEXT_MAX)


class ItemScore(BaseModel):
    key: str
    name: str
    weight: int
    score: float


class EvaluateResponse(BaseModel):
    total_score: int
    item_scores: list[ItemScore]
    feedback: str
    feedback_source: str  # "gemini" | "fallback"
