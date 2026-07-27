"use client";

import { FormEvent, useState } from "react";
import { api } from "@/lib/api-client";
import { amCopy } from "@/lib/copy";

type Turn = {
  id: string;
  role: "user" | "assistant";
  text: string;
  audioUrl?: string;
  sources?: Array<{ chunkId: string; titleAm: string }>;
};

export default function AssistantPage() {
  const copy = amCopy();
  const [text, setText] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api<{
        userTurn: Turn;
        assistantTurn: Turn;
      }>("/api/assistant/ask", {
        method: "POST",
        body: JSON.stringify({ text, speak: true }),
      });
      setTurns((prev) => [...prev, result.userTurn, result.assistantTurn]);
      setText("");
      if (result.assistantTurn.audioUrl) {
        const audio = new Audio(result.assistantTurn.audioUrl);
        void audio.play().catch(() => undefined);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function askMockVoice() {
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("audio", new Blob([new Uint8Array([0, 1, 2])]), "id-renewal.webm");
      form.append("speak", "true");
      const result = await api<{
        userTurn: Turn;
        assistantTurn: Turn;
      }>("/api/assistant/ask", { method: "POST", body: form });
      setTurns((prev) => [...prev, result.userTurn, result.assistantTurn]);
      if (result.assistantTurn.audioUrl) {
        const audio = new Audio(result.assistantTurn.audioUrl);
        void audio.play().catch(() => undefined);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="section section-narrow">
      <div className="page-hero" style={{ paddingLeft: 0, paddingRight: 0 }}>
        <h1 className="am display">{copy.ui.ctaAssistant}</h1>
        <p className="lede">
          Ask in Amharic about ID renewal, residence certificates, and other
          kebele paperwork. Answers are grounded in retrieved procedure text.
        </p>
      </div>

      <div className="stack">
        <div className="chat panel" aria-live="polite">
          {turns.length === 0 && (
            <p className="muted">Type a question or send a mock voice clip to begin.</p>
          )}
          {turns.map((turn) => (
            <div
              key={turn.id}
              className={`bubble am ${turn.role === "user" ? "bubble-user" : "bubble-assistant"}`}
            >
              <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{turn.text}</p>
              {turn.sources && turn.sources.length > 0 && (
                <p className="muted" style={{ margin: "0.6rem 0 0", fontSize: "0.8rem" }}>
                  Sources: {turn.sources.map((s) => s.titleAm).join(" · ")}
                </p>
              )}
            </div>
          ))}
        </div>

        <form className="panel stack" onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="q">Your question</label>
            <textarea
              id="q"
              className="am"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={copy.stt.idRenewal}
            />
          </div>
          <div className="cta-row">
            <button className="btn btn-solid" type="submit" disabled={busy}>
              {busy ? "..." : "Ask"}
            </button>
            <button
              className="btn btn-ghost"
              type="button"
              onClick={askMockVoice}
              disabled={busy}
            >
              Mock voice (STT)
            </button>
          </div>
          {error && <p className="flag">{error}</p>}
        </form>
      </div>
    </div>
  );
}
