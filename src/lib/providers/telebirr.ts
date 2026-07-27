import { config, isLive } from "@/lib/env";
import { upstreamError } from "@/lib/errors";
import { newId, newReference, nowIso } from "@/lib/ids";

export type TelebirrIntent = "charge" | "authorize" | "capture" | "release";

export interface TelebirrCreateInput {
  amountBirr: number;
  currency?: string;
  description: string;
  customerPhone?: string;
  metadata?: Record<string, string>;
  /** authorize = hold (escrow); charge = immediate capture */
  mode?: "charge" | "authorize";
}

export interface TelebirrPayment {
  providerRef: string;
  checkoutUrl: string;
  status: "pending" | "authorized" | "captured" | "failed" | "released";
  amountBirr: number;
  currency: string;
  mocked: boolean;
  raw?: unknown;
}

/**
 * Telebirr payment integration point.
 * Mock: returns a local checkout URL that the app can "complete" via API.
 */
export async function createTelebirrPayment(
  input: TelebirrCreateInput,
): Promise<TelebirrPayment> {
  const mode = input.mode ?? "charge";

  if (!isLive("telebirr")) {
    const ref = newReference("TB");
    return {
      providerRef: ref,
      checkoutUrl: `/api/payments/mock-checkout?ref=${encodeURIComponent(ref)}&mode=${mode}`,
      status: "pending",
      amountBirr: input.amountBirr,
      currency: input.currency ?? "ETB",
      mocked: true,
      raw: { createdAt: nowIso(), description: input.description, mode },
    };
  }

  const cfg = config().telebirr;
  if (!cfg.appId || !cfg.appKey) {
    throw upstreamError("TELEBIRR_APP_ID and TELEBIRR_APP_KEY are required");
  }

  const response = await fetch(`${cfg.baseUrl}/payments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-App-Id": cfg.appId,
      "X-App-Key": cfg.appKey,
    },
    body: JSON.stringify({
      shortCode: cfg.shortCode,
      amount: input.amountBirr,
      currency: input.currency ?? "ETB",
      description: input.description,
      phone: input.customerPhone,
      notifyUrl: cfg.notifyUrl,
      returnUrl: cfg.returnUrl,
      mode,
      metadata: input.metadata,
      nonce: newId("tb"),
    }),
  });

  if (!response.ok) {
    throw upstreamError(
      `Telebirr create failed (${response.status})`,
      await response.text().catch(() => ""),
    );
  }

  const payload = (await response.json()) as {
    paymentId?: string;
    checkoutUrl?: string;
    status?: TelebirrPayment["status"];
  };

  if (!payload.paymentId || !payload.checkoutUrl) {
    throw upstreamError("Telebirr response missing paymentId/checkoutUrl");
  }

  return {
    providerRef: payload.paymentId,
    checkoutUrl: payload.checkoutUrl,
    status: payload.status ?? "pending",
    amountBirr: input.amountBirr,
    currency: input.currency ?? "ETB",
    mocked: false,
    raw: payload,
  };
}

export async function captureTelebirrPayment(
  providerRef: string,
): Promise<TelebirrPayment> {
  return mutateTelebirr(providerRef, "capture");
}

export async function releaseTelebirrPayment(
  providerRef: string,
): Promise<TelebirrPayment> {
  return mutateTelebirr(providerRef, "release");
}

export async function authorizeTelebirrPayment(
  providerRef: string,
): Promise<TelebirrPayment> {
  return mutateTelebirr(providerRef, "authorize");
}

async function mutateTelebirr(
  providerRef: string,
  action: Exclude<TelebirrIntent, "charge">,
): Promise<TelebirrPayment> {
  if (!isLive("telebirr")) {
    const status =
      action === "capture"
        ? "captured"
        : action === "release"
          ? "released"
          : "authorized";
    return {
      providerRef,
      checkoutUrl: `/api/payments/mock-checkout?ref=${encodeURIComponent(providerRef)}`,
      status,
      amountBirr: 0,
      currency: "ETB",
      mocked: true,
    };
  }

  const cfg = config().telebirr;
  if (!cfg.appId || !cfg.appKey) {
    throw upstreamError("TELEBIRR_APP_ID and TELEBIRR_APP_KEY are required");
  }

  const response = await fetch(
    `${cfg.baseUrl}/payments/${encodeURIComponent(providerRef)}/${action}`,
    {
      method: "POST",
      headers: {
        "X-App-Id": cfg.appId,
        "X-App-Key": cfg.appKey,
      },
    },
  );

  if (!response.ok) {
    throw upstreamError(
      `Telebirr ${action} failed (${response.status})`,
      await response.text().catch(() => ""),
    );
  }

  const payload = (await response.json()) as {
    paymentId?: string;
    checkoutUrl?: string;
    status?: TelebirrPayment["status"];
    amount?: number;
  };

  return {
    providerRef: payload.paymentId ?? providerRef,
    checkoutUrl: payload.checkoutUrl ?? "",
    status: payload.status ?? (action === "capture" ? "captured" : "authorized"),
    amountBirr: payload.amount ?? 0,
    currency: "ETB",
    mocked: false,
    raw: payload,
  };
}
