"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { amCopy } from "@/lib/copy";

const links = [
  { href: "/assistant", labelKey: "ctaAssistant" as const },
  { href: "/documents", labelKey: "ctaReader" as const },
  { href: "/forms", labelKey: "ctaForms" as const },
  { href: "/errands", labelKey: "ctaErrands" as const },
];

export function SiteNav() {
  const pathname = usePathname();
  const copy = amCopy();

  return (
    <header className="nav-bar">
      <Link href="/" className="nav-brand">
        <span className="mark" aria-hidden />
        <span className="am">{copy.ui.brand}</span>
        <span className="muted">{copy.ui.brandEn}</span>
      </Link>
      <nav className="nav-links am" aria-label="Primary">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            aria-current={pathname.startsWith(link.href) ? "page" : undefined}
          >
            {copy.ui[link.labelKey]}
          </Link>
        ))}
      </nav>
    </header>
  );
}
