import { beforeEach, describe, expect, it } from "vitest";
import { resetConfigCache } from "@/lib/env";
import { addisChat } from "@/lib/providers/addis-ai";
import { transcribeAudio } from "@/lib/providers/whisperflow";
import { speakText } from "@/lib/providers/elevenlabs";
import { extractTextFromImage } from "@/lib/providers/ocr";
import { createTelebirrPayment } from "@/lib/providers/telebirr";
import { sendSms } from "@/lib/providers/sms";

beforeEach(() => {
  delete process.env.USE_REAL_APIS;
  resetConfigCache();
});

describe("mock-first providers", () => {
  it("Addis AI returns grounded mock answers", async () => {
    const result = await addisChat([
      {
        role: "system",
        content:
          "CONTEXT_START\nBring ID and residence proof.\nCONTEXT_END",
      },
      { role: "user", content: "What do I need?" },
    ]);
    expect(result.mocked).toBe(true);
    expect(result.text.length).toBeGreaterThan(10);
  });

  it("Whisperflow mock transcribes by filename hint", async () => {
    const result = await transcribeAudio(Buffer.from("x"), {
      fileName: "residence-question.webm",
    });
    expect(result.mocked).toBe(true);
    expect(result.text.length).toBeGreaterThan(5);
  });

  it("ElevenLabs mock returns wav audio", async () => {
    const result = await speakText("Hello");
    expect(result.mocked).toBe(true);
    expect(result.mimeType).toBe("audio/wav");
    expect(result.audioBase64.length).toBeGreaterThan(20);
  });

  it("OCR mock extracts ID-like text", async () => {
    // 1x1 png
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );
    const result = await extractTextFromImage(png, { fileName: "id.png" });
    expect(result.mocked).toBe(true);
    expect(result.engine).toBe("mock");
    expect(result.text).toMatch(/ID-0001234567|Abebe|አበበ/i);
  });

  it("Telebirr mock creates checkout URL", async () => {
    const payment = await createTelebirrPayment({
      amountBirr: 75,
      description: "Form fill",
    });
    expect(payment.mocked).toBe(true);
    expect(payment.checkoutUrl).toContain("/api/payments/mock-checkout");
  });

  it("SMS mock queues a message", async () => {
    const sms = await sendSms("+251911000001", "Task accepted");
    expect(sms.mocked).toBe(true);
    expect(sms.status).toBe("queued");
  });
});
