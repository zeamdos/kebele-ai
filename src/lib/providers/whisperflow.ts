import { config, isLive } from "@/lib/env";
import { upstreamError } from "@/lib/errors";
import { amCopy } from "@/lib/copy";

export interface TranscribeResult {
  text: string;
  language: string;
  durationMs: number;
  mocked: boolean;
}

/**
 * Whisperflow STT integration point.
 * Mock returns a fixed Amharic utterance (or a hint encoded in the filename).
 */
export async function transcribeAudio(
  audio: Buffer,
  options: { fileName?: string; language?: string } = {},
): Promise<TranscribeResult> {
  void audio;

  if (!isLive("whisperflow")) {
    return mockTranscribe(options.fileName);
  }

  const cfg = config().whisperflow;
  if (!cfg.apiKey) {
    throw upstreamError("WHISPERFLOW_API_KEY is required for live mode");
  }

  const form = new FormData();
  form.append(
    "file",
    new Blob([new Uint8Array(audio)], { type: "audio/webm" }),
    options.fileName ?? "audio.webm",
  );
  form.append("language", options.language ?? "am");

  const response = await fetch(`${cfg.baseUrl}/transcribe`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.apiKey}` },
    body: form,
  });

  if (!response.ok) {
    throw upstreamError(
      `Whisperflow request failed (${response.status})`,
      await response.text().catch(() => ""),
    );
  }

  const payload = (await response.json()) as {
    text?: string;
    language?: string;
    duration_ms?: number;
  };

  if (!payload.text?.trim()) {
    throw upstreamError("Whisperflow returned empty transcript");
  }

  return {
    text: payload.text.trim(),
    language: payload.language ?? "am",
    durationMs: payload.duration_ms ?? 0,
    mocked: false,
  };
}

function mockTranscribe(fileName?: string): TranscribeResult {
  const copy = amCopy();
  const hint = fileName?.toLowerCase() ?? "";
  let text = copy.stt.idRenewal;
  if (hint.includes("residence") || hint.includes("menoria")) {
    text = copy.stt.residence;
  } else if (hint.includes("name") || hint.includes("correction")) {
    text = copy.stt.nameCorrection;
  } else if (hint.includes("field")) {
    text = copy.stt.fieldValue;
  }

  return {
    text,
    language: "am",
    durationMs: fileName ? 2400 : 1800,
    mocked: true,
  };
}
