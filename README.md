# Kebele Navigator

Amharic-first guide for Ethiopian kebele services. Ask by text or voice, get a verified checklist when confidence is high, and fall back to clarification instead of guessing.

## Local setup

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env and add your API keys
streamlit run app.py
```

`.env` keys:

```bash
ADDIS_AI_API_KEY=your_key_here
EXA_API_KEY=your_key_here
```

`config.py` loads values from `.env` / environment variables, with Streamlit Secrets as a fallback.

## Deploy on Streamlit Community Cloud (free, one-click)

1. Push this repository to GitHub.
2. Open [Share.streamlit.io](https://share.streamlit.io/) and sign in with GitHub.
3. Click **New app**, select this repo, set:
   - **Main file path:** `app.py`
   - **Python version:** 3.11+ recommended
4. Before (or after) deploy, open **Advanced settings → Secrets** and paste:

```toml
ADDIS_AI_API_KEY = "your_addis_ai_api_key"
EXA_API_KEY = "your_exa_api_key"
```

5. Click **Deploy**. Streamlit Cloud installs `requirements.txt` and serves the app.

Notes:

- Do not commit real API keys to Git. Use Streamlit Secrets or platform env vars.
- Quick Test buttons work without keys; live STT/TTS/Exa need valid secrets.
- Theme and telemetry are controlled by `.streamlit/config.toml` (dark theme, usage stats off).

## Deploy with Docker / Render

### Docker (local or any host)

```bash
docker build -t kebele-navigator .
docker run --rm -p 8501:8501 \
  -e ADDIS_AI_API_KEY="your_addis_ai_api_key" \
  -e EXA_API_KEY="your_exa_api_key" \
  kebele-navigator
```

App URL: `http://localhost:8501`

### Render

1. Create a new **Web Service** from this GitHub repo.
2. Choose **Docker** as the runtime (uses the included `Dockerfile`).
3. Set env vars:
   - `ADDIS_AI_API_KEY`
   - `EXA_API_KEY`
4. Ensure the service exposes port **8501**.
5. Deploy.

The container runs:

```bash
streamlit run app.py --server.port=8501 --server.address=0.0.0.0
```

## App features

- Quick Test buttons: ID Renewal, Lost ID, Vague Query
- Text, `.wav`/`.mp3` upload, and browser audio recording
- Confidence badge + verified Amharic checklist
- Anti-sycophancy fallback when confidence &lt; 0.75
- Optional Addis AI spoken response playback
