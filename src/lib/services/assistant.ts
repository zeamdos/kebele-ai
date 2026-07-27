import { addisChat, speakText, transcribeAudio } from "@/lib/providers";
import { formatContext, retrieveKnowledge } from "@/lib/rag/retrieve";
import { newId, nowIso } from "@/lib/ids";
import type { AssistantTurn } from "@/lib/types";
import { amCopy } from "@/lib/copy";

export interface AskAssistantInput {
  text?: string;
  audio?: Buffer;
  audioFileName?: string;
  speak?: boolean;
}

export interface AskAssistantResult {
  userTurn: AssistantTurn;
  assistantTurn: AssistantTurn;
  transcript?: string;
  sttMocked: boolean;
  llmMocked: boolean;
  ttsMocked?: boolean;
}

export async function askAssistant(
  input: AskAssistantInput,
): Promise<AskAssistantResult> {
  let question = input.text?.trim() ?? "";
  let sttMocked = false;

  if (!question && input.audio) {
    const stt = await transcribeAudio(input.audio, {
      fileName: input.audioFileName,
      language: "am",
    });
    question = stt.text;
    sttMocked = stt.mocked;
  }

  if (!question) {
    question = amCopy().stt.idRenewal;
  }

  const hits = retrieveKnowledge(question, { topK: 3 });
  const context = formatContext(hits);

  const system = [
    "You are Kebele Navigator, a voice-first Amharic government paperwork assistant.",
    "Answer ONLY from the retrieved kebele procedure context. If context is insufficient, say so.",
    "Prefer clear Amharic. Mention that fees can vary by kebele.",
    "CONTEXT_START",
    context || "(no context)",
    "CONTEXT_END",
  ].join("\n");

  const llm = await addisChat([
    { role: "system", content: system },
    { role: "user", content: question },
  ]);

  let audioUrl: string | undefined;
  let ttsMocked: boolean | undefined;
  if (input.speak !== false) {
    const tts = await speakText(llm.text);
    audioUrl = `data:${tts.mimeType};base64,${tts.audioBase64}`;
    ttsMocked = tts.mocked;
  }

  const userTurn: AssistantTurn = {
    id: newId("turn"),
    role: "user",
    text: question,
    createdAt: nowIso(),
  };
  const assistantTurn: AssistantTurn = {
    id: newId("turn"),
    role: "assistant",
    text: llm.text,
    audioUrl,
    sources: hits.map((h) => ({
      chunkId: h.chunk.id,
      titleAm: h.chunk.titleAm,
    })),
    createdAt: nowIso(),
  };

  return {
    userTurn,
    assistantTurn,
    transcript: question,
    sttMocked,
    llmMocked: llm.mocked,
    ttsMocked,
  };
}
