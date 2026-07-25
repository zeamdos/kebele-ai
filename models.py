"""Pydantic models for Kebele Navigator structured responses."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field, field_validator


class ProcessResult(BaseModel):
    """Structured retrieval payload returned by KebeleRetriever."""

    status: str
    confidence: float = Field(ge=0.0, le=1.0)
    title: str = ""
    requirements: list[str] = Field(default_factory=list)
    estimated_time: str = ""
    fee: str = ""
    source: str = "none"
    process_id: str = ""
    title_en: str = ""
    url: str = ""

    @field_validator("confidence")
    @classmethod
    def _clamp_confidence(cls, value: float) -> float:
        return max(0.0, min(1.0, float(value)))

    def as_dict(self) -> dict[str, Any]:
        """Return a plain dict for engine/UI consumers."""
        return self.model_dump()


class EngineResponse(BaseModel):
    """Guarded engine response for text/audio queries."""

    mode: str
    confidence: float = Field(ge=0.0, le=1.0)
    message: str
    query: str = ""
    result: dict[str, Any] = Field(default_factory=dict)
    transcription: str | None = None
    audio_file: str | None = None
