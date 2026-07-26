import { config, isLive } from "@/lib/env";
import { upstreamError } from "@/lib/errors";
import { createHash } from "node:crypto";

export interface SpeakResult {
  audioBase64: string;
  mimeType: string;
  mocked: boolean;
  voiceId: string;
}

/**
 * ElevenLabs TTS integration point.
 * Mock returns a tiny valid WAV (silence) so the client can still play audio.
 */
export async function speakText(
  text: string,
  options: { voiceId?: string } = {},
): Promise<SpeakResult> {
  const cfg = config().elevenlabs;
  const voiceId = options.voiceId ?? cfg.voiceId;

  if (!isLive("elevenlabs")) {
    return {
      audioBase64: silentWavBase64(Math.min(3, Math.max(1, text.length / 40))),
      mimeType: "audio/wav",
      mocked: true,
      voiceId,
    };
  }

  if (!cfg.apiKey) {
    throw upstreamError("ELEVENLABS_API_KEY is required for live mode");
  }

  const response = await fetch(
    `${cfg.baseUrl}/text-to-speech/${encodeURIComponent(voiceId)}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": cfg.apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: cfg.modelId,
        voice_settings: { stability: 0.4, similarity_boost: 0.7 },
      }),
    },
  );

  if (!response.ok) {
    throw upstreamError(
      `ElevenLabs request failed (${response.status})`,
      await response.text().catch(() => ""),
    );
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  return {
    audioBase64: buffer.toString("base64"),
    mimeType: response.headers.get("content-type") ?? "audio/mpeg",
    mocked: false,
    voiceId,
  };
}

/** Deterministic short fingerprint used by tests / cache keys. */
export function speakCacheKey(text: string, voiceId: string): string {
  return createHash("sha256").update(`${voiceId}:${text}`).digest("hex").slice(0, 16);
}

function silentWavBase64(seconds: number): string {
  const sampleRate = 16000;
  const numSamples = Math.floor(sampleRate * seconds);
  const dataSize = numSamples * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);
  return buffer.toString("base64");
}
