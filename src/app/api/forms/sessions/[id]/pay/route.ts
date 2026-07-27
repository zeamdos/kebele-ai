import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { config } from "@/lib/env";
import { badRequest, forbidden, notFound } from "@/lib/errors";
import { getFormTemplate } from "@/lib/forms/templates";
import { jsonError, jsonOk } from "@/lib/http";
import { startPayment } from "@/lib/services/payments";

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
    if (session.status !== "ready" && session.status !== "draft") {
      throw badRequest("Session is not payable in its current state");
    }

    const template = getFormTemplate(session.templateId);
    const amount =
      template.priceBirr || config().pricing.formFillBirr;

    const payment = await startPayment({
      userId: user.id,
      purpose: "form_fill",
      amountBirr: amount,
      description: `Form fill: ${template.titleEn}`,
      customerPhone: user.phone,
      metadata: { formSessionId: session.id, templateId: template.id },
    });

    await repo.updateFormSession(session.id, { paymentId: payment.id });
    return jsonOk(payment);
  } catch (error) {
    return jsonError(error);
  }
}
