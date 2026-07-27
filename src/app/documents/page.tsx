"use client";

import { FormEvent, useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { amCopy } from "@/lib/copy";
import type { DocumentReading } from "@/lib/types";

export default function DocumentsPage() {
  const copy = amCopy();
  const [docs, setDocs] = useState<DocumentReading[]>([]);
  const [active, setActive] = useState<DocumentReading | null>(null);
  const [corrected, setCorrected] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const list = await api<DocumentReading[]>("/api/documents");
    setDocs(list);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await api<DocumentReading[]>("/api/documents");
        if (!cancelled) setDocs(list);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const fileInput = formEl.elements.namedItem("file") as HTMLInputElement;
    const file = fileInput.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const doc = await api<DocumentReading>("/api/documents", {
        method: "POST",
        body,
      });
      setActive(doc);
      setCorrected(doc.correctedText || doc.ocrText);
      await refresh();
      formEl.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveCorrection() {
    if (!active) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await api<DocumentReading>(`/api/documents/${active.id}`, {
        method: "PATCH",
        body: JSON.stringify({ correctedText: corrected }),
      });
      setActive(updated);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="section section-narrow">
      <div className="page-hero" style={{ paddingLeft: 0, paddingRight: 0 }}>
        <h1 className="am display">{copy.ui.ctaReader}</h1>
        <p className="lede">
          Upload a photo or PDF. We OCR it, summarize in plain Amharic, and let
          you correct the text before e-form autofill uses it.
        </p>
      </div>

      <div className="stack">
        <form className="panel stack" onSubmit={onUpload}>
          <div className="field">
            <label htmlFor="file">Photo / PDF</label>
            <input id="file" name="file" type="file" accept="image/*,application/pdf" required />
          </div>
          <button className="btn btn-solid" type="submit" disabled={busy}>
            {busy ? "Reading..." : "Read document"}
          </button>
        </form>

        {active && (
          <div className="panel stack">
            <div>
              <p className="status-pill">{active.documentKind}</p>
              <h2 className="am display" style={{ fontSize: "1.5rem", margin: "0.4rem 0" }}>
                Summary
              </h2>
              <p className="am" style={{ margin: 0 }}>
                {active.summaryAm}
              </p>
            </div>

            {active.actionableFlags.length > 0 && (
              <div className="stack">
                {active.actionableFlags.map((flag) => (
                  <div key={flag} className="flag am">
                    {flag}
                  </div>
                ))}
              </div>
            )}

            {Object.keys(active.extractedFields).length > 0 && (
              <div>
                <h3 style={{ margin: "0 0 0.5rem", fontSize: "1rem" }}>Extracted fields</h3>
                <ul className="am" style={{ margin: 0, paddingLeft: "1.1rem" }}>
                  {Object.entries(active.extractedFields).map(([key, value]) => (
                    <li key={key}>
                      <strong>{key}</strong>: {value}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="field">
              <label htmlFor="ocr">Extracted text (edit before autofill)</label>
              <textarea
                id="ocr"
                className="am"
                value={corrected}
                onChange={(e) => setCorrected(e.target.value)}
              />
            </div>
            <button className="btn btn-ghost" type="button" onClick={saveCorrection} disabled={busy}>
              Save corrections &amp; re-analyze
            </button>
          </div>
        )}

        {docs.length > 0 && (
          <div className="panel stack">
            <h2 className="display" style={{ fontSize: "1.35rem", margin: 0 }}>
              Recent readings
            </h2>
            {docs.map((doc) => (
              <button
                key={doc.id}
                type="button"
                className="btn btn-ghost"
                style={{ justifyContent: "flex-start" }}
                onClick={() => {
                  setActive(doc);
                  setCorrected(doc.correctedText || doc.ocrText);
                }}
              >
                {doc.fileName} · {doc.documentKind}
              </button>
            ))}
          </div>
        )}

        {error && <p className="flag">{error}</p>}
      </div>
    </div>
  );
}
