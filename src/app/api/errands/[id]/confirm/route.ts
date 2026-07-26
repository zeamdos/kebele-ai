import { requireUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { confirmErrand } from "@/lib/services/errands";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser(request);
    const { id } = await context.params;
    return jsonOk(await confirmErrand({ errandId: id, userId: user.id }));
  } catch (error) {
    return jsonError(error);
  }
}
