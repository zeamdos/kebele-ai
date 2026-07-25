"""Tests for the anti-hallucination confidence guardrail."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from src.config import DEFAULT_CONFIDENCE_THRESHOLD, get_settings
from src.guardrail import apply_guardrail
from src.navigator import KebeleNavigator
from src.prompts import CLARIFICATION_FALLBACK_AM
from src.retriever import KebeleRetriever, MatchResult, VerifiedKnowledgeBase


def test_threshold_default_is_080():
    assert DEFAULT_CONFIDENCE_THRESHOLD == 0.80
    settings = get_settings()
    assert settings.confidence_threshold == 0.80


def test_low_confidence_returns_clarification_fallback():
    kb = VerifiedKnowledgeBase(ROOT / "data" / "verified_kebele.json")
    service = kb.services[0]
    match = MatchResult(service=service, confidence=0.79, method="test", matched_term="x")
    decision = apply_guardrail(match, threshold=0.80)
    assert decision.allowed is False
    assert decision.is_clarification is True
    assert decision.response_text_am == CLARIFICATION_FALLBACK_AM
    assert decision.service is None


def test_high_confidence_returns_verified_requirements_only():
    kb = VerifiedKnowledgeBase(ROOT / "data" / "verified_kebele.json")
    service = next(s for s in kb.services if s.id == "id_card_renewal")
    match = MatchResult(
        service=service,
        confidence=0.94,
        method="test",
        matched_term="\u1218\u1273\u12c8\u1242\u12eb",
    )
    decision = apply_guardrail(match, threshold=0.80)
    assert decision.allowed is True
    assert decision.is_clarification is False
    assert decision.service is not None
    for req in service.requirements_am:
        assert req in decision.response_text_am
    assert "\u12a8\u1270\u1228\u130b\u1308\u1320" in decision.response_text_am


def test_no_match_never_guesses():
    match = MatchResult(service=None, confidence=0.0, method="none")
    decision = apply_guardrail(match, threshold=0.80)
    assert decision.allowed is False
    assert decision.response_text_am == CLARIFICATION_FALLBACK_AM


def test_retriever_matches_id_card_above_threshold():
    settings = get_settings()
    retriever = KebeleRetriever(settings)
    query = "\u1218\u1273\u12c8\u1242\u12eb \u121b\u12f0\u1235 \u121d\u1295 \u12eb\u1235\u1348\u120d\u130b\u120d"
    match = retriever.retrieve(query, use_exa=False)
    assert match.service is not None
    assert match.service.id == "id_card_renewal"
    assert match.confidence >= 0.80


def test_retriever_rejects_unrelated_query():
    settings = get_settings()
    retriever = KebeleRetriever(settings)
    query = "\u12e8\u1352\u12db \u1264\u1275 \u1230\u12d3\u1275 \u1235\u1295\u1275 \u1290\u12cd"
    match = retriever.retrieve(query, use_exa=False)
    decision = apply_guardrail(match, threshold=settings.confidence_threshold)
    assert decision.is_clarification is True
    assert decision.response_text_am == CLARIFICATION_FALLBACK_AM


def test_navigator_text_pipeline_guardrail():
    nav = KebeleNavigator(get_settings())
    ok_query = "\u12e8\u1218\u1296\u122a\u12eb \u121b\u1228\u130b\u1308\u132b \u12f0\u1265\u12f3\u1264"
    ok = nav.answer_text(ok_query, synthesize=False)
    assert ok.decision.allowed is True
    assert ok.decision.service.id == "residence_certificate"

    blocked = nav.answer_text("asdf qwer zxcv random", synthesize=False)
    assert blocked.decision.is_clarification is True
    assert blocked.response_text_am == CLARIFICATION_FALLBACK_AM
