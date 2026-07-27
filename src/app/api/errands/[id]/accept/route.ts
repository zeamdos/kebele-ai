import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { badRequest } from "@/lib/errors";
import { jsonError, jsonOk, readJson } from "@/lib/http";
import { acceptErrand } from "@/lib/services/errands";
import { completePayment } from "@/lib/services/payments";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser(request);
    const { id } = await context.params;
    const repo = await db();
    const body = await readJson<{ runnerId?: string }>(request).catch(
      () => ({}) as { runnerId?: string },
    );

    let runnerId = body.runnerId;
    if (!runnerId) {
      const runners = await repo.listRunners(false);
      runnerId = runners.find((r) => r.userId === user.id)?.id;
    }
    if (!runnerId) throw badRequest("runnerId is required");

    const task = await repo.getErrand(id);
    if (task?.paymentId) {
      const payment = await repo.getPayment(task.paymentId);
      // Auto-authorize escrow in mock flows so accept can proceed.
      if (payment && payment.status === "pending") {
        await completePayment(payment.providerRef, "success");
      }
    }

    return jsonOk(await acceptErrand({ errandId: id, runnerId }));
  } catch (error) {
    return jsonError(error);
  }
}
