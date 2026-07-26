import { storage } from "@/lib/storage/fs";
import { jsonError } from "@/lib/http";
import { notFound } from "@/lib/errors";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  try {
    const { path: parts } = await context.params;
    const storagePath = parts.map(decodeURIComponent).join("/");
    const bytes = await storage().get(storagePath);
    const ext = storagePath.split(".").pop()?.toLowerCase();
    const mime =
      ext === "pdf"
        ? "application/pdf"
        : ext === "png"
          ? "image/png"
          : ext === "jpg" || ext === "jpeg"
            ? "image/jpeg"
            : ext === "webp"
              ? "image/webp"
              : "application/octet-stream";
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": mime,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return jsonError(notFound("File not found"));
  }
}
