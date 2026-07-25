"""Kebele Navigator engine: voice + retrieval with anti-sycophancy guardrails."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from retriever import KebeleRetriever
from voice import AddisAIVoicePipeline

CONFIDENCE_THRESHOLD = 0.75

ANTI_SYCOPHANCY_FALLBACK = "ይቅርታ! የጠየቁት የቀበሌ አገልግሎት በግልጽ አልተረዳሁም። እባክዎ በቀበሌው የሚፈልጉትን አገልግሎት (ምሳሌ፡ 'መታወቂያ ማደስ'፣ 'የጠፋ መታወቂያ' ወይም 'አድራሻ ምዝገባ') ብለው በግልጽ ይናገሩ።"


class KebeleEngine:
    """Orchestrates STT/TTS and process retrieval with a confidence guardrail."""

    def __init__(
        self,
        retriever: KebeleRetriever | None = None,
        voice: AddisAIVoicePipeline | None = None,
        confidence_threshold: float = CONFIDENCE_THRESHOLD,
    ) -> None:
        self.retriever = retriever or KebeleRetriever()
        self.voice = voice or AddisAIVoicePipeline()
        self.confidence_threshold = confidence_threshold

    def process_text(self, user_text: str) -> dict[str, Any]:
        """Run retrieval on user text and apply the anti-sycophancy guardrail."""
        query = (user_text or "").strip()
        if not query:
            return self._fallback_result(query="", confidence=0.0)

        result = self.retriever.retrieve(query)
        confidence = float(result.get("confidence", 0.0) or 0.0)

        if result.get("status") == "success" and confidence >= self.confidence_threshold:
            message = self._format_verified_checklist(result)
            return {
                "mode": "verified",
                "confidence": confidence,
                "message": message,
                "query": query,
                "result": result,
            }

        return self._fallback_result(query=query, confidence=confidence, result=result)

    def process_audio(self, audio_file_path: str | Path) -> dict[str, Any]:
        """Transcribe Amharic audio, then run the same guarded retrieval flow."""
        transcription = self.voice.transcribe_audio(audio_file_path)
        response = self.process_text(transcription)
        response["transcription"] = transcription
        response["audio_file"] = str(audio_file_path)
        return response

    def speak(self, text_amharic: str) -> bytes:
        """Convert an Amharic response message to speech audio bytes."""
        return self.voice.text_to_speech(text_amharic)

    def process_text_with_speech(self, user_text: str) -> dict[str, Any]:
        """Process text and attach TTS audio bytes for the response message."""
        response = self.process_text(user_text)
        response["audio_bytes"] = self.speak(response["message"])
        return response

    def _fallback_result(
        self,
        query: str,
        confidence: float,
        result: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        return {
            "mode": "anti_sycophancy",
            "confidence": confidence,
            "message": ANTI_SYCOPHANCY_FALLBACK,
            "query": query,
            "result": result or {},
        }

    def _format_verified_checklist(self, result: dict[str, Any]) -> str:
        """Build a full verified checklist in Amharic from a high-confidence match."""
        title = str(result.get("title") or "")
        requirements = list(result.get("requirements") or [])
        fee = str(result.get("fee") or "-")
        estimated_time = str(result.get("estimated_time") or "-")

        header = 'የተረጋገጠ መመሪያ'
        service_label = 'አገልግሎት'
        docs_label = 'አስፈላጊ ሰነዶች'
        fee_label = 'ክፍያ'
        time_label = 'የሚፈጅ ጊዜ'

        lines = [
            header,
            "",
            f"{service_label}: {title}",
            "",
            f"{docs_label}:",
        ]

        if requirements:
            for index, item in enumerate(requirements, start=1):
                lines.append(f"{index}. {item}")
        else:
            lines.append("-")

        lines.extend(
            [
                "",
                f"{fee_label}: {fee}",
                f"{time_label}: {estimated_time}",
            ]
        )
        return "\n".join(lines)


if __name__ == "__main__":
    engine = KebeleEngine(retriever=KebeleRetriever(use_exa_backup=False))
    demos = [
        "lost id replacement",
        "hello world",
        'የአድራሻ ምዝገባ',
    ]
    for demo in demos:
        output = engine.process_text(demo)
        print("QUERY:", demo)
        print("MODE:", output["mode"], "CONF:", output["confidence"])
        print(output["message"])
        print("---")
