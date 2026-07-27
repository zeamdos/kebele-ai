import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { forbidden, notFound } from "@/lib/errors";
import { jsonError, jsonOk, readJson } from "@/lib/http";
import { correctDocumentText } from "@/lib/services/documents";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser(request);
    const { id } = await context.params;
    const repo = await db();
    const doc = await repo.getDocument(id);
    if (!doc) throw notFound("Document not found");
    if (doc.userId !== user.id) throw forbidden();
    return jsonOk(doc);
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser(request);
    const { id } = await context.params;
    const repo = await db();
    const existing = await repo.getDocument(id);
    if (!existing) throw notFound("Document not found");
    if (existing.userId !== user.id) throw forbidden();

    const body = await readJson<{ correctedText?: string }>(request);
    if (typeof body.correctedText !== "string") {
      return jsonError(new Error("correctedText is required"));
    }
    const updated = await correctDocumentText(id, body.correctedText);
    return jsonOk(updated);
  } catch (error) {
    return jsonError(error);
  }
}
