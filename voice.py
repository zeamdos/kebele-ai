"""Amharic speech pipeline via the Addis AI STT/TTS APIs."""

from __future__ import annotations

import base64
import math
import struct
import wave
from io import BytesIO
import binascii
import json
import logging
import mimetypes
from pathlib import Path
from typing import Any

import requests

from config import get_setting

logger = logging.getLogger(__name__)

STT_URL = "https://api.addisassistant.com/api/v2/stt"
TTS_URL = "https://platform.addisassistant.com/api/audio"
TTS_MODEL = "\u12a0\u120c\u134d-Audio-AM"
DEFAULT_LANGUAGE = "am"
REQUEST_TIMEOUT_SECONDS = 60

# Safe fallback used when the API key is missing/invalid or the STT request fails.
MOCK_TRANSCRIPTION = "\u1218\u1273\u12c8\u1242\u12eb \u121b\u12f0\u1235"



def build_demo_wav(duration_sec: float = 1.2, rate: int = 16000, freq: float = 440.0) -> bytes:
    """Generate a short valid WAV tone for offline/demo TTS fallback."""
    n_frames = int(rate * duration_sec)
    buf = BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(rate)
        frames = bytearray()
        for i in range(n_frames):
            # Fade in/out soft beep so demos are audible without being harsh.
            envelope = 1.0
            fade = int(rate * 0.05)
            if i < fade:
                envelope = i / max(fade, 1)
            elif i > n_frames - fade:
                envelope = (n_frames - i) / max(fade, 1)
            sample = int(12000 * envelope * math.sin(2 * math.pi * freq * (i / rate)))
            frames += struct.pack("<h", sample)
        wf.writeframes(bytes(frames))
    return buf.getvalue()


class AddisAIVoicePipeline:
    """Speech-to-text and text-to-speech helpers backed by Addis AI."""

    def __init__(self, api_key: str | None = None, timeout: int = REQUEST_TIMEOUT_SECONDS) -> None:
        self.api_key = api_key if api_key is not None else get_setting("ADDIS_AI_API_KEY", "")
        self.timeout = timeout

    def _auth_headers(self) -> dict[str, str]:
        return {
            "x-api-key": self.api_key,
            "X-API-Key": self.api_key,
        }

    def _has_usable_api_key(self) -> bool:
        key = (self.api_key or "").strip()
        if not key:
            return False
        if key in {"your_key_here", "YOUR_API_KEY", "changeme"}:
            return False
        return True

    def transcribe_audio(self, audio_file_path: str | Path) -> str:
        """
        Transcribe an Amharic audio file via Addis AI STT.

        On missing/invalid API key or request failure, returns a safe mock
        transcription so local testing can continue.
        """
        path = Path(audio_file_path)
        if not self._has_usable_api_key():
            logger.warning("ADDIS_AI_API_KEY missing/invalid; returning mock transcription.")
            return MOCK_TRANSCRIPTION

        if not path.is_file():
            logger.warning("Audio file not found at %s; returning mock transcription.", path)
            return MOCK_TRANSCRIPTION

        mime_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        request_data = json.dumps({"language_code": DEFAULT_LANGUAGE})

        try:
            with path.open("rb") as audio_handle:
                files = {
                    "audio": (path.name, audio_handle, mime_type),
                }
                data = {
                    "request_data": request_data,
                }
                response = requests.post(
                    STT_URL,
                    headers=self._auth_headers(),
                    files=files,
                    data=data,
                    timeout=self.timeout,
                )

            if response.status_code in {401, 403}:
                logger.warning(
                    "Addis AI STT rejected API key (HTTP %s); returning mock transcription.",
                    response.status_code,
                )
                return MOCK_TRANSCRIPTION

            response.raise_for_status()
            transcription = self._extract_transcription(response)
            if transcription:
                return transcription

            logger.warning("Addis AI STT returned an empty transcription; using mock fallback.")
            return MOCK_TRANSCRIPTION
        except (requests.RequestException, ValueError, KeyError, TypeError) as exc:
            logger.warning("Addis AI STT failed (%s); returning mock transcription.", exc)
            return MOCK_TRANSCRIPTION

    def _extract_transcription(self, response: requests.Response) -> str:
        payload: Any
        try:
            payload = response.json()
        except ValueError:
            text = (response.text or "").strip()
            return text

        if isinstance(payload, str):
            return payload.strip()

        if not isinstance(payload, dict):
            return ""

        # Common Addis AI response shapes
        data = payload.get("data")
        if isinstance(data, dict):
            for key in ("transcription", "text", "transcript"):
                value = data.get(key)
                if isinstance(value, str) and value.strip():
                    return value.strip()

        for key in ("transcription", "text", "transcript"):
            value = payload.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()

        return ""

    def text_to_speech(self, text_amharic: str, *, allow_demo_fallback: bool = True) -> bytes:
        """Convert Amharic text to speech via Addis AI TTS.

        Uses model አሌፍ-Audio-AM and returns raw audio bytes.
        When the API key is missing/invalid or the request fails, returns a
        short local demo WAV so the UI still works offline.
        """
        if not isinstance(text_amharic, str) or not text_amharic.strip():
            raise ValueError("text_amharic must be a non-empty string")

        if not self._has_usable_api_key():
            logger.warning("ADDIS_AI_API_KEY missing/invalid; returning demo WAV.")
            if allow_demo_fallback:
                return build_demo_wav()
            raise ValueError("ADDIS_AI_API_KEY is missing or invalid")

        payload = {
            "text": text_amharic,
            "language": DEFAULT_LANGUAGE,
            "model": TTS_MODEL,
            "stream": False,
        }

        try:
            response = requests.post(
                TTS_URL,
                headers={
                    **self._auth_headers(),
                    "Content-Type": "application/json",
                    "Accept": "audio/wav, audio/mpeg, application/json",
                },
                json=payload,
                timeout=self.timeout,
            )
            if response.status_code in {401, 403}:
                logger.warning("Addis AI TTS rejected API key; returning demo WAV.")
                if allow_demo_fallback:
                    return build_demo_wav()
                response.raise_for_status()
            response.raise_for_status()
            return self._extract_audio_bytes(response)
        except (requests.RequestException, ValueError, RuntimeError) as exc:
            logger.warning("Addis AI TTS failed (%s); returning demo WAV.", exc)
            if allow_demo_fallback:
                return build_demo_wav()
            raise

    def _extract_audio_bytes(self, response: requests.Response) -> bytes:
        content_type = (response.headers.get("Content-Type") or "").lower()

        # Direct binary audio response
        if content_type.startswith("audio/") or content_type.startswith("application/octet-stream"):
            if response.content:
                return response.content

        # JSON responses may wrap base64 / data-URI audio
        try:
            payload = response.json()
        except ValueError:
            if response.content:
                return response.content
            raise RuntimeError("Addis AI TTS returned an empty audio response")

        if isinstance(payload, dict):
            audio_value = payload.get("audio") or payload.get("data") or payload.get("url")
            if isinstance(audio_value, dict):
                audio_value = (
                    audio_value.get("audio")
                    or audio_value.get("content")
                    or audio_value.get("url")
                )
            if isinstance(audio_value, str) and audio_value.strip():
                return self._decode_audio_payload(audio_value.strip())

        if response.content:
            return response.content

        raise RuntimeError("Addis AI TTS response did not include audio bytes")

    def _decode_audio_payload(self, audio_value: str) -> bytes:
        value = audio_value.strip()

        if value.startswith("data:") and "," in value:
            _, encoded = value.split(",", 1)
            return base64.b64decode(encoded)

        # Raw base64 without data-URI prefix
        try:
            decoded = base64.b64decode(value, validate=True)
            if decoded:
                return decoded
        except (binascii.Error, ValueError):
            pass

        # As a last resort treat the string as already-binary latin-1 text
        return value.encode("utf-8")


if __name__ == "__main__":
    pipeline = AddisAIVoicePipeline()
    print("API key configured:", pipeline._has_usable_api_key())
    print("Mock STT fallback:", pipeline.transcribe_audio("missing.wav"))
