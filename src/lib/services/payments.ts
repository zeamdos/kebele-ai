import {
  authorizeTelebirrPayment,
  captureTelebirrPayment,
  createTelebirrPayment,
  releaseTelebirrPayment,
} from "@/lib/providers";
import { db } from "@/lib/db";
import { config } from "@/lib/env";
import { badRequest, notFound } from "@/lib/errors";
import { newId, nowIso } from "@/lib/ids";
import type { PaymentPurpose, PaymentRecord } from "@/lib/types";

export async function startPayment(input: {
  userId: string;
  purpose: PaymentPurpose;
  amountBirr: number;
  description: string;
  metadata?: Record<string, string>;
  customerPhone?: string;
}): Promise<PaymentRecord> {
  if (input.amountBirr <= 0) throw badRequest("Amount must be positive");

  const mode = input.purpose === "errand_escrow" ? "authorize" : "charge";
  const provider = await createTelebirrPayment({
    amountBirr: input.amountBirr,
    description: input.description,
    customerPhone: input.customerPhone,
    metadata: input.metadata,
    mode,
  });

  const repo = await db();
  const payment: PaymentRecord = {
    id: newId("pay"),
    userId: input.userId,
    purpose: input.purpose,
    amountBirr: input.amountBirr,
    currency: config().pricing.currency,
    status: "pending",
    providerRef: provider.providerRef,
    checkoutUrl: provider.checkoutUrl,
    metadata: input.metadata ?? {},
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  return repo.createPayment(payment);
}

/** Mock or webhook completion for a pending payment. */
export async function completePayment(
  providerRef: string,
  outcome: "success" | "failure" = "success",
): Promise<PaymentRecord> {
  const repo = await db();
  const payment = await repo.getPaymentByProviderRef(providerRef);
  if (!payment) throw notFound("Payment not found");

  if (outcome === "failure") {
    return repo.updatePayment(payment.id, { status: "failed" });
  }

  if (payment.purpose === "errand_escrow") {
    await authorizeTelebirrPayment(providerRef);
    return repo.updatePayment(payment.id, { status: "authorized" });
  }

  await captureTelebirrPayment(providerRef);
  const updated = await repo.updatePayment(payment.id, { status: "captured" });

  // Unlock form session if this payment gates a form fill.
  const formSessionId = payment.metadata.formSessionId;
  if (formSessionId) {
    const session = await repo.getFormSession(formSessionId);
    if (session) {
      await repo.updateFormSession(formSessionId, {
        paymentId: payment.id,
        status: "paid",
      });
    }
  }

  return updated;
}

export async function captureEscrow(paymentId: string): Promise<PaymentRecord> {
  const repo = await db();
  const payment = await repo.getPayment(paymentId);
  if (!payment) throw notFound("Payment not found");
  if (payment.status !== "authorized") {
    throw badRequest("Payment is not in authorized (held) state");
  }
  await captureTelebirrPayment(payment.providerRef);
  return repo.updatePayment(payment.id, { status: "captured" });
}

export async function releaseEscrow(paymentId: string): Promise<PaymentRecord> {
  const repo = await db();
  const payment = await repo.getPayment(paymentId);
  if (!payment) throw notFound("Payment not found");
  if (payment.status !== "authorized") {
    throw badRequest("Payment is not in authorized (held) state");
  }
  await releaseTelebirrPayment(payment.providerRef);
  return repo.updatePayment(payment.id, { status: "released" });
}
