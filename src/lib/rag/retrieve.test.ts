import { describe, expect, it } from "vitest";
import { formatContext, retrieveKnowledge } from "@/lib/rag/retrieve";

describe("retrieveKnowledge", () => {
  it("grounds ID renewal questions on procedure chunks", () => {
    const hits = retrieveKnowledge("መታወቂያ ማደስ ሰነዶች", { topK: 3 });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].chunk.serviceId).toMatch(/id_renewal|general/);
    expect(formatContext(hits)).toContain("መታወቂያ");
  });

  it("finds residence certificate guidance", () => {
    const hits = retrieveKnowledge("residence certificate kebele", { topK: 2 });
    expect(hits.some((h) => h.chunk.serviceId === "residence_certificate")).toBe(
      true,
    );
  });
});
