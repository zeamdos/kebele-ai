import { requireUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { askAssistant } from "@/lib/services/assistant";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await requireUser(request);
    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const text = String(form.get("text") ?? "");
      const speak = String(form.get("speak") ?? "true") !== "false";
      const file = form.get("audio");
      let audio: Buffer | undefined;
      let audioFileName: string | undefined;
      if (file && typeof file !== "string") {
        audio = Buffer.from(await file.arrayBuffer());
        audioFileName = file.name;
      }
      const result = await askAssistant({ text, audio, audioFileName, speak });
      return jsonOk(result);
    }

    const body = (await request.json()) as {
      text?: string;
      speak?: boolean;
    };
    const result = await askAssistant({
      text: body.text,
      speak: body.speak !== false,
    });
    return jsonOk(result);
  } catch (error) {
    return jsonError(error);
  }
}
