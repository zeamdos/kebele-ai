import { requireUser } from "@/lib/auth";
import { badRequest } from "@/lib/errors";
import { jsonError, jsonOk, readJson } from "@/lib/http";
import { updateErrandStatus } from "@/lib/services/errands";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser(request);
    const { id } = await context.params;
    const body = await readJson<{ status?: "in_progress" | "cancelled" }>(
      request,
    );
    if (!body.status) throw badRequest("status is required");
    return jsonOk(
      await updateErrandStatus({
        errandId: id,
        status: body.status,
        actorUserId: user.id,
      }),
    );
  } catch (error) {
    return jsonError(error);
  }
}
