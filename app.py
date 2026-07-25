"""Kebele Navigator — Streamlit frontend."""

from __future__ import annotations

import tempfile
from pathlib import Path
from typing import Any

import streamlit as st

from engine import CONFIDENCE_THRESHOLD, KebeleEngine
from retriever import KebeleRetriever

st.set_page_config(
    page_title="Kebele Navigator",
    page_icon="\U0001F399\uFE0F",
    layout="centered",
    initial_sidebar_state="collapsed",
)

AM_SUBHEADER = "\u12e8\u1240\u1260\u120c \u12a0\u1308\u120d\u130d\u120e\u1275 \u1218\u1218\u122a\u12eb \u12a0\u130b\u12e5"
AM_TAGLINE = "\u1260\u12a0\u121b\u122d\u129b \u12c8\u12ed\u121d \u1260\u133d\u1201\u134d \u12e8\u1240\u1260\u120c \u1202\u12f0\u1275 \u12eb\u130d\u1299"
AM_TRANSCRIBED = "\u12e8\u1270\u123d\u1348\u1228 \u133d\u1201\u134d"
AM_CHECKLIST = "\u12e8\u1270\u1228\u130b\u1308\u1320 \u12f0\u122d\u12dd\u1275"
AM_AUDIO = "\u12e8\u12a0\u12f2\u1235 \u12a4\u12a0\u12ed \u12f5\u121d\u1335 \u12cd\u1324\u1275"
AM_VERIFIED = "\u12e8\u1270\u1228\u130b\u1308\u1320 \u12cd\u1324\u1275"
AM_FALLBACK_BADGE = "\u130d\u121d\u1275 \u1270\u12a8\u120d\u12ad\u120f\u120d"
AM_SERVICE = "\u12a0\u1308\u120d\u130d\u120e\u1275"
AM_DOCS = "\u12a0\u1235\u1348\u120b\u130a \u1230\u1290\u12f6\u127d"
AM_FEE = "\u12ad\u134d\u12eb"
AM_TIME = "\u12e8\u121a\u1348\u1305 \u130a\u12dc"
AM_PLACEHOLDER = "\u121d\u1233\u120c\u1361 \u1218\u1273\u12c8\u1242\u12eb \u121b\u12f0\u1235 \u12a5\u1348\u120d\u130b\u1208\u1201"

SAMPLE_QUERIES = {
    "ID Renewal": "ID Renewal",
    "Lost ID": "\u12e8\u1320\u134b \u1218\u1273\u12c8\u1242\u12eb",
    "Vague Query": "I need help with something at the office",
}


def inject_styles() -> None:
    st.markdown(
        """
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Ethiopic:wght@400;600;700&family=Syne:wght@600;700;800&display=swap" rel="stylesheet">
        <style>
          :root {
            --et-green: #078930;
            --et-yellow: #FCDD09;
            --et-red: #DA121A;
            --ink: #14201a;
            --muted: #4a5a50;
            --panel: rgba(255, 252, 246, 0.88);
            --line: rgba(7, 137, 48, 0.18);
          }
          .stApp {
            background:
              radial-gradient(1200px 500px at 10% -10%, rgba(252, 221, 9, 0.28), transparent 55%),
              radial-gradient(900px 420px at 100% 0%, rgba(218, 18, 26, 0.14), transparent 50%),
              linear-gradient(165deg, #f7fbf7 0%, #eef6f0 42%, #f8f3e8 100%);
            color: var(--ink);
            font-family: "Noto Sans Ethiopic", "Syne", sans-serif;
          }
          .block-container { padding-top: 1.4rem; padding-bottom: 3rem; max-width: 820px; }
          h1, h2, h3, .brand-title {
            font-family: "Syne", "Noto Sans Ethiopic", sans-serif !important;
            letter-spacing: -0.02em;
          }
          .flag-bar {
            display: grid; grid-template-columns: 1fr 1fr 1fr; height: 10px;
            border-radius: 999px; overflow: hidden; margin-bottom: 1.1rem;
          }
          .flag-bar span:nth-child(1) { background: var(--et-green); }
          .flag-bar span:nth-child(2) { background: var(--et-yellow); }
          .flag-bar span:nth-child(3) { background: var(--et-red); }
          .hero {
            background: var(--panel); border: 1px solid var(--line); border-radius: 22px;
            padding: 1.35rem 1.4rem 1.2rem; margin-bottom: 1rem; backdrop-filter: blur(6px);
          }
          .brand-title {
            margin: 0; font-size: clamp(1.9rem, 4vw, 2.55rem); font-weight: 800;
            color: var(--ink); line-height: 1.1;
          }
          .brand-am { margin: 0.45rem 0 0; font-size: 1.15rem; font-weight: 700; color: var(--et-green); }
          .brand-tag { margin: 0.35rem 0 0; color: var(--muted); font-size: 0.98rem; max-width: 36rem; }
          .panel {
            background: var(--panel); border: 1px solid var(--line); border-radius: 18px;
            padding: 1rem 1.1rem; margin: 0.75rem 0;
          }
          .badge {
            display: inline-flex; align-items: center; gap: 0.35rem;
            padding: 0.35rem 0.75rem; border-radius: 999px; font-weight: 700;
            font-size: 0.92rem; border: 1px solid transparent; margin-top: 0.55rem;
          }
          .badge-success { background: rgba(7,137,48,0.12); color: #056327; border-color: rgba(7,137,48,0.28); }
          .badge-warn { background: rgba(218,18,26,0.10); color: #9e0d14; border-color: rgba(218,18,26,0.28); }
          .badge-orange { background: rgba(196,120,12,0.14); color: #8a4b00; border-color: rgba(196,120,12,0.3); }
          .fallback-alert {
            border-left: 5px solid var(--et-red); background: rgba(218,18,26,0.08);
            border-radius: 14px; padding: 0.9rem 1rem; margin: 0.8rem 0 1rem;
          }
          .fallback-alert strong { color: #9e0d14; display: block; margin-bottom: 0.25rem; }
          div[data-testid="stButton"] > button {
            border-radius: 12px; border: 1px solid rgba(7,137,48,0.25); font-weight: 700;
          }
          div[data-testid="stButton"] > button[kind="primary"] {
            background: linear-gradient(135deg, #078930, #0a6f2a); border: none;
          }
        </style>
        """,
        unsafe_allow_html=True,
    )


@st.cache_resource
def get_engine() -> KebeleEngine:
    return KebeleEngine(retriever=KebeleRetriever(use_exa_backup=False))


def render_header() -> None:
    st.markdown(
        f"""
        <div class="flag-bar"><span></span><span></span><span></span></div>
        <div class="hero">
          <h1 class="brand-title">\U0001F399\uFE0F Kebele Navigator</h1>
          <p class="brand-am">{AM_SUBHEADER}</p>
          <p class="brand-tag">{AM_TAGLINE}</p>
        </div>
        """,
        unsafe_allow_html=True,
    )


def confidence_badge_html(confidence: float, mode: str) -> str:
    pct = f"{confidence * 100:.0f}%"
    if mode == "verified":
        return (
            f'<span class="badge badge-success">OK Confidence {pct} · {AM_VERIFIED}</span>'
        )
    tone = "badge-orange" if confidence >= 0.45 else "badge-warn"
    return (
        f'<span class="badge {tone}">Fallback Confidence {pct} · {AM_FALLBACK_BADGE}</span>'
    )


def render_checklist(result: dict[str, Any]) -> None:
    requirements = list(result.get("requirements") or [])
    title = result.get("title") or ""
    fee = result.get("fee") or "-"
    estimated_time = result.get("estimated_time") or "-"

    lines = [
        f"### {AM_CHECKLIST}",
        f"**{AM_SERVICE}:** {title}",
        "",
        f"**{AM_DOCS}:**",
    ]
    if requirements:
        for item in requirements:
            lines.append(f"- [x] {item}")
    else:
        lines.append("- [ ] -")
    lines.extend(["", f"**{AM_FEE}:** {fee}", f"**{AM_TIME}:** {estimated_time}"])
    st.markdown("\n".join(lines))


def maybe_speak(engine: KebeleEngine, message: str) -> bytes | None:
    try:
        return engine.speak(message)
    except Exception as exc:  # noqa: BLE001
        st.info(f"Spoken audio unavailable right now: {exc}")
        return None


def run_query(engine: KebeleEngine, text: str, *, transcription: str | None = None) -> None:
    with st.spinner("Processing with Kebele Navigator..."):
        response = engine.process_text(text)
        audio_bytes = maybe_speak(engine, response["message"])
    st.session_state["last_response"] = response
    st.session_state["last_transcription"] = transcription if transcription is not None else text
    st.session_state["last_audio_bytes"] = audio_bytes


def run_audio(engine: KebeleEngine, raw: bytes, suffix: str) -> None:
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(raw)
        tmp_path = Path(tmp.name)
    try:
        with st.spinner("Transcribing Amharic audio..."):
            response = engine.process_audio(tmp_path)
            audio_bytes = maybe_speak(engine, response["message"])
        st.session_state["last_response"] = response
        st.session_state["last_transcription"] = response.get("transcription", "")
        st.session_state["last_audio_bytes"] = audio_bytes
    finally:
        tmp_path.unlink(missing_ok=True)


def render_results() -> None:
    response = st.session_state.get("last_response")
    if not response:
        return

    mode = response.get("mode", "")
    confidence = float(response.get("confidence", 0.0) or 0.0)
    transcription = st.session_state.get("last_transcription", response.get("query", ""))
    result = response.get("result") or {}

    st.markdown("## Process Workflow")

    if mode == "anti_sycophancy":
        st.markdown(
            f"""
            <div class="fallback-alert">
              <strong>Anti-Sycophancy Guardrail Active</strong>
              The system refused to guess. Confidence is below {CONFIDENCE_THRESHOLD:.0%}.
              Please restate a clear kebele service request.
            </div>
            """,
            unsafe_allow_html=True,
        )

    st.markdown('<div class="panel">', unsafe_allow_html=True)
    st.markdown(f"**{AM_TRANSCRIBED}**")
    st.write(transcription or "-")
    st.markdown(confidence_badge_html(confidence, mode), unsafe_allow_html=True)
    st.markdown("</div>", unsafe_allow_html=True)

    if mode == "verified":
        st.markdown('<div class="panel">', unsafe_allow_html=True)
        render_checklist(result)
        st.markdown("</div>", unsafe_allow_html=True)
    else:
        st.warning(response.get("message", ""))

    audio_bytes = st.session_state.get("last_audio_bytes")
    st.markdown(f"**{AM_AUDIO}**")
    if audio_bytes:
        st.audio(audio_bytes, format="audio/wav")
    else:
        st.caption("No spoken audio generated for this response.")


def main() -> None:
    inject_styles()
    render_header()
    engine = get_engine()

    st.markdown("### Quick Test")
    cols = st.columns(3)
    for col, (label, query) in zip(cols, SAMPLE_QUERIES.items()):
        with col:
            if st.button(label, use_container_width=True, key=f"quick_{label}"):
                run_query(engine, query)

    st.markdown("### Ask by Voice or Text")
    tab_text, tab_upload, tab_record = st.tabs(["Type Text", "Upload Audio", "Record Audio"])

    with tab_text:
        text = st.text_area(
            "Amharic or English question",
            placeholder=AM_PLACEHOLDER,
            height=110,
        )
        if st.button("Process Text", type="primary", use_container_width=True):
            if text.strip():
                run_query(engine, text.strip())
            else:
                st.error("Please enter a question first.")

    with tab_upload:
        uploaded = st.file_uploader(
            "Upload .wav or .mp3",
            type=["wav", "mp3"],
            accept_multiple_files=False,
        )
        if st.button("Process Upload", type="primary", use_container_width=True, key="process_upload"):
            if uploaded is None:
                st.error("Please upload an audio file first.")
            else:
                suffix = Path(uploaded.name).suffix.lower() or ".wav"
                run_audio(engine, uploaded.getvalue(), suffix)

    with tab_record:
        recorded = st.audio_input("Record Amharic audio")
        if st.button("Process Recording", type="primary", use_container_width=True, key="process_record"):
            if recorded is None:
                st.error("Please record audio first.")
            else:
                run_audio(engine, recorded.getvalue(), ".wav")

    render_results()

    st.caption(
        f"Guardrail threshold: {CONFIDENCE_THRESHOLD:.0%} · "
        "Verified answers only when confidence is high enough."
    )


if __name__ == "__main__":
    main()
