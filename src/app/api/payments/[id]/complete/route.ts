import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { forbidden, notFound } from "@/lib/errors";
import { jsonError, jsonOk, readJson } from "@/lib/http";
import { completePayment } from "@/lib/services/payments";

export const runtime = "nodejs";

/** Completes a payment by id (used by UI mock pay button). */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser(request);
    const { id } = await context.params;
    const repo = await db();
    const payment = await repo.getPayment(id);
    if (!payment) throw notFound("Payment not found");
    if (payment.userId !== user.id) throw forbidden();
    const body = await readJson<{ outcome?: "success" | "failure" }>(request).catch(
      () => ({ outcome: "success" as const }),
    );
    const updated = await completePayment(
      payment.providerRef,
      body.outcome ?? "success",
    );
    return jsonOk(updated);
  } catch (error) {
    return jsonError(error);
  }
}
