import type { Metadata } from "next";
import { Fraunces, Outfit } from "next/font/google";
import localFont from "next/font/local";
import { SiteNav } from "@/components/SiteNav";
import { amCopy } from "@/lib/copy";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

const notoEthiopic = localFont({
  src: "../../public/fonts/NotoSansEthiopic-Regular.ttf",
  variable: "--font-noto-ethiopic",
  display: "swap",
});

const copy = amCopy();

export const metadata: Metadata = {
  title: `${copy.ui.brandEn} · ${copy.ui.brand}`,
  description: copy.ui.tagline,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="am"
      className={`${outfit.variable} ${fraunces.variable} ${notoEthiopic.variable}`}
    >
      <body
        style={
          {
            "--font-body":
              "var(--font-outfit), var(--font-noto-ethiopic), sans-serif",
            "--font-display":
              "var(--font-fraunces), var(--font-noto-ethiopic), Georgia, serif",
          } as React.CSSProperties
        }
      >
        <div className="site-shell">
          <SiteNav />
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
