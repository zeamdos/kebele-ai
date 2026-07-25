"""Addis AI STT / TTS client wrappers for Amharic voice I/O."""

from __future__ import annotations

import io
import logging
import tempfile
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import BinaryIO, Optional, Union

import requests

from src.config import Settings

logger = logging.getLogger(__name__)

AudioInput = Union[bytes, BinaryIO, Path, str]


@dataclass
class TranscriptionResult:
    text: str
    confidence: Optional[float] = None
    raw: Optional[dict] = None


@dataclass
class SpeechResult:
    audio_bytes: bytes
    mime_type: str
    audio_url: Optional[str] = None
    clip_id: Optional[str] = None


class AddisClient:
    """Thin wrapper around the official addisai SDK with REST fallbacks."""

    BASE_URL = "https://api.addisassistant.com"

    def __init__(self, settings: Settings):
        self.settings = settings
        self._sdk = None
        if settings.addis_api_key:
            try:
                from addisai import AddisAI

                self._sdk = AddisAI(api_key=settings.addis_api_key)
            except Exception as exc:  # pragma: no cover - SDK optional at import time
                logger.warning("addisai SDK unavailable, using REST: %s", exc)

    def transcribe(self, audio: AudioInput, language: str = "am") -> TranscriptionResult:
        if not self.settings.addis_api_key:
            raise RuntimeError("ADDIS_API_KEY is not configured.")

        audio_bytes, filename = _coerce_audio(audio)

        if self._sdk is not None:
            try:
                buffer = io.BytesIO(audio_bytes)
                buffer.name = filename
                result = self._sdk.speech.transcribe(audio=buffer, language=language)
                text = _extract_transcription_text(result)
                confidence = _extract_confidence(result)
                return TranscriptionResult(text=text, confidence=confidence, raw=_as_dict(result))
            except Exception as exc:
                logger.warning("SDK STT failed, falling back to REST: %s", exc)

        return self._transcribe_rest(audio_bytes, filename, language)

    def synthesize(
        self,
        text: str,
        *,
        voice_id: Optional[str] = None,
        language: str = "am",
        output_format: str = "mp3_44100",
    ) -> SpeechResult:
        if not self.settings.addis_api_key:
            raise RuntimeError("ADDIS_API_KEY is not configured.")
        if not text or not text.strip():
            raise ValueError("TTS text must be non-empty.")

        voice = voice_id or self.settings.addis_voice_id

        if self._sdk is not None:
            try:
                clip = self._sdk.voice.generate(
                    text=text.strip(),
                    voice_id=voice,
                    language=language,
                    output_format=output_format,
                    client_request_id=str(uuid.uuid4()),
                )
                audio_bytes = _clip_to_bytes(clip)
                mime = "audio/mpeg" if "mp3" in output_format else "audio/wav"
                return SpeechResult(
                    audio_bytes=audio_bytes,
                    mime_type=mime,
                    audio_url=getattr(clip, "audio_url", None) or _get(clip, "audio_url"),
                    clip_id=getattr(clip, "id", None) or _get(clip, "id"),
                )
            except Exception as exc:
                logger.warning("SDK TTS failed, falling back to REST: %s", exc)

        return self._synthesize_rest(text.strip(), voice, language, output_format)

    def _transcribe_rest(
        self, audio_bytes: bytes, filename: str, language: str
    ) -> TranscriptionResult:
        url = f"{self.BASE_URL}/api/v2/stt"
        files = {"audio": (filename, audio_bytes, _guess_mime(filename))}
        data = {"request_data": f'{{"language_code": "{language}"}}'}
        response = requests.post(
            url,
            headers={"x-api-key": self.settings.addis_api_key},
            files=files,
            data=data,
            timeout=90,
        )
        response.raise_for_status()
        payload = response.json()
        text = _extract_transcription_text(payload)
        confidence = _extract_confidence(payload)
        return TranscriptionResult(text=text, confidence=confidence, raw=payload)

    def _synthesize_rest(
        self, text: str, voice_id: str, language: str, output_format: str
    ) -> SpeechResult:
        url = f"{self.BASE_URL}/api/v1/voice/generations"
        payload = {
            "text": text,
            "voice_id": voice_id,
            "language": language,
            "output_format": output_format,
            "client_request_id": str(uuid.uuid4()),
        }
        response = requests.post(
            url,
            headers={
                "x-api-key": self.settings.addis_api_key,
                "content-type": "application/json",
            },
            json=payload,
            timeout=120,
        )
        response.raise_for_status()
        body = response.json()
        data = body.get("data", body)
        audio_url = data.get("audio_url") or data.get("audioUrl")
        clip_id = data.get("id")
        audio_bytes = b""

        if isinstance(data.get("audio"), str) and data["audio"].startswith("data:"):
            import base64

            encoded = data["audio"].split(",", 1)[-1]
            audio_bytes = base64.b64decode(encoded)
        elif audio_url:
            audio_resp = requests.get(audio_url, timeout=90)
            audio_resp.raise_for_status()
            audio_bytes = audio_resp.content

        if not audio_bytes:
            raise RuntimeError("Addis TTS returned no audio content.")

        mime = "audio/mpeg" if "mp3" in output_format else "audio/wav"
        return SpeechResult(
            audio_bytes=audio_bytes,
            mime_type=mime,
            audio_url=audio_url,
            clip_id=clip_id,
        )


def save_temp_audio(audio_bytes: bytes, suffix: str = ".mp3") -> Path:
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    tmp.write(audio_bytes)
    tmp.flush()
    tmp.close()
    return Path(tmp.name)


def _coerce_audio(audio: AudioInput) -> tuple[bytes, str]:
    if isinstance(audio, (bytes, bytearray)):
        return bytes(audio), "audio.wav"
    if isinstance(audio, Path):
        return audio.read_bytes(), audio.name
    if isinstance(audio, str):
        path = Path(audio)
        return path.read_bytes(), path.name
    # file-like
    data = audio.read()
    name = getattr(audio, "name", "audio.wav")
    return data, Path(str(name)).name or "audio.wav"


def _guess_mime(filename: str) -> str:
    lower = filename.lower()
    if lower.endswith(".mp3"):
        return "audio/mpeg"
    if lower.endswith(".webm"):
        return "audio/webm"
    if lower.endswith(".m4a"):
        return "audio/mp4"
    return "audio/wav"


def _as_dict(value) -> Optional[dict]:
    if isinstance(value, dict):
        return value
    if hasattr(value, "model_dump"):
        return value.model_dump()
    if hasattr(value, "__dict__"):
        return dict(value.__dict__)
    return None


def _get(obj, key: str):
    if isinstance(obj, dict):
        return obj.get(key)
    return None


def _extract_transcription_text(result) -> str:
    if isinstance(result, str):
        return result.strip()
    if isinstance(result, dict):
        if result.get("text"):
            return str(result["text"]).strip()
        data = result.get("data") or {}
        if isinstance(data, dict) and data.get("transcription"):
            return str(data["transcription"]).strip()
        if result.get("transcription"):
            return str(result["transcription"]).strip()
    text = getattr(result, "text", None)
    if text:
        return str(text).strip()
    return ""


def _extract_confidence(result) -> Optional[float]:
    if isinstance(result, dict):
        if "confidence" in result and result["confidence"] is not None:
            try:
                return float(result["confidence"])
            except (TypeError, ValueError):
                return None
    confidence = getattr(result, "confidence", None)
    if confidence is not None:
        try:
            return float(confidence)
        except (TypeError, ValueError):
            return None
    return None


def _clip_to_bytes(clip) -> bytes:
    if hasattr(clip, "content") and callable(clip.content):
        data = clip.content()
        if isinstance(data, (bytes, bytearray)):
            return bytes(data)
    audio_url = getattr(clip, "audio_url", None) or _get(clip, "audio_url")
    if audio_url:
        resp = requests.get(audio_url, timeout=90)
        resp.raise_for_status()
        return resp.content
    if hasattr(clip, "to_file"):
        path = save_temp_audio(b"", suffix=".mp3")
        path.unlink(missing_ok=True)
        path = Path(tempfile.mkstemp(suffix=".mp3")[1])
        clip.to_file(str(path))
        data = path.read_bytes()
        path.unlink(missing_ok=True)
        if data:
            return data
    raise RuntimeError("Unable to extract audio bytes from Addis clip.")
