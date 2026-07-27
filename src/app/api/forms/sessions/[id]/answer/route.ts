import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { forbidden, notFound } from "@/lib/errors";
import { jsonError, jsonOk } from "@/lib/http";
import { answerCurrentField } from "@/lib/services/forms";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser(request);
    const { id } = await context.params;
    const repo = await db();
    const session = await repo.getFormSession(id);
    if (!session) throw notFound("Form session not found");
    if (session.userId !== user.id) throw forbidden();

    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const value = String(form.get("value") ?? "");
      const file = form.get("audio");
      let audio: Buffer | undefined;
      let audioFileName: string | undefined;
      if (file && typeof file !== "string") {
        audio = Buffer.from(await file.arrayBuffer());
        audioFileName = file.name;
      }
      return jsonOk(
        await answerCurrentField({
          sessionId: id,
          value,
          audio,
          audioFileName,
        }),
      );
    }

    const body = (await request.json()) as { value?: string };
    return jsonOk(
      await answerCurrentField({ sessionId: id, value: body.value }),
    );
  } catch (error) {
    return jsonError(error);
  }
}
