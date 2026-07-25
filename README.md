# Kebele Navigator

Voice-first Amharic civic AI assistant for Ethiopian kebele service requirements.

**Core rule:** the assistant never guesses kebele requirements. Queries are matched only against verified data. If confidence is below **0.80**, it returns an explicit Amharic clarification audio/text prompt instead of inventing an answer.

## Stack

- Python 3.10+
- [Streamlit](https://streamlit.io/) UI
- [Addis AI](https://platform.addisassistant.com/) STT / TTS (`addisai`)
- [Exa AI](https://exa.ai/) optional corroborating retriever (`exa-py`)
- `python-dotenv`, `rapidfuzz`

## Pipeline

```
Voice / text query
    → Addis STT (Amharic)
    → Verified kebele KB match (+ optional Exa snippets)
    → Confidence guardrail (threshold 0.80)
         ├─ ≥ 0.80 → verified requirements only + Addis TTS
         └─ < 0.80 → Amharic clarification fallback + Addis TTS
```

## Setup

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# edit .env with ADDIS_API_KEY and EXA_API_KEY
```

### Environment

| Variable | Required | Description |
|---|---|---|
| `ADDIS_API_KEY` | for voice | Addis AI key for STT/TTS |
| `EXA_API_KEY` | optional | Exa search for corroborating snippets |
| `CONFIDENCE_THRESHOLD` | no | Default `0.80` |
| `ADDIS_VOICE_ID` | no | Default `am-hamen` |

## Run

```bash
streamlit run app.py
```

Text mode works without API keys (local verified matching + guardrail). Voice STT/TTS requires `ADDIS_API_KEY`.

## Verified data

Requirements live in [`data/verified_kebele.json`](data/verified_kebele.json). The navigator answers **only** from this file. Exa may attach corroborating web snippets after a verified match clears the threshold; it never supplies unverified requirements.

## Guardrail fallback (Amharic)

When confidence < 0.80:

> ይቅርታ፣ ጥያቄዎን በትክክል አልገባኝም። እባክዎ የትኛውን የቀበሌ አገልግሎት እንደሚፈልጉ በግልጽ ይንገሩኝ። ለምሳሌ፦ መታወቂያ፣ የትዳር ምስክር ወረቀት፣ ወይም የመኖሪያ ማረጋገጫ።

## Tests

```bash
pytest -q
```

## Project layout

```
app.py                 # Streamlit UI
src/
  config.py            # env + 0.80 threshold
  addis_client.py      # STT / TTS
  retriever.py         # verified KB + Exa
  guardrail.py         # anti-sycophancy gate
  navigator.py         # orchestration
  prompts.py           # Amharic fallback copy
data/verified_kebele.json
tests/test_guardrail.py
```
