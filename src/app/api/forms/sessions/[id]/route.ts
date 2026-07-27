import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { forbidden, notFound } from "@/lib/errors";
import { getFormTemplate } from "@/lib/forms/templates";
import { jsonError, jsonOk, readJson } from "@/lib/http";
import { setFormAnswers } from "@/lib/services/forms";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser(request);
    const { id } = await context.params;
    const repo = await db();
    const session = await repo.getFormSession(id);
    if (!session) throw notFound("Form session not found");
    if (session.userId !== user.id) throw forbidden();
    const template = getFormTemplate(session.templateId);
    return jsonOk({ session, template });
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
    const session = await repo.getFormSession(id);
    if (!session) throw notFound("Form session not found");
    if (session.userId !== user.id) throw forbidden();
    const body = await readJson<{ answers?: Record<string, string> }>(request);
    const updated = await setFormAnswers(id, body.answers ?? {});
    return jsonOk(updated);
  } catch (error) {
    return jsonError(error);
  }
}
