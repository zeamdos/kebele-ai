import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { FormTemplate } from "@/lib/types";

let cachedFont: Uint8Array | undefined;

async function loadAmharicFont(): Promise<Uint8Array | undefined> {
  if (cachedFont) return cachedFont;
  const candidates = [
    path.join(
      /* turbopackIgnore: true */ process.cwd(),
      "public",
      "fonts",
      "NotoSansEthiopic-Regular.ttf",
    ),
    "/usr/share/fonts/truetype/noto/NotoSansEthiopic-Regular.ttf",
  ];
  for (const candidate of candidates) {
    try {
      cachedFont = await readFile(candidate);
      return cachedFont;
    } catch {
      // try next
    }
  }
  return undefined;
}

/**
 * Render a print-ready PDF that mirrors a kebele paper form layout.
 * Uses Noto Sans Ethiopic when available; falls back to Helvetica transliteration labels.
 */
export async function renderFormPdf(
  template: FormTemplate,
  answers: Record<string, string>,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const page = pdf.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();

  const amFontBytes = await loadAmharicFont();
  const font = amFontBytes
    ? await pdf.embedFont(amFontBytes, { subset: true })
    : await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = amFontBytes
    ? font
    : await pdf.embedFont(StandardFonts.HelveticaBold);

  const ink = rgb(0.12, 0.16, 0.14);
  const rule = rgb(0.55, 0.45, 0.28);
  const wash = rgb(0.96, 0.94, 0.88);

  page.drawRectangle({
    x: 0,
    y: 0,
    width,
    height,
    color: wash,
  });

  page.drawRectangle({
    x: 36,
    y: 36,
    width: width - 72,
    height: height - 72,
    borderColor: rule,
    borderWidth: 1.5,
    color: rgb(1, 1, 1),
  });

  let y = height - 72;
  page.drawText("KEBELE NAVIGATOR", {
    x: 56,
    y,
    size: 10,
    font: fontBold,
    color: rule,
  });
  y -= 22;
  page.drawText(safeText(template.titleAm || template.titleEn, !!amFontBytes), {
    x: 56,
    y,
    size: 16,
    font: fontBold,
    color: ink,
    maxWidth: width - 112,
  });
  y -= 18;
  page.drawText(template.titleEn, {
    x: 56,
    y,
    size: 10,
    font,
    color: ink,
  });
  y -= 14;
  page.drawLine({
    start: { x: 56, y },
    end: { x: width - 56, y },
    thickness: 1,
    color: rule,
  });
  y -= 28;

  page.drawText(
    safeText(template.kebeleOfficeHintAm || template.descriptionAm, !!amFontBytes),
    {
      x: 56,
      y,
      size: 10,
      font,
      color: ink,
      maxWidth: width - 112,
    },
  );
  y -= 32;

  for (const field of template.fields) {
    if (y < 100) break;
    const label = safeText(
      `${field.labelAm} / ${field.labelEn}`,
      !!amFontBytes,
    );
    page.drawText(label, {
      x: 56,
      y,
      size: 10,
      font: fontBold,
      color: ink,
      maxWidth: width - 112,
    });
    y -= 16;
    const value = answers[field.key]?.trim() || "____________________________";
    page.drawText(safeText(value, !!amFontBytes), {
      x: 64,
      y,
      size: 12,
      font,
      color: ink,
      maxWidth: width - 128,
    });
    y -= 10;
    page.drawLine({
      start: { x: 56, y },
      end: { x: width - 56, y },
      thickness: 0.6,
      color: rgb(0.75, 0.72, 0.65),
    });
    y -= 22;
  }

  y = 64;
  page.drawText("Generate-and-print only. Hand in at your kebele office.", {
    x: 56,
    y,
    size: 8,
    font,
    color: rgb(0.35, 0.35, 0.35),
  });

  return pdf.save();
}

function safeText(text: string, hasAmharicFont: boolean): string {
  if (hasAmharicFont) return text;
  // Helvetica cannot encode Ethiopic — keep Latin / digits / punctuation.
  return text.replace(/[^\u0000-\u00ff]/g, " ").replace(/\s+/g, " ").trim() || "[Amharic text]";
}
