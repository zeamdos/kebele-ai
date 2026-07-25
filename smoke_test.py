"""End-to-end smoke tests for Kebele Navigator."""

from __future__ import annotations

import struct
import traceback
import wave
from io import BytesIO
from pathlib import Path

from engine import ANTI_SYCOPHANCY_FALLBACK, CONFIDENCE_THRESHOLD, KebeleEngine
from models import ProcessResult
from retriever import KebeleRetriever
from voice import MOCK_TRANSCRIPTION, AddisAIVoicePipeline


def _assert(cond: bool, msg: str) -> None:
    if not cond:
        raise AssertionError(msg)


def test_core() -> None:
    _assert(CONFIDENCE_THRESHOLD == 0.75, "threshold")
    engine = KebeleEngine(retriever=KebeleRetriever(use_exa_backup=False))

    verified_queries = [
        "ID Renewal",
        "Lost ID",
        "Address Registration",
        "\u1218\u1273\u12c8\u1242\u12eb \u121b\u12f0\u1235",  # metaweqiya mades
        "\u12e8\u1320\u134b \u1218\u1273\u12c8\u1242\u12eb",  # yetefa metaweqiya
        "\u12e8\u12a0\u12f5\u122b\u123b \u121d\u12dd\u1308\u1263",  # address registration
        MOCK_TRANSCRIPTION,
    ]
    for query in verified_queries:
        out = engine.process_text(query)
        _assert(out["mode"] == "verified", f"expected verified for {query!r}: {out}")
        _assert(out["confidence"] >= 0.75, f"low confidence for {query!r}: {out}")
        _assert(out["result"].get("requirements"), f"missing requirements for {query!r}")
        _assert("\u12a0\u1235\u1348\u120b\u130a" in out["message"] or "1." in out["message"], "checklist")

    vague = engine.process_text("asdf qwerty unrelated nonsense xyz")
    _assert(vague["mode"] == "anti_sycophancy", vague)
    _assert(vague["message"] == ANTI_SYCOPHANCY_FALLBACK, "fallback text mismatch")

    audio = engine.process_audio("missing.wav")
    _assert(audio["transcription"] == MOCK_TRANSCRIPTION, audio)
    _assert(audio["mode"] == "verified", audio)

    result = KebeleRetriever(use_exa_backup=False).retrieve("ID Renewal")
    ProcessResult.model_validate(result)
    for key in ("status", "confidence", "title", "requirements", "estimated_time", "fee"):
        _assert(key in result, f"missing key {key}")


def test_voice_fallbacks() -> None:
    voice = AddisAIVoicePipeline(api_key="")
    text = voice.transcribe_audio("missing.wav")
    _assert(text == MOCK_TRANSCRIPTION, text)

    demo_audio = voice.text_to_speech("\u1230\u120b\u121d")
    _assert(demo_audio[:4] == b"RIFF", "demo TTS should return WAV bytes")
    _assert(len(demo_audio) > 500, "demo WAV too small")

    try:
        voice.text_to_speech("\u1230\u120b\u121d", allow_demo_fallback=False)
        raise AssertionError("TTS should fail without API key when fallback disabled")
    except ValueError:
        pass


def test_files() -> None:
    required = [
        "app.py",
        "engine.py",
        "voice.py",
        "retriever.py",
        "database.json",
        "config.py",
        "models.py",
        "Dockerfile",
        ".streamlit/config.toml",
        "requirements.txt",
        ".env.example",
        "README.md",
    ]
    for path in required:
        _assert(Path(path).exists(), f"missing {path}")


def make_silent_wav(duration_ms: int = 400, rate: int = 16000) -> bytes:
    """Tiny valid WAV used as local TTS fallback for demos."""
    n_frames = int(rate * duration_ms / 1000)
    buf = BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(rate)
        silence = struct.pack("<h", 0)
        wf.writeframes(silence * n_frames)
    return buf.getvalue()


if __name__ == "__main__":
    failures = 0
    for name, fn in [
        ("files", test_files),
        ("core", test_core),
        ("voice_fallbacks", test_voice_fallbacks),
    ]:
        try:
            fn()
            print(f"PASS {name}")
        except Exception as exc:  # noqa: BLE001
            failures += 1
            print(f"FAIL {name}: {exc}")
            traceback.print_exc()
    if failures:
        raise SystemExit(1)
    print("ALL SMOKE TESTS PASSED")
