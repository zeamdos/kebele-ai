import { config, isLive } from "@/lib/env";
import { upstreamError } from "@/lib/errors";
import { amCopy } from "@/lib/copy";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatResult {
  text: string;
  model: string;
  mocked: boolean;
  usage?: { promptTokens: number; completionTokens: number };
}

/**
 * Single integration point for Addis AI chat/completions.
 * Default: deterministic mock grounded on the prompt content.
 * Live: POST {baseUrl}/chat/completions when USE_REAL_APIS / USE_REAL_ADDIS_AI.
 */
export async function addisChat(
  messages: ChatMessage[],
  options: { temperature?: number; maxTokens?: number } = {},
): Promise<ChatResult> {
  if (!isLive("addisAi")) {
    return mockChat(messages);
  }

  const cfg = config().addisAi;
  if (!cfg.apiKey) {
    throw upstreamError("ADDIS_AI_API_KEY is required for live mode");
  }

  const response = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: cfg.model,
      messages,
      temperature: options.temperature ?? 0.2,
      max_tokens: options.maxTokens ?? 800,
    }),
  });

  if (!response.ok) {
    throw upstreamError(
      `Addis AI request failed (${response.status})`,
      await safeText(response),
    );
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
    model?: string;
  };
  const text = payload.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw upstreamError("Addis AI returned an empty completion");
  }

  return {
    text,
    model: payload.model ?? cfg.model,
    mocked: false,
    usage: {
      promptTokens: payload.usage?.prompt_tokens ?? 0,
      completionTokens: payload.usage?.completion_tokens ?? 0,
    },
  };
}

function mockChat(messages: ChatMessage[]): ChatResult {
  const copy = amCopy();
  const system = messages.find((m) => m.role === "system")?.content ?? "";
  const lastUser =
    [...messages].reverse().find((m) => m.role === "user")?.content ?? "";

  if (system.includes("DOCUMENT_ANALYZER") || lastUser.includes("OCR_TEXT:")) {
    return {
      text: JSON.stringify(mockDocumentAnalysis(lastUser), null, 2),
      model: "mock-addis-am",
      mocked: true,
      usage: { promptTokens: 120, completionTokens: 180 },
    };
  }

  if (system.includes("FORM_FIELD_HELPER")) {
    const fieldMatch = lastUser.match(/FIELD_LABEL:\s*(.+)/);
    const label = fieldMatch?.[1]?.trim() ?? "field";
    return {
      text: copy.assistant.fieldHelp.replace("{label}", label),
      model: "mock-addis-am",
      mocked: true,
    };
  }

  const contextBlock = extractBetween(system, "CONTEXT_START", "CONTEXT_END");
  const grounded = contextBlock
    ? summarizeContextAm(contextBlock, lastUser)
    : copy.assistant.noContext;

  return {
    text: grounded,
    model: "mock-addis-am",
    mocked: true,
    usage: { promptTokens: 200, completionTokens: 160 },
  };
}

function mockDocumentAnalysis(prompt: string): {
  documentKind: string;
  summaryAm: string;
  actionableFlags: string[];
  extractedFields: Record<string, string>;
} {
  const copy = amCopy();
  const lower = prompt.toLowerCase();
  const hasId =
    lower.includes("national id") ||
    lower.includes("id no") ||
    /id\s*number/i.test(prompt) ||
    lower.includes("id-") ||
    prompt.includes(copy.document.defaultName) && lower.includes("expires");
  const hasResidence =
    lower.includes("residence") || prompt.includes(copy.ocr.residenceLines[0]);

  if (hasId || prompt.includes(copy.ocr.idLines[0])) {
    return {
      documentKind: "national_id",
      summaryAm: copy.document.nationalIdSummary,
      actionableFlags: pickExpiryFlags(prompt),
      extractedFields: {
        fullName:
          pickField(prompt, /(?:name)[:\s]+([^\n]+)/i) ??
          pickLabeled(prompt, copy.ocr.idLines) ??
          copy.document.defaultName,
        dateOfBirth:
          pickField(prompt, /(?:date of birth|dob)[:\s]+([^\n]+)/i) ??
          "1990-01-15",
        idNumber:
          pickField(prompt, /(?:id\s*(?:no|number))[:\s]+([^\n]+)/i) ??
          "ID-0001234567",
        sex: pickField(prompt, /(?:sex)[:\s]+([^\n]+)/i) ?? copy.document.defaultSex,
      },
    };
  }

  if (hasResidence) {
    return {
      documentKind: "residence_certificate",
      summaryAm: copy.document.residenceSummary,
      actionableFlags: [],
      extractedFields: {
        fullName:
          pickField(prompt, /(?:name)[:\s]+([^\n]+)/i) ?? copy.document.defaultName,
        kebele:
          pickField(prompt, /(?:kebele)[:\s]+([^\n]+)/i) ??
          copy.document.defaultKebele,
        woreda:
          pickField(prompt, /(?:woreda)[:\s]+([^\n]+)/i) ??
          copy.document.defaultWoreda,
        address:
          pickField(prompt, /(?:address)[:\s]+([^\n]+)/i) ??
          copy.document.defaultAddress,
      },
    };
  }

  return {
    documentKind: "unknown",
    summaryAm: copy.document.unknownSummary,
    actionableFlags: [copy.document.unknownFlag],
    extractedFields: {},
  };
}

function pickLabeled(prompt: string, lines: string[]): string | undefined {
  for (const line of lines) {
    if (line.includes(":") && prompt.includes(line)) {
      return line.split(":").slice(1).join(":").trim();
    }
  }
  return undefined;
}

function pickExpiryFlags(text: string): string[] {
  const copy = amCopy();
  if (/expires|expiry/i.test(text)) {
    return [copy.document.expiryFlag];
  }
  if (/signature/i.test(text) && /missing/i.test(text)) {
    return [copy.document.signatureFlag];
  }
  return [];
}

function pickField(text: string, re: RegExp): string | undefined {
  const match = text.match(re);
  return match?.[1]?.trim();
}

function extractBetween(text: string, start: string, end: string): string {
  const s = text.indexOf(start);
  const e = text.indexOf(end);
  if (s === -1 || e === -1 || e <= s) return "";
  return text.slice(s + start.length, e).trim();
}

function summarizeContextAm(context: string, question: string): string {
  const copy = amCopy();
  const firstParagraph =
    context
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .find(Boolean) ?? context.slice(0, 400);

  const q = question.trim();
  const qShort = q.slice(0, 80) + (q.length > 80 ? "..." : "");
  return [
    copy.assistant.groundedPrefix,
    firstParagraph,
    "",
    q
      ? `Q: ${qShort}\n${copy.assistant.groundedSuffix}`
      : copy.assistant.groundedSuffix,
  ].join("\n");
}

async function safeText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}
