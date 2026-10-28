import hmac
import os

from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException

load_dotenv()

from . import llm  # noqa: E402
from .schemas import EvaluateRequest, EvaluateResponse  # noqa: E402
from .scoring import ScoringError, score_items  # noqa: E402

app = FastAPI(title="Health Diary Internal API")


def _check_token(token: str | None) -> None:
    expected = os.getenv("INTERNAL_TOKEN", "")
    if not expected or not token or not hmac.compare_digest(token, expected):
        raise HTTPException(status_code=401, detail="unauthorized")


def _describe(item: dict) -> str:
    v = item["value"]
    if item["type"] == "bool":
        return "はい" if v else "いいえ"
    if item["type"] == "water":
        return f"{v}L"
    if item["type"] == "steps":
        return f"{v}歩"
    if item["type"] in ("scale3", "scale5"):
        return f"{v}段階目"
    return str(v)


@app.post("/internal/evaluate", response_model=EvaluateResponse)
def evaluate(req: EvaluateRequest, x_internal_token: str | None = Header(default=None)):
    _check_token(x_internal_token)
    items = [i.model_dump() for i in req.items]
    try:
        total, item_scores = score_items(items)
    except ScoringError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    answers = {i["key"]: _describe(i) for i in items}
    feedback, source = llm.generate_feedback(total, item_scores, answers, req.free_text)
    return {
        "total_score": total,
        "item_scores": item_scores,
        "feedback": feedback,
        "feedback_source": source,
    }


@app.get("/health")
def health():
    return {"ok": True}
