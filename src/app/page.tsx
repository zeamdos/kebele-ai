import Link from "next/link";
import { amCopy } from "@/lib/copy";

export default function HomePage() {
  const copy = amCopy();

  return (
    <>
      <section className="hero" aria-label="Hero">
        <div className="hero-media" role="img" aria-label="Addis street and civic life" />
        <div className="hero-content">
          <p className="status-pill" style={{ color: "rgba(247,250,247,0.85)", marginBottom: "0.75rem" }}>
            {copy.ui.brandEn}
          </p>
          <h1 className="hero-brand am">{copy.ui.brand}</h1>
          <p className="hero-line am">{copy.ui.tagline}</p>
          <div className="cta-row">
            <Link className="btn btn-primary am" href="/assistant">
              {copy.ui.ctaAssistant}
            </Link>
            <Link className="btn btn-secondary am" href="/documents">
              {copy.ui.ctaReader}
            </Link>
          </div>
        </div>
      </section>

      <section className="section section-narrow">
        <h2 className="display">One app. Four paths through kebele paper.</h2>
        <p className="lede">
          Free guidance pulls people in. Paid form filling and vetted errands
          cover the last mile when you cannot stand in the queue yourself.
        </p>
        <div className="tier-list">
          <div className="tier-row">
            <span className="tier-tag">{copy.ui.free}</span>
            <div>
              <strong className="am">{copy.ui.ctaAssistant}</strong>
              <p className="muted" style={{ margin: "0.25rem 0 0" }}>
                Voice-first Amharic Q&amp;A grounded in real procedure text.
              </p>
            </div>
            <Link className="btn btn-ghost" href="/assistant">
              Open
            </Link>
          </div>
          <div className="tier-row">
            <span className="tier-tag">{copy.ui.free}</span>
            <div>
              <strong className="am">{copy.ui.ctaReader}</strong>
              <p className="muted" style={{ margin: "0.25rem 0 0" }}>
                Upload an ID or letter — hear what it says and what to do next.
              </p>
            </div>
            <Link className="btn btn-ghost" href="/documents">
              Open
            </Link>
          </div>
          <div className="tier-row">
            <span className="tier-tag">{copy.ui.paid}</span>
            <div>
              <strong className="am">{copy.ui.ctaForms}</strong>
              <p className="muted" style={{ margin: "0.25rem 0 0" }}>
                Fill kebele forms at home, pay with Telebirr, print ready-to-hand-in.
              </p>
            </div>
            <Link className="btn btn-ghost" href="/forms">
              Open
            </Link>
          </div>
          <div className="tier-row">
            <span className="tier-tag">{copy.ui.paid}</span>
            <div>
              <strong className="am">{copy.ui.ctaErrands}</strong>
              <p className="muted" style={{ margin: "0.25rem 0 0" }}>
                Hire a vetted runner for the queue — escrow until you confirm.
              </p>
            </div>
            <Link className="btn btn-ghost" href="/errands">
              Open
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
