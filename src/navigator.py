"""Kebele Navigator orchestration: voice/text → retrieve → guardrail → TTS."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Optional

from src.addis_client import AddisClient, SpeechResult, TranscriptionResult
from src.config import Settings, get_settings
from src.guardrail import GuardrailDecision, apply_guardrail
from src.retriever import KebeleRetriever, MatchResult

logger = logging.getLogger(__name__)


@dataclass
class NavigatorResponse:
    query_text: str
    match: MatchResult
    decision: GuardrailDecision
    transcription: Optional[TranscriptionResult] = None
    speech: Optional[SpeechResult] = None
    exa_snippets: list[str] = field(default_factory=list)

    @property
    def response_text_am(self) -> str:
        return self.decision.response_text_am

    @property
    def confidence(self) -> float:
        return self.decision.confidence

    @property
    def is_clarification(self) -> bool:
        return self.decision.is_clarification


class KebeleNavigator:
    """Voice-first Amharic civic assistant with a hard confidence floor."""

    def __init__(
        self,
        settings: Optional[Settings] = None,
        *,
        retriever: Optional[KebeleRetriever] = None,
        addis: Optional[AddisClient] = None,
    ):
        self.settings = settings or get_settings()
        self.retriever = retriever or KebeleRetriever(self.settings)
        self.addis = addis or AddisClient(self.settings)

    def answer_text(self, query: str, *, synthesize: bool = False) -> NavigatorResponse:
        match = self.retriever.retrieve(query, use_exa=True)
        decision = apply_guardrail(match, threshold=self.settings.confidence_threshold)
        speech = None
        if synthesize and self.settings.addis_configured:
            speech = self._safe_tts(decision.response_text_am)
        return NavigatorResponse(
            query_text=query,
            match=match,
            decision=decision,
            speech=speech,
            exa_snippets=list(match.exa_snippets),
        )

    def answer_audio(
        self,
        audio_bytes: bytes,
        *,
        filename: str = "query.wav",
        synthesize: bool = True,
    ) -> NavigatorResponse:
        if not self.settings.addis_configured:
            raise RuntimeError("ADDIS_API_KEY is required for voice input.")

        transcription = self.addis.transcribe(_NamedBytes(audio_bytes, filename))
        query = (transcription.text or "").strip()
        if not query:
            from src.prompts import CLARIFICATION_FALLBACK_AM
            from src.retriever import MatchResult

            empty = MatchResult(service=None, confidence=0.0, method="empty_transcription")
            decision = GuardrailDecision(
                allowed=False,
                confidence=0.0,
                threshold=self.settings.confidence_threshold,
                reason="empty_transcription",
                service=None,
                response_text_am=CLARIFICATION_FALLBACK_AM,
                is_clarification=True,
            )
            speech = self._safe_tts(decision.response_text_am) if synthesize else None
            return NavigatorResponse(
                query_text="",
                match=empty,
                decision=decision,
                transcription=transcription,
                speech=speech,
            )

        response = self.answer_text(query, synthesize=synthesize)
        response.transcription = transcription
        return response

    def _safe_tts(self, text: str) -> Optional[SpeechResult]:
        try:
            return self.addis.synthesize(text, language=self.settings.language_code)
        except Exception as exc:
            logger.error("TTS failed: %s", exc)
            return None


class _NamedBytes:
    """Bytes wrapper that exposes a .name and .read() for Addis uploads."""

    def __init__(self, data: bytes, name: str):
        self._data = data
        self.name = name
        self._pos = 0

    def read(self, n: int = -1) -> bytes:
        if n is None or n < 0:
            chunk = self._data[self._pos :]
            self._pos = len(self._data)
            return chunk
        chunk = self._data[self._pos : self._pos + n]
        self._pos += len(chunk)
        return chunk
