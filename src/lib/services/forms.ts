import { addisChat, speakText, transcribeAudio } from "@/lib/providers";
import { db } from "@/lib/db";
import { getFormTemplate, listFormTemplates } from "@/lib/forms/templates";
import { badRequest, notFound, paymentRequired } from "@/lib/errors";
import { newId, nowIso } from "@/lib/ids";
import { renderFormPdf } from "@/lib/services/pdf";
import { storage } from "@/lib/storage/fs";
import type { FormFillSession, FormTemplateId } from "@/lib/types";

export { listFormTemplates, getFormTemplate };

export async function startFormSession(input: {
  userId: string;
  templateId: FormTemplateId;
  sourceDocumentId?: string;
}): Promise<FormFillSession> {
  const template = getFormTemplate(input.templateId);
  const repo = await db();
  const answers: Record<string, string> = {};

  if (input.sourceDocumentId) {
    const doc = await repo.getDocument(input.sourceDocumentId);
    if (doc) {
      for (const field of template.fields) {
        if (field.autofillFrom && doc.extractedFields[field.autofillFrom]) {
          answers[field.key] = doc.extractedFields[field.autofillFrom];
        }
      }
    }
  }

  const session: FormFillSession = {
    id: newId("form"),
    userId: input.userId,
    templateId: input.templateId,
    answers,
    currentFieldIndex: 0,
    sourceDocumentId: input.sourceDocumentId,
    status: "draft",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  return repo.createFormSession(session);
}

export async function explainCurrentField(sessionId: string): Promise<{
  fieldKey: string;
  labelAm: string;
  helpAm: string;
  explanationAm: string;
  audioBase64?: string;
  mimeType?: string;
}> {
  const repo = await db();
  const session = await repo.getFormSession(sessionId);
  if (!session) throw notFound("Form session not found");
  const template = getFormTemplate(session.templateId);
  const field = template.fields[session.currentFieldIndex];
  if (!field) throw badRequest("Form already complete");

  const llm = await addisChat([
    {
      role: "system",
      content: "FORM_FIELD_HELPER. Explain the kebele form field briefly in Amharic.",
    },
    {
      role: "user",
      content: `FIELD_LABEL: ${field.labelAm}\nFIELD_HELP: ${field.helpAm}`,
    },
  ]);
  const tts = await speakText(llm.text);

  return {
    fieldKey: field.key,
    labelAm: field.labelAm,
    helpAm: field.helpAm,
    explanationAm: llm.text,
    audioBase64: tts.audioBase64,
    mimeType: tts.mimeType,
  };
}

export async function answerCurrentField(input: {
  sessionId: string;
  value?: string;
  audio?: Buffer;
  audioFileName?: string;
}): Promise<FormFillSession> {
  const repo = await db();
  const session = await repo.getFormSession(input.sessionId);
  if (!session) throw notFound("Form session not found");
  const template = getFormTemplate(session.templateId);
  const field = template.fields[session.currentFieldIndex];
  if (!field) throw badRequest("Form already complete");

  let value = input.value?.trim() ?? "";
  if (!value && input.audio) {
    const stt = await transcribeAudio(input.audio, {
      fileName: input.audioFileName ?? "field.webm",
      language: "am",
    });
    value = stt.text;
  }
  if (!value && field.required) {
    throw badRequest(`Field ${field.key} is required`);
  }

  const answers = { ...session.answers, [field.key]: value };
  const nextIndex = session.currentFieldIndex + 1;
  const complete = nextIndex >= template.fields.length;

  return repo.updateFormSession(session.id, {
    answers,
    currentFieldIndex: complete ? session.currentFieldIndex : nextIndex,
    status: complete ? "ready" : "draft",
  });
}

export async function setFormAnswers(
  sessionId: string,
  answers: Record<string, string>,
): Promise<FormFillSession> {
  const repo = await db();
  const session = await repo.getFormSession(sessionId);
  if (!session) throw notFound("Form session not found");
  const template = getFormTemplate(session.templateId);
  const merged = { ...session.answers, ...answers };
  const missing = template.fields.filter((f) => f.required && !merged[f.key]?.trim());
  return repo.updateFormSession(sessionId, {
    answers: merged,
    currentFieldIndex: missing.length
      ? template.fields.findIndex((f) => f.key === missing[0].key)
      : template.fields.length - 1,
    status: missing.length ? "draft" : "ready",
  });
}

export async function renderPaidFormPdf(sessionId: string): Promise<{
  session: FormFillSession;
  pdfBase64: string;
  downloadUrl: string;
}> {
  const repo = await db();
  const session = await repo.getFormSession(sessionId);
  if (!session) throw notFound("Form session not found");
  if (session.status !== "paid" && session.status !== "rendered") {
    throw paymentRequired("Pay with Telebirr before downloading the PDF");
  }

  const template = getFormTemplate(session.templateId);
  const pdfBytes = await renderFormPdf(template, session.answers);
  const stored = await storage().put(Buffer.from(pdfBytes), {
    mimeType: "application/pdf",
    fileName: `${template.id}.pdf`,
    folder: "forms",
  });

  const updated = await repo.updateFormSession(sessionId, {
    pdfStoragePath: stored.path,
    status: "rendered",
  });

  return {
    session: updated,
    pdfBase64: Buffer.from(pdfBytes).toString("base64"),
    downloadUrl: stored.url,
  };
}
