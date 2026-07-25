"""Configuration for Kebele Navigator.

Loads values from environment variables / `.env`, with Streamlit Cloud
`st.secrets` as a fallback for one-click deployments.
"""

from __future__ import annotations

import os
from typing import Any

from dotenv import load_dotenv

load_dotenv()


def _from_streamlit_secrets(name: str) -> str | None:
    """Read a secret from Streamlit Cloud / local `.streamlit/secrets.toml`."""
    try:
        import streamlit as st
    except Exception:
        return None

    try:
        secrets: Any = st.secrets
        if name in secrets:
            value = secrets[name]
            if value is None:
                return None
            return str(value)
    except Exception:
        return None
    return None


def get_setting(name: str, default: str = "") -> str:
    """Resolve a setting from env first, then Streamlit secrets."""
    env_value = os.getenv(name)
    if env_value is not None and env_value != "":
        return env_value

    secret_value = _from_streamlit_secrets(name)
    if secret_value is not None and secret_value != "":
        return secret_value

    return default


# API keys — empty string fallback so the app can start without secrets
ADDIS_AI_API_KEY: str = get_setting("ADDIS_AI_API_KEY", "")
EXA_API_KEY: str = get_setting("EXA_API_KEY", "")

# App metadata
APP_NAME: str = get_setting("APP_NAME", "Kebele Navigator")
APP_ENV: str = get_setting("APP_ENV", "development")
