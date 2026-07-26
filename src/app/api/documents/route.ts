import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { badRequest } from "@/lib/errors";
import { jsonError, jsonOk } from "@/lib/http";
import { readDocument } from "@/lib/services/documents";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    const repo = await db();
    return jsonOk(await repo.listDocuments(user.id));
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const form = await request.formData();
    const file = form.get("file");
    if (!file || typeof file === "string") {
      throw badRequest("file is required");
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    const doc = await readDocument({
      userId: user.id,
      bytes,
      fileName: file.name || "document.bin",
      mimeType: file.type || "application/octet-stream",
    });
    return jsonOk(doc, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
