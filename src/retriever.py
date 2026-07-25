"""Verified kebele knowledge matching + optional Exa AI retrieval."""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

from rapidfuzz import fuzz

from src.config import Settings

logger = logging.getLogger(__name__)


@dataclass
class VerifiedService:
    id: str
    category: str
    title_am: str
    title_en: str
    aliases_am: list[str]
    aliases_en: list[str]
    requirements_am: list[str]
    steps_am: list[str]
    office_am: str
    notes_am: str

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "VerifiedService":
        return cls(
            id=raw["id"],
            category=raw.get("category", ""),
            title_am=raw.get("title_am", ""),
            title_en=raw.get("title_en", ""),
            aliases_am=list(raw.get("aliases_am") or []),
            aliases_en=list(raw.get("aliases_en") or []),
            requirements_am=list(raw.get("requirements_am") or []),
            steps_am=list(raw.get("steps_am") or []),
            office_am=raw.get("office_am", ""),
            notes_am=raw.get("notes_am", ""),
        )

    def searchable_blob(self) -> str:
        parts = [
            self.category,
            self.title_am,
            self.title_en,
            *self.aliases_am,
            *self.aliases_en,
        ]
        return " ".join(p for p in parts if p)


@dataclass
class MatchResult:
    service: Optional[VerifiedService]
    confidence: float
    matched_term: str = ""
    method: str = "none"
    exa_snippets: list[str] = field(default_factory=list)
    disclaimer_am: str = ""


class VerifiedKnowledgeBase:
    """Load and score queries against verified kebele requirements only."""

    def __init__(self, path: Path):
        self.path = path
        self.disclaimer_am = ""
        self.services: list[VerifiedService] = []
        self._load()

    def _load(self) -> None:
        payload = json.loads(self.path.read_text(encoding="utf-8"))
        self.disclaimer_am = payload.get("disclaimer_am", "")
        self.services = [VerifiedService.from_dict(item) for item in payload.get("services", [])]
        if not self.services:
            raise ValueError(f"No verified services found in {self.path}")

    def match(self, query: str) -> MatchResult:
        cleaned = _normalize(query)
        if not cleaned:
            return MatchResult(service=None, confidence=0.0, method="empty", disclaimer_am=self.disclaimer_am)

        best_service: Optional[VerifiedService] = None
        best_score = 0.0
        best_term = ""
        best_method = "none"

        for service in self.services:
            score, term, method = _score_service(cleaned, service)
            if score > best_score:
                best_score = score
                best_service = service
                best_term = term
                best_method = method

        return MatchResult(
            service=best_service if best_score > 0 else None,
            confidence=round(best_score, 4),
            matched_term=best_term,
            method=best_method,
            disclaimer_am=self.disclaimer_am,
        )


class ExaRetriever:
    """Optional Exa search for corroborating official civic context.

    Exa never invents requirements. Snippets are attached only when a verified
    local match already clears the confidence threshold.
    """

    def __init__(self, settings: Settings):
        self.settings = settings
        self._client = None
        if settings.exa_api_key:
            try:
                from exa_py import Exa

                self._client = Exa(api_key=settings.exa_api_key)
            except Exception as exc:  # pragma: no cover
                logger.warning("exa-py unavailable: %s", exc)

    @property
    def enabled(self) -> bool:
        return self._client is not None

    def search_snippets(self, query: str, *, num_results: int = 3) -> list[str]:
        if not self._client:
            return []
        try:
            # Prefer Ethiopian civic / government oriented retrieval.
            enriched = (
                f"Ethiopia kebele administrative requirements: {query}"
            )
            results = self._client.search(
                enriched,
                type="auto",
                num_results=num_results,
                contents={"highlights": True},
            )
            snippets: list[str] = []
            for item in getattr(results, "results", []) or []:
                title = getattr(item, "title", "") or ""
                url = getattr(item, "url", "") or ""
                highlights = getattr(item, "highlights", None) or []
                highlight_text = " ".join(highlights) if isinstance(highlights, list) else str(highlights)
                piece = " | ".join(p for p in [title, highlight_text, url] if p).strip()
                if piece:
                    snippets.append(piece)
            return snippets
        except Exception as exc:
            logger.warning("Exa search failed: %s", exc)
            return []


class KebeleRetriever:
    """Compose verified local matching with optional Exa corroboration."""

    def __init__(self, settings: Settings, kb: Optional[VerifiedKnowledgeBase] = None):
        self.settings = settings
        self.kb = kb or VerifiedKnowledgeBase(settings.verified_kb_path)
        self.exa = ExaRetriever(settings)

    def retrieve(self, query: str, *, use_exa: bool = True) -> MatchResult:
        match = self.kb.match(query)
        if (
            use_exa
            and match.service is not None
            and match.confidence >= self.settings.confidence_threshold
            and self.exa.enabled
        ):
            match.exa_snippets = self.exa.search_snippets(
                f"{match.service.title_en} {match.service.title_am}"
            )
        return match


def _normalize(text: str) -> str:
    text = text.strip().lower()
    text = re.sub(r"\s+", " ", text)
    return text


def _score_service(query: str, service: VerifiedService) -> tuple[float, str, str]:
    """Return (confidence, matched_term, method) for a verified service."""
    candidates: list[tuple[str, str]] = [
        (service.title_am, "title_am"),
        (service.title_en, "title_en"),
        (service.category, "category"),
        *[(alias, "alias_am") for alias in service.aliases_am],
        *[(alias, "alias_en") for alias in service.aliases_en],
    ]

    best = 0.0
    best_term = ""
    best_method = "none"

    for term, method in candidates:
        if not term:
            continue
        normalized_term = _normalize(term)

        # Exact / containment gets a strong verified score.
        if query == normalized_term:
            return 1.0, term, f"exact:{method}"
        if normalized_term in query or query in normalized_term:
            score = 0.94 if len(normalized_term) >= 3 else 0.85
            if score > best:
                best, best_term, best_method = score, term, f"contains:{method}"

        # Token overlap for multi-word Amharic / English queries.
        token_score = _token_overlap(query, normalized_term)
        if token_score > best:
            best, best_term, best_method = token_score, term, f"tokens:{method}"

        # Fuzzy ratio as a backstop (never invents requirements; only ranks).
        fuzzy = fuzz.token_set_ratio(query, normalized_term) / 100.0
        # Soft-penalize weak fuzzy matches so threshold stays meaningful.
        fuzzy = fuzzy * 0.97
        if fuzzy > best:
            best, best_term, best_method = fuzzy, term, f"fuzzy:{method}"

    return best, best_term, best_method


def _token_overlap(query: str, term: str) -> float:
    q_tokens = set(query.split())
    t_tokens = set(term.split())
    if not q_tokens or not t_tokens:
        return 0.0
    overlap = q_tokens & t_tokens
    if not overlap:
        return 0.0
    # Dice-like coefficient, biased toward needing most of the service term.
    precision = len(overlap) / len(q_tokens)
    recall = len(overlap) / len(t_tokens)
    if recall < 0.5 and len(t_tokens) > 1:
        return 0.0
    return (2 * precision * recall) / (precision + recall) if (precision + recall) else 0.0
