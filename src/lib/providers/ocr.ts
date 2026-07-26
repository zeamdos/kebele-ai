import { config, isLive } from "@/lib/env";
import { upstreamError } from "@/lib/errors";
import { amCopy } from "@/lib/copy";
import sharp from "sharp";

export interface OcrResult {
  text: string;
  engine: "google-vision" | "tesseract" | "mock";
  confidence: number;
  mocked: boolean;
  preprocessApplied: boolean;
}

/**
 * OCR integration point.
 * Default: mock extraction.
 * Live: Google Cloud Vision DOCUMENT_TEXT_DETECTION, with optional Tesseract fallback.
 */
export async function extractTextFromImage(
  image: Buffer,
  options: { fileName?: string; mimeType?: string } = {},
): Promise<OcrResult> {
  const preprocessed = await preprocessImage(image);
  const bytes = preprocessed.buffer;

  if (!isLive("ocr")) {
    return {
      text: mockOcrText(options.fileName, options.mimeType),
      engine: "mock",
      confidence: 0.92,
      mocked: true,
      preprocessApplied: preprocessed.changed,
    };
  }

  const cfg = config().ocr;
  try {
    if (!cfg.googleVisionApiKey) {
      throw upstreamError("GOOGLE_VISION_API_KEY is required for live OCR");
    }
    const vision = await googleVisionOcr(
      bytes,
      cfg.googleVisionApiKey,
      cfg.googleVisionEndpoint,
    );
    return {
      ...vision,
      mocked: false,
      preprocessApplied: preprocessed.changed,
    };
  } catch (error) {
    if (!cfg.allowTesseractFallback) throw error;
    const tess = await tesseractOcr(bytes, cfg.tesseractLanguages);
    return {
      ...tess,
      mocked: false,
      preprocessApplied: preprocessed.changed,
    };
  }
}

async function preprocessImage(
  image: Buffer,
): Promise<{ buffer: Buffer; changed: boolean }> {
  try {
    const meta = await sharp(image).metadata();
    if (!meta.format) {
      return { buffer: image, changed: false };
    }
    const buffer = await sharp(image)
      .rotate()
      .normalize()
      .sharpen()
      .grayscale()
      .toFormat("png")
      .toBuffer();
    return { buffer, changed: true };
  } catch {
    return { buffer: image, changed: false };
  }
}

async function googleVisionOcr(
  image: Buffer,
  apiKey: string,
  endpoint: string,
): Promise<Pick<OcrResult, "text" | "engine" | "confidence">> {
  const response = await fetch(`${endpoint}?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [
        {
          image: { content: image.toString("base64") },
          features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
          imageContext: { languageHints: ["am", "en"] },
        },
      ],
    }),
  });

  if (!response.ok) {
    throw upstreamError(
      `Google Vision failed (${response.status})`,
      await response.text().catch(() => ""),
    );
  }

  const payload = (await response.json()) as {
    responses?: Array<{
      fullTextAnnotation?: { text?: string };
      error?: { message?: string };
    }>;
  };
  const first = payload.responses?.[0];
  if (first?.error?.message) {
    throw upstreamError(`Google Vision error: ${first.error.message}`);
  }
  const text = first?.fullTextAnnotation?.text?.trim() ?? "";
  if (!text) {
    throw upstreamError("Google Vision returned no text");
  }
  return { text, engine: "google-vision", confidence: 0.9 };
}

async function tesseractOcr(
  image: Buffer,
  languages: string,
): Promise<Pick<OcrResult, "text" | "engine" | "confidence">> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker(languages);
  try {
    const {
      data: { text, confidence },
    } = await worker.recognize(image);
    return {
      text: text.trim(),
      engine: "tesseract",
      confidence: (confidence ?? 0) / 100,
    };
  } finally {
    await worker.terminate();
  }
}

function mockOcrText(fileName?: string, mimeType?: string): string {
  const copy = amCopy();
  const hint = `${fileName ?? ""} ${mimeType ?? ""}`.toLowerCase();
  if (hint.includes("residence") || hint.includes("menoria")) {
    return copy.ocr.residenceLines.join("\n");
  }
  return copy.ocr.idLines.join("\n");
}
