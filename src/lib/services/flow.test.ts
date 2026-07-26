import { beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { resetConfigCache } from "@/lib/env";
import { MemoryRepository, resetDbForTests } from "@/lib/db";
import { resetStorageForTests, FileSystemStorage } from "@/lib/storage/fs";
import { askAssistant } from "@/lib/services/assistant";
import { readDocument } from "@/lib/services/documents";
import {
  renderPaidFormPdf,
  setFormAnswers,
  startFormSession,
} from "@/lib/services/forms";
import { completePayment, startPayment } from "@/lib/services/payments";
import {
  acceptErrand,
  completeErrand,
  confirmErrand,
  postErrand,
  updateErrandStatus,
} from "@/lib/services/errands";
import { nowIso } from "@/lib/ids";

describe("end-to-end MVP flows (mock APIs)", () => {
  beforeEach(async () => {
    delete process.env.USE_REAL_APIS;
    resetConfigCache();
    const dir = mkdtempSync(path.join(tmpdir(), "kn-"));
    process.env.KN_STORAGE_DIR = path.join(dir, "storage");
    process.env.KN_DB_FILE = path.join(dir, "db.json");
    resetConfigCache();
    resetStorageForTests(new FileSystemStorage(process.env.KN_STORAGE_DIR));
    const repo = new MemoryRepository(process.env.KN_DB_FILE);
    await repo.ensureSeed();
    resetDbForTests(repo);
  });

  it("assistant answers from RAG context", async () => {
    const result = await askAssistant({
      text: "ID renewal documents",
      speak: true,
    });
    expect(result.assistantTurn.text.length).toBeGreaterThan(20);
    expect(result.assistantTurn.sources?.length).toBeGreaterThan(0);
    expect(result.llmMocked).toBe(true);
  });

  it("document reader -> form fill -> telebirr -> pdf", async () => {
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );
    const doc = await readDocument({
      userId: "user_demo_citizen",
      bytes: png,
      fileName: "national-id.png",
      mimeType: "image/png",
    });
    expect(doc.documentKind).toBe("national_id");
    expect(doc.extractedFields.fullName).toBeTruthy();

    const session = await startFormSession({
      userId: "user_demo_citizen",
      templateId: "id_renewal",
      sourceDocumentId: doc.id,
    });
    expect(session.answers.fullName).toBeTruthy();

    const ready = await setFormAnswers(session.id, {
      fullName: doc.extractedFields.fullName || "Abebe Kebede",
      dateOfBirth: "1990-01-15",
      sex: "male",
      idNumber: "ID-0001234567",
      kebele: "08",
      woreda: "Bole",
      phone: "+251911000001",
      reason: "Expired",
    });
    expect(ready.status).toBe("ready");

    const payment = await startPayment({
      userId: "user_demo_citizen",
      purpose: "form_fill",
      amountBirr: 75,
      description: "Form fill",
      metadata: { formSessionId: session.id },
    });
    const captured = await completePayment(payment.providerRef, "success");
    expect(captured.status).toBe("captured");

    const pdf = await renderPaidFormPdf(session.id);
    expect(pdf.pdfBase64.length).toBeGreaterThan(100);
    expect(pdf.downloadUrl).toContain("/api/files/");
  });

  it("errand hiring escrow loop", async () => {
    const { task } = await postErrand({
      userId: "user_demo_citizen",
      title: "Submit ID renewal",
      description: "Queue and submit form",
      kebeleOffice: "Bole 08",
      priceBirr: 150,
      contactPhone: "+251911000001",
    });
    expect(task.status).toBe("posted");

    const { db } = await import("@/lib/db");
    const shared = await db();
    const payment = task.paymentId
      ? await shared.getPayment(task.paymentId)
      : undefined;
    expect(payment).toBeTruthy();
    await completePayment(payment!.providerRef, "success");

    const accepted = await acceptErrand({
      errandId: task.id,
      runnerId: "runner_demo_1",
    });
    expect(accepted.status).toBe("accepted");

    await updateErrandStatus({
      errandId: task.id,
      status: "in_progress",
      actorUserId: "user_demo_runner",
    });

    const done = await completeErrand({
      errandId: task.id,
      runnerId: "runner_demo_1",
      note: "Done at " + nowIso(),
    });
    expect(done.status).toBe("done_pending_confirm");

    const confirmed = await confirmErrand({
      errandId: task.id,
      userId: "user_demo_citizen",
    });
    expect(confirmed.status).toBe("completed");
  });
});
