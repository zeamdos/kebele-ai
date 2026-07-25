"""Local + Exa-backed retrieval for Kebele Navigator processes."""

from __future__ import annotations

import json
import re
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any

from config import EXA_API_KEY

DATABASE_PATH = Path(__file__).resolve().parent / "database.json"
LOCAL_CONFIDENCE_THRESHOLD = 0.45


class KebeleRetriever:
    """Retrieve kebele process info via local JSON matching, with optional Exa backup."""

    def __init__(
        self,
        database_path: str | Path | None = None,
        exa_api_key: str | None = None,
        use_exa_backup: bool = True,
    ) -> None:
        self.database_path = Path(database_path) if database_path else DATABASE_PATH
        self.exa_api_key = exa_api_key if exa_api_key is not None else EXA_API_KEY
        self.use_exa_backup = use_exa_backup
        self.processes = self._load_database()
        self._exa = None

    def _load_database(self) -> list[dict[str, Any]]:
        with self.database_path.open(encoding="utf-8") as handle:
            data = json.load(handle)
        return list(data.get("processes", []))

    def _normalize(self, text: str) -> str:
        text = text.strip().lower()
        text = re.sub(r"\s+", " ", text)
        return text

    def _tokens(self, text: str) -> set[str]:
        normalized = self._normalize(text)
        # Keep Amharic runs and latin alphanumerics as tokens
        parts = re.findall(r"[\u1200-\u137F]+|[a-z0-9]+", normalized)
        return {part for part in parts if len(part) > 1}

    def _similarity(self, left: str, right: str) -> float:
        return SequenceMatcher(None, self._normalize(left), self._normalize(right)).ratio()

    def _local_match_score(self, query: str, process: dict[str, Any]) -> float:
        query_norm = self._normalize(query)
        query_tokens = self._tokens(query)

        keywords = process.get("keywords", [])
        exact_hits = 0
        soft_hits = 0.0
        for keyword in keywords:
            keyword_norm = self._normalize(keyword)
            if not keyword_norm:
                continue
            if keyword_norm in query_norm or query_norm in keyword_norm:
                exact_hits += 1
            else:
                soft_hits += self._similarity(query_norm, keyword_norm)

        if exact_hits:
            keyword_score = min(1.0, 0.55 + 0.15 * exact_hits)
        else:
            keyword_score = min(1.0, soft_hits / max(1.0, len(keywords)))

        title_fields = [
            process.get("title", ""),
            process.get("title_en", ""),
            process.get("description", ""),
        ]
        title_score = max(
            (self._similarity(query_norm, field) for field in title_fields),
            default=0.0,
        )

        corpus_tokens: set[str] = set()
        for field in title_fields:
            corpus_tokens |= self._tokens(field)
        for keyword in keywords:
            corpus_tokens |= self._tokens(keyword)

        if query_tokens and corpus_tokens:
            overlap = len(query_tokens & corpus_tokens) / len(query_tokens)
        else:
            overlap = 0.0

        # Weighted blend of keyword containment, title similarity, and token overlap
        score = (0.5 * keyword_score) + (0.3 * title_score) + (0.2 * overlap)
        return round(min(1.0, score), 4)

    def _format_local_result(
        self,
        process: dict[str, Any],
        confidence: float,
    ) -> dict[str, Any]:
        return {
            "status": "success",
            "confidence": confidence,
            "title": process.get("title", ""),
            "requirements": list(process.get("required_documents", [])),
            "estimated_time": process.get("processing_time", ""),
            "fee": process.get("fee", ""),
            "source": "local",
            "process_id": process.get("id", ""),
            "title_en": process.get("title_en", ""),
        }

    def _empty_result(self, confidence: float = 0.0, status: str = "not_found") -> dict[str, Any]:
        return {
            "status": status,
            "confidence": confidence,
            "title": "",
            "requirements": [],
            "estimated_time": "",
            "fee": "",
            "source": "none",
        }

    def search_local(self, query: str) -> dict[str, Any]:
        """Perform keyword and similarity matching against database.json."""
        if not query or not query.strip():
            return self._empty_result(status="invalid_query")

        best_process: dict[str, Any] | None = None
        best_score = 0.0

        for process in self.processes:
            score = self._local_match_score(query, process)
            if score > best_score:
                best_score = score
                best_process = process

        if best_process is None or best_score <= 0.0:
            return self._empty_result()

        return self._format_local_result(best_process, best_score)

    def _get_exa_client(self):
        if self._exa is not None:
            return self._exa
        if not self.exa_api_key:
            return None
        try:
            from exa_py import Exa
        except ImportError:
            return None
        self._exa = Exa(api_key=self.exa_api_key)
        return self._exa

    def search_exa(self, query: str) -> dict[str, Any]:
        """Optional Exa backup search for official Ethiopian government directives."""
        client = self._get_exa_client()
        if client is None:
            return self._empty_result(status="exa_unavailable")

        search_query = (
            f"Ethiopia official government kebele woreda directive: {query} "
            "resident ID requirements documents fee processing time"
        )

        try:
            response = client.search_and_contents(
                search_query,
                type="auto",
                num_results=3,
                text=True,
                include_domains=[
                    "gov.et",
                    "aacrrsa.gov.et",
                    "ethiopia.gov.et",
                    "addisababa.gov.et",
                ],
            )
        except Exception:
            return self._empty_result(status="exa_error")

        results = getattr(response, "results", None) or []
        if not results:
            return self._empty_result(status="exa_not_found")

        top = results[0]
        default_title = "\u12e8\u1218\u1295\u130d\u1235\u1275 \u1218\u1218\u122a\u12eb \u12cd\u1324\u1275"
        verify_msg = "\u12a8\u12a6\u134a\u1234\u120b\u12ca \u121d\u1295\u132d \u12eb\u1228\u130b\u130d\u1321"
        fallback_req = (
            "\u12a8\u12a6\u134a\u1234\u120b\u12ca \u12e8\u1218\u1295\u130d\u1235\u1275 \u121d\u1295\u132d "
            "\u1270\u1328\u121b\u122a \u121b\u1228\u130b\u1308\u132b \u12eb\u1235\u1348\u120d\u130b\u120d"
        )

        title = getattr(top, "title", "") or default_title
        text = getattr(top, "text", "") or ""
        snippet = " ".join(text.split())[:500]

        # Confidence from Exa ranking position and content availability
        confidence = 0.55 if snippet else 0.4
        if len(results) >= 2:
            confidence += 0.1
        confidence = min(0.75, confidence)

        requirements = [snippet] if snippet else [fallback_req]

        return {
            "status": "success",
            "confidence": round(confidence, 4),
            "title": title,
            "requirements": requirements,
            "estimated_time": verify_msg,
            "fee": verify_msg,
            "source": "exa",
            "url": getattr(top, "url", ""),
        }

    def retrieve(self, query: str) -> dict[str, Any]:
        """
        Retrieve a structured process answer.

        1. Local keyword & similarity matching on database.json
        2. Optional Exa AI backup when local confidence is low
        """
        local_result = self.search_local(query)
        local_confidence = float(local_result.get("confidence", 0.0))

        if (
            local_result.get("status") == "success"
            and local_confidence >= LOCAL_CONFIDENCE_THRESHOLD
        ):
            return local_result

        if self.use_exa_backup and self.exa_api_key:
            exa_result = self.search_exa(query)
            if exa_result.get("status") == "success":
                # Prefer Exa only when it beats a weak local match
                if float(exa_result.get("confidence", 0.0)) > local_confidence:
                    return exa_result

        if local_result.get("status") == "success":
            return local_result

        return self._empty_result(confidence=local_confidence)


if __name__ == "__main__":
    retriever = KebeleRetriever(use_exa_backup=False)
    demos = [
        "\u1218\u1273\u12c8\u1242\u12eb\u12ec\u1295 \u121b\u12f0\u1235 \u12a5\u1348\u120d\u130b\u1208\u1201",
        "lost id replacement",
        "\u12e8\u12a0\u12f5\u122b\u123b \u121d\u12dd\u1308\u1263",
    ]
    for demo in demos:
        result = retriever.retrieve(demo)
        print(demo, "=>", json.dumps(result, ensure_ascii=False, indent=2))
