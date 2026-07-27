# Kebele Navigator

Voice-first Amharic assistant for Ethiopian kebele paperwork — plus a free document reader, paid e-form filler, and paid errand hiring.

## Stack

| Concern | Provider | Default |
|---|---|---|
| LLM | Addis AI | Mock |
| STT | Whisperflow | Mock |
| TTS | ElevenLabs | Mock |
| OCR | Google Cloud Vision (+ Tesseract `amh` fallback) | Mock |
| Payments | Telebirr | Mock checkout |
| SMS | Africa's Talking | Mock log |
| DB / Auth / Storage | Supabase (schema included) | Local JSON + filesystem |

Every integration sits behind **one function** that returns a hardcoded response unless `USE_REAL_APIS=true` (or a per-provider `USE_REAL_*` flag) **and** credentials are present. Missing keys never crash the app — they keep that provider in mock mode.

## Features

1. **Voice assistant (free)** — Whisperflow → Addis AI + RAG → ElevenLabs. Answers are grounded on `src/lib/rag/knowledge.json` (ID renewal, residence certificate, birth/marriage certs, name correction, fees).
2. **Document reader (free)** — upload photo/PDF → sharp preprocess → OCR → Addis AI classify/summarize in Amharic → editable extracted text for downstream autofill.
3. **E-form filler (paid)** — 5 guided forms, voice/text field help, autofill from document reader, Telebirr paywall, print-ready PDF via `pdf-lib` + Noto Sans Ethiopic.
4. **Errand hiring (paid)** — post task → vetted runner pool → accept / in progress / done → Telebirr escrow capture on user confirm → SMS pings.

## Quick start

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Demo users (header `x-user-id`):

- `user_demo_citizen` (default)
- `user_demo_runner`

## Scripts

```bash
npm run dev      # Next.js dev server
npm run build    # production build
npm run test     # vitest (providers + RAG + e2e mock flows)
npm run lint     # eslint
```

## Going live

1. Fill keys in `.env.local` from `.env.example`.
2. Apply `supabase/schema.sql` and create storage bucket `kebele-files`.
3. Set `USE_REAL_APIS=true` (or flip individual `USE_REAL_*` flags).
4. Restart the server — no code changes required.

## Build order shipped

1. Document reader  
2. E-form filler (generate-and-print)  
3. Telebirr paywall / escrow  
4. Errand hiring  

Voice assistant is included end-to-end for the demo services above.
