"""Anti-sycophancy / hallucination guardrail for kebele answers."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from src.config import DEFAULT_CONFIDENCE_THRESHOLD
from src.prompts import CLARIFICATION_FALLBACK_AM, DISCLAIMER_AM
from src.retriever import MatchResult, VerifiedService


@dataclass(frozen=True)
class GuardrailDecision:
    allowed: bool
    confidence: float
    threshold: float
    reason: str
    service: Optional[VerifiedService]
    response_text_am: str
    is_clarification: bool


def apply_guardrail(
    match: MatchResult,
    *,
    threshold: float = DEFAULT_CONFIDENCE_THRESHOLD,
) -> GuardrailDecision:
    """Allow an answer only when verified match confidence >= threshold.

    Below threshold, never guess requirements — emit the explicit Amharic
    clarification fallback prompt instead.
    """
    confidence = float(match.confidence or 0.0)

    if match.service is None or confidence < threshold:
        return GuardrailDecision(
            allowed=False,
            confidence=confidence,
            threshold=threshold,
            reason=(
                "no_verified_match"
                if match.service is None
                else f"confidence_below_threshold ({confidence:.2f} < {threshold:.2f})"
            ),
            service=None,
            response_text_am=CLARIFICATION_FALLBACK_AM,
            is_clarification=True,
        )

    answer = format_verified_answer(match.service, confidence=confidence)
    return GuardrailDecision(
        allowed=True,
        confidence=confidence,
        threshold=threshold,
        reason="verified_match",
        service=match.service,
        response_text_am=answer,
        is_clarification=False,
    )


def format_verified_answer(service: VerifiedService, *, confidence: float) -> str:
    """Format a response strictly from verified fields — no unstated claims."""
    from src.prompts import (
        ANSWER_HEADER_AM,
        CONFIDENCE_LABEL_AM,
        NOTES_LABEL_AM,
        OFFICE_LABEL_AM,
        REQUIREMENTS_LABEL_AM,
        STEPS_LABEL_AM,
    )

    lines = [
        ANSWER_HEADER_AM,
        "",
        service.title_am,
        f"{CONFIDENCE_LABEL_AM} {confidence:.0%}",
        "",
        REQUIREMENTS_LABEL_AM,
    ]
    for idx, item in enumerate(service.requirements_am, start=1):
        lines.append(f"{idx}. {item}")

    if service.steps_am:
        lines.append("")
        lines.append(STEPS_LABEL_AM)
        for idx, step in enumerate(service.steps_am, start=1):
            lines.append(f"{idx}. {step}")

    if service.office_am:
        lines.append("")
        lines.append(f"{OFFICE_LABEL_AM} {service.office_am}")

    if service.notes_am:
        lines.append("")
        lines.append(f"{NOTES_LABEL_AM} {service.notes_am}")

    lines.append("")
    lines.append(DISCLAIMER_AM)
    return "\n".join(lines)
