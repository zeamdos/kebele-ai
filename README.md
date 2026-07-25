# Kebele Navigator

Python application for navigating kebele-related information.

## Setup

1. Create and activate a virtual environment:

```bash
python3 -m venv .venv
source .venv/bin/activate
```

2. Install dependencies:

```bash
pip install -r requirements.txt
```

3. Configure environment variables:

```bash
cp .env.example .env
# Edit .env and add your API keys
```

## Configuration

`config.py` loads values from `.env` via `python-dotenv`, with fallback defaults when variables are unset.
