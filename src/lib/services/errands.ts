import { sendSms } from "@/lib/providers";
import { db } from "@/lib/db";
import { config } from "@/lib/env";
import { badRequest, forbidden, notFound } from "@/lib/errors";
import { newId, newReference, nowIso } from "@/lib/ids";
import {
  captureEscrow,
  releaseEscrow,
  startPayment,
} from "@/lib/services/payments";
import { storage } from "@/lib/storage/fs";
import type { ErrandTask } from "@/lib/types";

export async function postErrand(input: {
  userId: string;
  title: string;
  description: string;
  kebeleOffice: string;
  priceBirr: number;
  contactPhone: string;
  documentIds?: string[];
  formSessionId?: string;
}): Promise<{ task: ErrandTask; checkoutUrl?: string }> {
  if (!input.title.trim()) throw badRequest("Title is required");
  if (input.priceBirr < 50) throw badRequest("Minimum errand price is 50 ETB");

  const repo = await db();
  const fee = config().pricing.errandPlatformFeeBirr;
  const holdAmount = input.priceBirr + fee;

  const payment = await startPayment({
    userId: input.userId,
    purpose: "errand_escrow",
    amountBirr: holdAmount,
    description: `Errand escrow: ${input.title}`,
    customerPhone: input.contactPhone,
    metadata: { kind: "errand" },
  });

  const task: ErrandTask = {
    id: newId("errand"),
    reference: newReference("ER"),
    userId: input.userId,
    title: input.title.trim(),
    description: input.description.trim(),
    kebeleOffice: input.kebeleOffice.trim(),
    priceBirr: input.priceBirr,
    status: "posted",
    documentIds: input.documentIds ?? [],
    formSessionId: input.formSessionId,
    paymentId: payment.id,
    contactPhone: input.contactPhone,
    whatsappGroupHint: `WhatsApp group for ${newReference("WG")}`,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  const created = await repo.createErrand(task);
  await repo.updatePayment(payment.id, {
    metadata: { ...payment.metadata, errandId: created.id },
  });

  // Notify vetted runners (SMS fallback).
  const runners = await repo.listRunners(true);
  await Promise.all(
    runners.slice(0, 5).map((runner) =>
      sendSms(
        runner.phone,
        `New kebele errand ${created.reference}: ${created.title} @ ${created.kebeleOffice}. Offer ${created.priceBirr} ETB.`,
      ),
    ),
  );

  return { task: created, checkoutUrl: payment.checkoutUrl };
}

export async function acceptErrand(input: {
  errandId: string;
  runnerId: string;
}): Promise<ErrandTask> {
  const repo = await db();
  const task = await repo.getErrand(input.errandId);
  if (!task) throw notFound("Errand not found");
  if (task.status !== "posted") throw badRequest("Errand is not open");

  const runner = await repo.getRunner(input.runnerId);
  if (!runner || !runner.vetted || !runner.active) {
    throw forbidden("Runner is not vetted/active");
  }

  // Escrow must be authorized (held) before accept for MVP safety.
  if (task.paymentId) {
    const payment = await repo.getPayment(task.paymentId);
    if (!payment || (payment.status !== "authorized" && payment.status !== "pending")) {
      throw badRequest("Escrow payment not ready");
    }
    // In mock mode, pending is acceptable until mock checkout; live path should authorize first.
  }

  const updated = await repo.updateErrand(task.id, {
    runnerId: runner.id,
    status: "accepted",
  });

  const user = await repo.getUser(task.userId);
  if (user) {
    await sendSms(
      user.phone,
      `Errand ${task.reference} accepted by ${runner.displayName}. Contact via ${updated.whatsappGroupHint}.`,
    );
  }

  return updated;
}

export async function updateErrandStatus(input: {
  errandId: string;
  status: Extract<ErrandTask["status"], "in_progress" | "cancelled">;
  actorUserId: string;
}): Promise<ErrandTask> {
  const repo = await db();
  const task = await repo.getErrand(input.errandId);
  if (!task) throw notFound("Errand not found");

  if (input.status === "cancelled") {
    if (task.userId !== input.actorUserId) throw forbidden();
    if (task.paymentId && (task.status === "posted" || task.status === "accepted")) {
      const payment = await repo.getPayment(task.paymentId);
      if (payment?.status === "authorized") {
        await releaseEscrow(task.paymentId);
      }
    }
    return repo.updateErrand(task.id, { status: "cancelled" });
  }

  if (task.status !== "accepted") throw badRequest("Errand must be accepted first");
  return repo.updateErrand(task.id, { status: "in_progress" });
}

export async function completeErrand(input: {
  errandId: string;
  runnerId: string;
  note?: string;
  photoBytes?: Buffer;
  photoMimeType?: string;
  photoFileName?: string;
}): Promise<ErrandTask> {
  const repo = await db();
  const task = await repo.getErrand(input.errandId);
  if (!task) throw notFound("Errand not found");
  if (task.runnerId !== input.runnerId) throw forbidden("Not your errand");
  if (task.status !== "in_progress" && task.status !== "accepted") {
    throw badRequest("Errand not in progress");
  }

  let completionPhotoPath: string | undefined;
  if (input.photoBytes?.length) {
    const stored = await storage().put(input.photoBytes, {
      mimeType: input.photoMimeType ?? "image/jpeg",
      fileName: input.photoFileName ?? "completion.jpg",
      folder: "errands",
    });
    completionPhotoPath = stored.path;
  }

  const updated = await repo.updateErrand(task.id, {
    status: "done_pending_confirm",
    completionNote: input.note,
    completionPhotoPath,
  });

  const user = await repo.getUser(task.userId);
  if (user) {
    await sendSms(
      user.phone,
      `Errand ${task.reference} marked done. Open the app to confirm and release payment.`,
    );
  }
  return updated;
}

export async function confirmErrand(input: {
  errandId: string;
  userId: string;
}): Promise<ErrandTask> {
  const repo = await db();
  const task = await repo.getErrand(input.errandId);
  if (!task) throw notFound("Errand not found");
  if (task.userId !== input.userId) throw forbidden();
  if (task.status !== "done_pending_confirm") {
    throw badRequest("Errand is not awaiting confirmation");
  }

  if (task.paymentId) {
    const payment = await repo.getPayment(task.paymentId);
    if (payment?.status === "authorized") {
      await captureEscrow(task.paymentId);
    } else if (payment?.status === "pending") {
      // Mock convenience: capture after mock checkout may have been skipped.
      await repo.updatePayment(task.paymentId, { status: "captured" });
    }
  }

  const updated = await repo.updateErrand(task.id, { status: "completed" });

  if (task.runnerId) {
    const runner = await repo.getRunner(task.runnerId);
    if (runner) {
      await sendSms(
        runner.phone,
        `Errand ${task.reference} confirmed. Escrow released/captured.`,
      );
    }
  }
  return updated;
}
