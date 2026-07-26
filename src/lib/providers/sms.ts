import { config, isLive } from "@/lib/env";
import { upstreamError } from "@/lib/errors";
import { newId } from "@/lib/ids";

export interface SmsResult {
  messageId: string;
  to: string;
  mocked: boolean;
  status: "queued" | "sent" | "failed";
}

/**
 * Africa's Talking SMS integration point.
 * Mock: logs and returns a synthetic message id.
 */
export async function sendSms(
  to: string,
  message: string,
): Promise<SmsResult> {
  if (!isLive("sms")) {
    console.info(`[sms:mock] to=${to} message=${message}`);
    return {
      messageId: newId("sms"),
      to,
      mocked: true,
      status: "queued",
    };
  }

  const cfg = config().sms;
  if (!cfg.apiKey) {
    throw upstreamError("AFRICAS_TALKING_API_KEY is required for live SMS");
  }

  const body = new URLSearchParams({
    username: cfg.username,
    to,
    message,
  });
  if (cfg.senderId) body.set("from", cfg.senderId);

  const response = await fetch(`${cfg.baseUrl}/messaging`, {
    method: "POST",
    headers: {
      apiKey: cfg.apiKey,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
  });

  if (!response.ok) {
    throw upstreamError(
      `Africa's Talking SMS failed (${response.status})`,
      await response.text().catch(() => ""),
    );
  }

  const payload = (await response.json()) as {
    SMSMessageData?: {
      Recipients?: Array<{ messageId?: string; status?: string }>;
    };
  };
  const recipient = payload.SMSMessageData?.Recipients?.[0];

  return {
    messageId: recipient?.messageId ?? newId("sms"),
    to,
    mocked: false,
    status: recipient?.status?.toLowerCase() === "success" ? "sent" : "queued",
  };
}
