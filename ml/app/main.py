"""FairView ML service. Only the FairView backend should call it; never expose it publicly.

Run:  uvicorn app.main:app --port 8000
"""
from __future__ import annotations

import os
import secrets
from typing import Annotated

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

from .analysis import Pair, Settings, analyse

VERSION = "1.0.0"
MAX_PAIRS = 200_000

app = FastAPI(title="FairView ML service", version=VERSION)


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="forbid")


class PairIn(CamelModel):
    manager_id: str = Field(min_length=1, max_length=64)
    employee_id: str = Field(min_length=1, max_length=64)
    manager_score: int = Field(ge=1, le=5)
    client_score: int = Field(ge=1, le=5)


class SettingsIn(CamelModel):
    min_pair: int = Field(10, ge=2, le=1000)
    min_rest: int = Field(10, ge=2, le=100_000)
    threshold: float = Field(2.5, gt=0, le=10)


class AnalyzeRequest(CamelModel):
    pairs: list[PairIn] = Field(max_length=MAX_PAIRS)
    settings: SettingsIn = SettingsIn()


def check_api_key(x_api_key: Annotated[str | None, Header()] = None) -> None:
    """If ML_API_KEY is set, every request must send the same value in the x-api-key header."""
    expected = os.environ.get("ML_API_KEY", "")
    if expected and not secrets.compare_digest(x_api_key or "", expected):
        raise HTTPException(status_code=401, detail="Wrong or missing API key.")


@app.get("/health")
def health() -> dict:
    return {"ok": True, "version": VERSION}


@app.post("/analyze", dependencies=[Depends(check_api_key)])
def analyze(body: AnalyzeRequest) -> dict:
    pairs = [Pair(p.manager_id, p.employee_id, p.manager_score, p.client_score) for p in body.pairs]
    settings = Settings(body.settings.min_pair, body.settings.min_rest, body.settings.threshold)
    results = analyse(pairs, settings)
    return {
        "pairs": results,
        "model": {
            "version": VERSION,
            "isolationForest": any(r["patternScore"] is not None for r in results),
        },
    }
