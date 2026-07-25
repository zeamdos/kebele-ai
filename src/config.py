"""Application configuration loaded from environment variables."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT_DIR / "data"
VERIFIED_KB_PATH = DATA_DIR / "verified_kebele.json"

load_dotenv(ROOT_DIR / ".env")

# Core anti-hallucination rule: never answer below this score.
DEFAULT_CONFIDENCE_THRESHOLD = 0.80


@dataclass(frozen=True)
class Settings:
    addis_api_key: str
    exa_api_key: str
    confidence_threshold: float
    addis_voice_id: str
    verified_kb_path: Path
    language_code: str = "am"

    @property
    def addis_configured(self) -> bool:
        return bool(self.addis_api_key)

    @property
    def exa_configured(self) -> bool:
        return bool(self.exa_api_key)


def get_settings() -> Settings:
    threshold_raw = os.getenv("CONFIDENCE_THRESHOLD", str(DEFAULT_CONFIDENCE_THRESHOLD))
    try:
        threshold = float(threshold_raw)
    except ValueError:
        threshold = DEFAULT_CONFIDENCE_THRESHOLD
    threshold = min(max(threshold, 0.0), 1.0)

    return Settings(
        addis_api_key=os.getenv("ADDIS_API_KEY", "").strip(),
        exa_api_key=os.getenv("EXA_API_KEY", "").strip(),
        confidence_threshold=threshold,
        addis_voice_id=os.getenv("ADDIS_VOICE_ID", "am-hamen").strip() or "am-hamen",
        verified_kb_path=VERIFIED_KB_PATH,
    )
