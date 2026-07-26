import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { badRequest } from "@/lib/errors";
import { jsonError, jsonOk, readJson } from "@/lib/http";
import { startFormSession } from "@/lib/services/forms";
import type { FormTemplateId } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    const repo = await db();
    return jsonOk(await repo.listFormSessions(user.id));
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const body = await readJson<{
      templateId?: FormTemplateId;
      sourceDocumentId?: string;
    }>(request);
    if (!body.templateId) throw badRequest("templateId is required");
    const session = await startFormSession({
      userId: user.id,
      templateId: body.templateId,
      sourceDocumentId: body.sourceDocumentId,
    });
    return jsonOk(session, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
