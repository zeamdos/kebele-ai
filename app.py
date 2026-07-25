"""Kebele Navigator — Streamlit voice-first Amharic civic assistant."""

from __future__ import annotations

import sys
from pathlib import Path

import streamlit as st

ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.config import get_settings
from src.navigator import KebeleNavigator
from src.prompts import CLARIFICATION_FALLBACK_AM, WELCOME_AM

st.set_page_config(
    page_title="Kebele Navigator",
    page_icon="KN",
    layout="centered",
    initial_sidebar_state="collapsed",
)

CUSTOM_CSS = """
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Ethiopic:wght@400;600;700&family=Source+Serif+4:opsz,wght@8..60,600;8..60,700&display=swap');

:root {
  --ink: #1a2e24;
  --leaf: #1f6b4a;
  --leaf-deep: #0f3d2c;
  --amber: #c47b2c;
  --danger: #9b2c2c;
  --ok: #1f6b4a;
}

html, body, [class*="css"] {
  font-family: "Noto Sans Ethiopic", "Source Serif 4", Georgia, serif;
  color: var(--ink);
}

.stApp {
  background:
    radial-gradient(1200px 500px at 10% -10%, #d7ebe0 0%, transparent 55%),
    radial-gradient(900px 420px at 100% 0%, #f0e6d4 0%, transparent 50%),
    linear-gradient(180deg, #f7faf8 0%, #eef5f0 45%, #e7f0ea 100%);
}

.hero {
  padding: 1.4rem 0 0.6rem 0;
  text-align: center;
}
.brand {
  font-family: "Source Serif 4", "Noto Sans Ethiopic", serif;
  font-size: clamp(2.1rem, 5vw, 3rem);
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--leaf-deep);
  margin: 0;
  line-height: 1.15;
}
.tagline {
  margin: 0.55rem auto 0 auto;
  max-width: 34rem;
  font-size: 1.05rem;
  color: #335245;
  line-height: 1.5;
}
.badge-row {
  display: flex;
  gap: 0.6rem;
  justify-content: center;
  flex-wrap: wrap;
  margin-top: 1rem;
}
.badge {
  font-size: 0.78rem;
  padding: 0.28rem 0.7rem;
  border: 1px solid rgba(31, 107, 74, 0.28);
  background: rgba(255,255,255,0.55);
  color: var(--leaf-deep);
}
.panel {
  background: rgba(255,255,255,0.72);
  border: 1px solid rgba(15, 61, 44, 0.12);
  padding: 1.1rem 1.2rem;
  margin-top: 1rem;
}
.panel h3 {
  margin: 0 0 0.55rem 0;
  font-size: 1.05rem;
  color: var(--leaf-deep);
}
.status-ok { color: var(--ok); font-weight: 600; }
.status-block { color: var(--danger); font-weight: 600; }
.am-answer {
  white-space: pre-wrap;
  line-height: 1.75;
  font-size: 1.08rem;
  color: var(--ink);
}
.footer-note {
  text-align: center;
  color: #4d6659;
  font-size: 0.85rem;
  margin-top: 1.5rem;
}
div.stButton > button {
  background: var(--leaf);
  color: white;
  border: none;
  border-radius: 0;
  font-weight: 600;
}
div.stButton > button:hover {
  background: var(--leaf-deep);
  color: white;
}
"""


def _init_state() -> None:
    if "history" not in st.session_state:
        st.session_state.history = []


@st.cache_resource
def get_navigator() -> KebeleNavigator:
    return KebeleNavigator(get_settings())


def render_hero(threshold: float) -> None:
    st.markdown(
        f"""
        <div class="hero">
          <p class="brand">Kebele Navigator</p>
          <p class="tagline">{WELCOME_AM}</p>
          <div class="badge-row">
            <span class="badge">Voice-first · አማርኛ</span>
            <span class="badge">Verified data only</span>
            <span class="badge">Confidence ≥ {threshold:.0%}</span>
          </div>
        </div>
        """,
        unsafe_allow_html=True,
    )


def render_decision(response) -> None:
    decision = response.decision
    if decision.is_clarification:
        st.markdown(
            f'<p class="status-block">ጥያቄ ግልጽ አይደለም · confidence {decision.confidence:.0%} '
            f'(threshold {decision.threshold:.0%})</p>',
            unsafe_allow_html=True,
        )
    else:
        title = decision.service.title_am if decision.service else ""
        st.markdown(
            f'<p class="status-ok">ተረጋገጠ · {title} · confidence {decision.confidence:.0%}</p>',
            unsafe_allow_html=True,
        )

    st.markdown(
        f'<div class="am-answer">{decision.response_text_am}</div>',
        unsafe_allow_html=True,
    )

    if response.speech and response.speech.audio_bytes:
        st.audio(response.speech.audio_bytes, format=response.speech.mime_type)
    elif decision.is_clarification:
        st.caption(
            "Fallback audio uses the fixed Amharic clarification prompt "
            "(no guessed requirements)."
        )

    with st.expander("Diagnostics"):
        st.write(
            {
                "query": response.query_text,
                "confidence": decision.confidence,
                "threshold": decision.threshold,
                "allowed": decision.allowed,
                "reason": decision.reason,
                "match_method": response.match.method,
                "matched_term": response.match.matched_term,
                "service_id": decision.service.id if decision.service else None,
                "exa_snippets": response.exa_snippets,
                "stt_confidence": (
                    response.transcription.confidence if response.transcription else None
                ),
            }
        )


def main() -> None:
    _init_state()
    st.markdown(f"<style>{CUSTOM_CSS}</style>", unsafe_allow_html=True)

    settings = get_settings()
    nav = get_navigator()
    render_hero(settings.confidence_threshold)

    with st.sidebar:
        st.header("Settings")
        st.write(f"Confidence threshold: **{settings.confidence_threshold:.0%}**")
        st.write(
            f"Addis AI: {'configured' if settings.addis_configured else 'missing key'}"
        )
        st.write(
            f"Exa AI: {'configured' if settings.exa_configured else 'missing key'}"
        )
        synthesize = st.toggle(
            "Speak answer (TTS)", value=settings.addis_configured
        )
        st.caption(
            "Answers are blocked below the confidence threshold. "
            "The model never invents kebele requirements."
        )

    tab_voice, tab_text = st.tabs(["Voice", "Text"])
    latest = None

    with tab_voice:
        st.markdown(
            '<div class="panel"><h3>በድምጽ ይጠይቁ</h3></div>',
            unsafe_allow_html=True,
        )
        audio = st.audio_input("Record your Amharic question")
        uploaded = st.file_uploader(
            "Or upload audio", type=["wav", "mp3", "m4a", "webm"]
        )
        source = None
        filename = "query.wav"
        if audio is not None:
            source = audio.getvalue()
            filename = getattr(audio, "name", None) or "recording.wav"
        elif uploaded is not None:
            source = uploaded.getvalue()
            filename = uploaded.name

        if source and st.button("Process voice", type="primary", key="voice_go"):
            if not settings.addis_configured:
                st.error("Set ADDIS_API_KEY in .env to use voice STT/TTS.")
            else:
                with st.spinner("በመስማት እና በመፈተሽ ላይ…"):
                    try:
                        latest = nav.answer_audio(
                            source, filename=filename, synthesize=synthesize
                        )
                        st.session_state.history.insert(0, latest)
                    except Exception as exc:
                        st.error(f"Voice pipeline error: {exc}")

    with tab_text:
        st.markdown(
            '<div class="panel"><h3>በጽሁፍ ይጠይቁ</h3></div>',
            unsafe_allow_html=True,
        )
        query = st.text_input(
            "ጥያቄዎ",
            placeholder="ለምሳሌ፦ የቀበሌ መታወቂያ ለማደስ ምን ያስፈልጋል?",
        )
        if st.button("Ask", type="primary", key="text_go") and query.strip():
            with st.spinner("በመፈተሽ ላይ…"):
                latest = nav.answer_text(
                    query.strip(),
                    synthesize=synthesize and settings.addis_configured,
                )
                st.session_state.history.insert(0, latest)

    if latest is None and st.session_state.history:
        latest = st.session_state.history[0]
    if latest is not None:
        st.markdown("### Answer")
        render_decision(latest)

    st.markdown(
        f'<p class="footer-note">Anti-sycophancy guardrail active. '
        f'Below {settings.confidence_threshold:.0%} confidence → '
        f'clarification only.<br/>“{CLARIFICATION_FALLBACK_AM[:48]}…”</p>',
        unsafe_allow_html=True,
    )


if __name__ == "__main__":
    main()
