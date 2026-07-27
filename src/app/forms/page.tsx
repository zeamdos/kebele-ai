"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api-client";
import { amCopy } from "@/lib/copy";
import type {
  DocumentReading,
  FormFillSession,
  FormTemplate,
  PaymentRecord,
} from "@/lib/types";

export default function FormsPage() {
  const copy = amCopy();
  const [templates, setTemplates] = useState<FormTemplate[]>([]);
  const [docs, setDocs] = useState<DocumentReading[]>([]);
  const [session, setSession] = useState<FormFillSession | null>(null);
  const [template, setTemplate] = useState<FormTemplate | null>(null);
  const [sourceDocId, setSourceDocId] = useState("");
  const [value, setValue] = useState("");
  const [explanation, setExplanation] = useState("");
  const [payment, setPayment] = useState<PaymentRecord | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([
      api<FormTemplate[]>("/api/forms/templates"),
      api<DocumentReading[]>("/api/documents"),
    ])
      .then(([t, d]) => {
        setTemplates(t);
        setDocs(d);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed"));
  }, []);

  const currentField = useMemo(() => {
    if (!template || !session) return null;
    if (session.status === "ready" || session.status === "paid" || session.status === "rendered") {
      return null;
    }
    return template.fields[session.currentFieldIndex] ?? null;
  }, [template, session]);

  async function start(templateId: string) {
    setBusy(true);
    setError(null);
    setPdfUrl(null);
    setPayment(null);
    try {
      const created = await api<FormFillSession>("/api/forms/sessions", {
        method: "POST",
        body: JSON.stringify({
          templateId,
          sourceDocumentId: sourceDocId || undefined,
        }),
      });
      const detail = await api<{ session: FormFillSession; template: FormTemplate }>(
        `/api/forms/sessions/${created.id}`,
      );
      setSession(detail.session);
      setTemplate(detail.template);
      setValue(detail.session.answers[detail.template.fields[0]?.key] ?? "");
      const explained = await api<{ explanationAm: string }>(
        `/api/forms/sessions/${created.id}/explain`,
        { method: "POST" },
      );
      setExplanation(explained.explanationAm);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function submitAnswer() {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await api<FormFillSession>(
        `/api/forms/sessions/${session.id}/answer`,
        {
          method: "POST",
          body: JSON.stringify({ value }),
        },
      );
      setSession(updated);
      if (updated.status === "ready") {
        setExplanation("Form ready. Pay with Telebirr to generate the PDF.");
        setValue("");
      } else if (template) {
        const next = template.fields[updated.currentFieldIndex];
        setValue(updated.answers[next.key] ?? "");
        const explained = await api<{ explanationAm: string }>(
          `/api/forms/sessions/${session.id}/explain`,
          { method: "POST" },
        );
        setExplanation(explained.explanationAm);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function pay() {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      const payRec = await api<PaymentRecord>(
        `/api/forms/sessions/${session.id}/pay`,
        { method: "POST" },
      );
      setPayment(payRec);
      const completed = await api<PaymentRecord>(
        `/api/payments/${payRec.id}/complete`,
        { method: "POST", body: JSON.stringify({ outcome: "success" }) },
      );
      setPayment(completed);
      const detail = await api<{ session: FormFillSession; template: FormTemplate }>(
        `/api/forms/sessions/${session.id}`,
      );
      setSession(detail.session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setBusy(false);
    }
  }

  async function downloadPdf() {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api<{ downloadUrl: string; pdfBase64: string }>(
        `/api/forms/sessions/${session.id}/pdf`,
        { method: "POST" },
      );
      setPdfUrl(result.downloadUrl);
      const detail = await api<{ session: FormFillSession; template: FormTemplate }>(
        `/api/forms/sessions/${session.id}`,
      );
      setSession(detail.session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "PDF failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="section section-narrow">
      <div className="page-hero" style={{ paddingLeft: 0, paddingRight: 0 }}>
        <h1 className="am display">{copy.ui.ctaForms}</h1>
        <p className="lede">
          Guided Amharic fill for the most-requested kebele forms. Generate and
          print — no electronic government submission in this MVP.
        </p>
      </div>

      <div className="stack">
        <div className="panel stack">
          <div className="field">
            <label htmlFor="sourceDoc">Autofill from document reader (optional)</label>
            <select
              id="sourceDoc"
              value={sourceDocId}
              onChange={(e) => setSourceDocId(e.target.value)}
            >
              <option value="">None</option>
              {docs.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.fileName} ({doc.documentKind})
                </option>
              ))}
            </select>
          </div>

          <div className="stack">
            {templates.map((t) => (
              <div
                key={t.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: "0.75rem",
                  alignItems: "center",
                  borderBottom: "1px solid var(--line)",
                  paddingBottom: "0.85rem",
                }}
              >
                <div>
                  <strong className="am">{t.titleAm}</strong>
                  <p className="muted" style={{ margin: "0.2rem 0 0" }}>
                    {t.titleEn} · {t.priceBirr} ETB
                  </p>
                </div>
                <button
                  className="btn btn-solid"
                  type="button"
                  disabled={busy}
                  onClick={() => start(t.id)}
                >
                  Start
                </button>
              </div>
            ))}
          </div>
        </div>

        {session && template && (
          <div className="panel stack">
            <p className="status-pill">Status: {session.status}</p>
            <h2 className="am display" style={{ fontSize: "1.45rem", margin: 0 }}>
              {template.titleAm}
            </h2>

            {currentField ? (
              <>
                <div>
                  <h3 className="am" style={{ margin: "0 0 0.35rem" }}>
                    {currentField.labelAm}
                  </h3>
                  <p className="muted am" style={{ margin: 0 }}>
                    {explanation || currentField.helpAm}
                  </p>
                </div>
                <div className="field">
                  <label htmlFor="answer">Your answer</label>
                  <input
                    id="answer"
                    className="am"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                  />
                </div>
                <button className="btn btn-solid" type="button" disabled={busy} onClick={submitAnswer}>
                  Save &amp; next
                </button>
              </>
            ) : (
              <>
                <ul className="am" style={{ margin: 0, paddingLeft: "1.1rem" }}>
                  {template.fields.map((field) => (
                    <li key={field.key}>
                      <strong>{field.labelAm}</strong>: {session.answers[field.key] || "—"}
                    </li>
                  ))}
                </ul>
                {(session.status === "ready" || session.status === "draft") && (
                  <button className="btn btn-solid" type="button" disabled={busy} onClick={pay}>
                    Pay with Telebirr (mock)
                  </button>
                )}
                {(session.status === "paid" || session.status === "rendered") && (
                  <button className="btn btn-solid" type="button" disabled={busy} onClick={downloadPdf}>
                    Generate PDF
                  </button>
                )}
                {payment && (
                  <p className="muted">
                    Payment {payment.providerRef}: {payment.status}
                    {payment.checkoutUrl ? ` · ${payment.checkoutUrl}` : ""}
                  </p>
                )}
                {pdfUrl && (
                  <a className="btn btn-ghost" href={pdfUrl} target="_blank" rel="noreferrer">
                    Download print-ready PDF
                  </a>
                )}
              </>
            )}
          </div>
        )}

        {error && <p className="flag">{error}</p>}
      </div>
    </div>
  );
}
