"use client";

import { FormEvent, useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { amCopy } from "@/lib/copy";
import type { ErrandTask, RunnerProfile } from "@/lib/types";

export default function ErrandsPage() {
  const copy = amCopy();
  const [tasks, setTasks] = useState<ErrandTask[]>([]);
  const [runners, setRunners] = useState<RunnerProfile[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [asRunner, setAsRunner] = useState(false);

  async function refresh(runnerMode = asRunner) {
    if (runnerMode) {
      const data = await api<{ assigned: ErrandTask[]; open: ErrandTask[] }>(
        "/api/errands",
        { userId: "user_demo_runner" },
      );
      setTasks([...data.open, ...data.assigned]);
    } else {
      setTasks(await api<ErrandTask[]>("/api/errands"));
    }
    setRunners(await api<RunnerProfile[]>("/api/runners"));
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await api<ErrandTask[]>("/api/errands");
        const runnerList = await api<RunnerProfile[]>("/api/runners");
        if (!cancelled) {
          setTasks(list);
          setRunners(runnerList);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    try {
      await api("/api/errands", {
        method: "POST",
        body: JSON.stringify({
          title: String(form.get("title") || ""),
          description: String(form.get("description") || ""),
          kebeleOffice: String(form.get("kebeleOffice") || ""),
          priceBirr: Number(form.get("priceBirr") || 0),
          contactPhone: String(form.get("contactPhone") || ""),
        }),
      });
      event.currentTarget.reset();
      await refresh(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function act(
    path: string,
    init: RequestInit & { userId?: string } = {},
  ) {
    setBusy(true);
    setError(null);
    try {
      await api(path, init);
      await refresh(asRunner);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="section section-narrow">
      <div className="page-hero" style={{ paddingLeft: 0, paddingRight: 0 }}>
        <h1 className="am display">{copy.ui.ctaErrands}</h1>
        <p className="lede">
          Post a task for a manually vetted runner. Telebirr holds payment until
          you confirm completion. WhatsApp/phone for coordination in this MVP.
        </p>
      </div>

      <div className="stack">
        <div className="cta-row">
          <button
            type="button"
            className={`btn ${!asRunner ? "btn-solid" : "btn-ghost"}`}
            onClick={() => {
              setAsRunner(false);
              void refresh(false);
            }}
          >
            Citizen view
          </button>
          <button
            type="button"
            className={`btn ${asRunner ? "btn-solid" : "btn-ghost"}`}
            onClick={() => {
              setAsRunner(true);
              void refresh(true);
            }}
          >
            Runner view
          </button>
        </div>

        {!asRunner && (
          <form className="panel stack" onSubmit={onPost}>
            <div className="field">
              <label htmlFor="title">What is needed</label>
              <input id="title" name="title" required placeholder="Renew national ID" />
            </div>
            <div className="field">
              <label htmlFor="kebeleOffice">Kebele office</label>
              <input id="kebeleOffice" name="kebeleOffice" required placeholder="Bole 08" />
            </div>
            <div className="field">
              <label htmlFor="priceBirr">Offer (ETB)</label>
              <input id="priceBirr" name="priceBirr" type="number" min={50} defaultValue={150} required />
            </div>
            <div className="field">
              <label htmlFor="contactPhone">Contact phone</label>
              <input id="contactPhone" name="contactPhone" defaultValue="+251911000001" required />
            </div>
            <div className="field">
              <label htmlFor="description">Notes / documents needed</label>
              <textarea id="description" name="description" placeholder="Bring completed ID renewal form and photos." />
            </div>
            <button className="btn btn-solid" type="submit" disabled={busy}>
              Post errand + hold Telebirr escrow
            </button>
          </form>
        )}

        <div className="panel stack">
          <h2 className="display" style={{ fontSize: "1.35rem", margin: 0 }}>
            Vetted runners
          </h2>
          {runners.map((runner) => (
            <p key={runner.id} className="muted" style={{ margin: 0 }}>
              {runner.displayName} · {runner.kebeles.join(", ")} · {runner.phone}
            </p>
          ))}
        </div>

        <div className="panel stack">
          <h2 className="display" style={{ fontSize: "1.35rem", margin: 0 }}>
            Tasks
          </h2>
          {tasks.length === 0 && <p className="muted">No tasks yet.</p>}
          {tasks.map((task) => (
            <div
              key={task.id}
              style={{
                borderBottom: "1px solid var(--line)",
                paddingBottom: "0.9rem",
                display: "grid",
                gap: "0.45rem",
              }}
            >
              <strong>
                {task.reference} · {task.title}
              </strong>
              <span className="muted">
                {task.kebeleOffice} · {task.priceBirr} ETB · {task.status}
              </span>
              <span className="muted">{task.description}</span>
              {task.whatsappGroupHint && (
                <span className="muted">Coord: {task.whatsappGroupHint}</span>
              )}
              <div className="cta-row">
                {asRunner && task.status === "posted" && (
                  <button
                    type="button"
                    className="btn btn-solid"
                    disabled={busy}
                    onClick={() =>
                      act(`/api/errands/${task.id}/accept`, {
                        method: "POST",
                        userId: "user_demo_runner",
                        body: JSON.stringify({}),
                      })
                    }
                  >
                    Accept
                  </button>
                )}
                {asRunner && (task.status === "accepted" || task.status === "in_progress") && (
                  <>
                    {task.status === "accepted" && (
                      <button
                        type="button"
                        className="btn btn-ghost"
                        disabled={busy}
                        onClick={() =>
                          act(`/api/errands/${task.id}/status`, {
                            method: "POST",
                            userId: "user_demo_runner",
                            body: JSON.stringify({ status: "in_progress" }),
                          })
                        }
                      >
                        Mark in progress
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-solid"
                      disabled={busy}
                      onClick={() =>
                        act(`/api/errands/${task.id}/complete`, {
                          method: "POST",
                          userId: "user_demo_runner",
                          body: JSON.stringify({
                            note: "Submitted at kebele; receipt photo attached offline.",
                          }),
                        })
                      }
                    >
                      Mark done
                    </button>
                  </>
                )}
                {!asRunner && task.status === "done_pending_confirm" && (
                  <button
                    type="button"
                    className="btn btn-solid"
                    disabled={busy}
                    onClick={() =>
                      act(`/api/errands/${task.id}/confirm`, { method: "POST" })
                    }
                  >
                    Confirm &amp; release escrow
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {error && <p className="flag">{error}</p>}
      </div>
    </div>
  );
}
