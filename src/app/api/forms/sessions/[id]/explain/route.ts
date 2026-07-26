import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { forbidden, notFound } from "@/lib/errors";
import { jsonError, jsonOk } from "@/lib/http";
import { explainCurrentField } from "@/lib/services/forms";

export const runtime = "nodejs";

export async function POST(
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
    return jsonOk(await explainCurrentField(id));
  } catch (error) {
    return jsonError(error);
  }
}
