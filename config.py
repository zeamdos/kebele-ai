"""Configuration for Kebele Navigator.

Loads environment variables from a .env file (if present) via python-dotenv,
with sensible fallback defaults when keys are unset.
"""

from __future__ import annotations

import os

from dotenv import load_dotenv

load_dotenv()

# API keys — empty string fallback so the app can start without secrets
ADDIS_AI_API_KEY: str = os.getenv("ADDIS_AI_API_KEY", "")
EXA_API_KEY: str = os.getenv("EXA_API_KEY", "")

# App metadata
APP_NAME: str = os.getenv("APP_NAME", "Kebele Navigator")
APP_ENV: str = os.getenv("APP_ENV", "development")
