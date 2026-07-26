import knowledge from "@/lib/rag/knowledge.json";
import type { KnowledgeChunk } from "@/lib/types";

const CHUNKS = knowledge as KnowledgeChunk[];

export interface RetrievalHit {
  chunk: KnowledgeChunk;
  score: number;
}

/**
 * Lightweight lexical retriever for the MVP anti-hallucination layer.
 * Scores Amharic + Latin tokens overlap; enough to ground answers on real
 * procedure text without standing up a vector DB on day one.
 */
export function retrieveKnowledge(
  query: string,
  options: { topK?: number; serviceId?: string } = {},
): RetrievalHit[] {
  const topK = options.topK ?? 3;
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];

  const scored = CHUNKS.filter((chunk) =>
    options.serviceId ? chunk.serviceId === options.serviceId || chunk.serviceId === "general" : true,
  ).map((chunk) => {
    const haystack = tokenize(
      [
        chunk.title,
        chunk.titleAm,
        chunk.body,
        chunk.bodyAm,
        chunk.tags.join(" "),
        chunk.serviceId,
      ].join(" "),
    );
    const hayset = new Set(haystack);
    let overlap = 0;
    for (const token of tokens) {
      if (hayset.has(token)) overlap += 1;
      else if ([...hayset].some((h) => h.includes(token) || token.includes(h))) {
        overlap += 0.5;
      }
    }
    const score = overlap / Math.sqrt(tokens.length);
    return { chunk, score };
  });

  return scored
    .filter((h) => h.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

export function formatContext(hits: RetrievalHit[]): string {
  if (hits.length === 0) return "";
  return hits
    .map(
      (hit, i) =>
        `[${i + 1}] ${hit.chunk.titleAm}\n${hit.chunk.bodyAm}\n(${hit.chunk.body})`,
    )
    .join("\n\n");
}

export function allKnowledge(): KnowledgeChunk[] {
  return CHUNKS;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}
