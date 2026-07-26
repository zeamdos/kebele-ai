import { PDFDocument } from "pdf-lib";
import { z } from "zod";
import { addisChat, extractTextFromImage } from "@/lib/providers";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage/fs";
import { badRequest } from "@/lib/errors";
import { newId, nowIso } from "@/lib/ids";
import type { DocumentKind, DocumentReading } from "@/lib/types";

const analysisSchema = z.object({
  documentKind: z.enum([
    "national_id",
    "residence_certificate",
    "kebele_form",
    "kebele_letter",
    "birth_certificate",
    "unknown",
  ]),
  summaryAm: z.string(),
  actionableFlags: z.array(z.string()).default([]),
  extractedFields: z.record(z.string(), z.string()).default({}),
});

export async function readDocument(input: {
  userId: string;
  bytes: Buffer;
  fileName: string;
  mimeType: string;
}): Promise<DocumentReading> {
  if (!input.bytes.length) throw badRequest("Empty upload");

  const stored = await storage().put(input.bytes, {
    mimeType: input.mimeType,
    fileName: input.fileName,
    folder: "documents",
  });

  const imageBytes = await toImageBytes(input.bytes, input.mimeType);
  const ocr = await extractTextFromImage(imageBytes, {
    fileName: input.fileName,
    mimeType: input.mimeType,
  });

  const analysis = await analyzeOcr(ocr.text);
  const repo = await db();
  const doc: DocumentReading = {
    id: newId("doc"),
    userId: input.userId,
    fileName: input.fileName,
    mimeType: input.mimeType,
    storagePath: stored.path,
    ocrText: ocr.text,
    correctedText: ocr.text,
    documentKind: analysis.documentKind,
    summaryAm: analysis.summaryAm,
    actionableFlags: analysis.actionableFlags,
    extractedFields: analysis.extractedFields,
    createdAt: nowIso(),
  };
  return repo.createDocument(doc);
}

export async function correctDocumentText(
  documentId: string,
  correctedText: string,
): Promise<DocumentReading> {
  const repo = await db();
  const existing = await repo.getDocument(documentId);
  if (!existing) throw badRequest("Document not found");

  // Re-run the model pass on the corrected text so downstream autofill improves.
  const analysis = await analyzeOcr(correctedText);
  return repo.updateDocument(documentId, {
    correctedText,
    documentKind: analysis.documentKind,
    summaryAm: analysis.summaryAm,
    actionableFlags: analysis.actionableFlags,
    extractedFields: {
      ...existing.extractedFields,
      ...analysis.extractedFields,
    },
  });
}

async function analyzeOcr(ocrText: string): Promise<{
  documentKind: DocumentKind;
  summaryAm: string;
  actionableFlags: string[];
  extractedFields: Record<string, string>;
}> {
  const llm = await addisChat([
    {
      role: "system",
      content:
        "DOCUMENT_ANALYZER. Return JSON only with keys documentKind, summaryAm, actionableFlags, extractedFields. summaryAm must be plain Amharic.",
    },
    {
      role: "user",
      content: `OCR_TEXT:\n${ocrText}`,
    },
  ]);

  try {
    const parsed = JSON.parse(stripFences(llm.text));
    return analysisSchema.parse(parsed);
  } catch {
    return {
      documentKind: "unknown",
      summaryAm: llm.text.slice(0, 400),
      actionableFlags: [],
      extractedFields: {},
    };
  }
}

function stripFences(text: string): string {
  return text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

async function toImageBytes(bytes: Buffer, mimeType: string): Promise<Buffer> {
  if (mimeType === "application/pdf" || bytes.slice(0, 4).toString() === "%PDF") {
    // MVP: render first page text layer if present; otherwise pass PDF bytes
    // through a canvas-less path by extracting embedded page as blank PNG
    // placeholder for OCR mock / Vision (Vision accepts PDF in live mode too,
    // but our preprocess expects an image — convert via pdf-lib page size stub).
    try {
      const pdf = await PDFDocument.load(bytes);
      if (pdf.getPageCount() === 0) return bytes;
      // Without puppeteer rasterization, fall back to original bytes; OCR mock
      // still works and live Vision can be pointed at images from the client.
      return bytes;
    } catch {
      return bytes;
    }
  }
  return bytes;
}
